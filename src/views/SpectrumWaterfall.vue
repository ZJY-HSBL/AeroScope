<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSpectrumRealtime,
  getSpectrumWaterfall,
  getSpectrumAlarms,
} from '@/api/spectrum.js'

let presetTimer = null
const autoScan = ref(false)
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || ''

function toggleAutoScan() {
  autoScan.value = !autoScan.value

  if (autoScan.value) {
    let idx = droneScanPresets.findIndex(p => p.key === activePreset.value)
    presetTimer = setInterval(() => {
      idx = (idx + 1) % droneScanPresets.length
      applyPreset(droneScanPresets[idx])
    }, 5000)
  } else {
    if (presetTimer) {
      clearInterval(presetTimer)
      presetTimer = null
    }
  }
}

const WIDTH = 900
const HEIGHT_SPECTRUM = 180
const HEIGHT_WATERFALL = 360
const MIN_DB = -120
const MAX_DB = -20

const centerFreq = ref(2440.0)
const bandwidth = ref(100.0)
const droneScanPresets = [
  { key: '2.4G', label: '2.4G 遥控/数传', center: 2440.0, bandwidth: 100.0 },
  { key: '5.8G', label: '5.8G 高清图传', center: 5785.0, bandwidth: 150.0 },
  { key: '1.4G', label: '1.4G 行业机', center: 1437.0, bandwidth: 20.0 },
  { key: '900M', label: '900M 远程数传', center: 910.0, bandwidth: 50.0 },
  { key: '433M', label: '433M 低频遥控', center: 435.0, bandwidth: 20.0 },
]

const activePreset = ref('2.4G')

function applyPreset(preset) {
  activePreset.value = preset.key
  centerFreq.value = preset.center
  bandwidth.value = preset.bandwidth
  loadSpectrumData()
}

const loading = ref(false)
const connectionStatus = ref('idle')

const realtimeData = ref(null)
const waterfallData = ref([])
const alarmsData = ref([])

const canvasSpectrumRef = ref(null)
const canvasWaterfallRef = ref(null)

let ctxS = null
let ctxW = null
let refreshTimer = null

const lastMeta = ref({
  start_hz: (centerFreq.value - bandwidth.value / 2) * 1e6,
  end_hz: (centerFreq.value + bandwidth.value / 2) * 1e6,
  t: Date.now(),
})

const detectedThreats = ref([])

const maxRssi = computed(() => {
  const list = Array.isArray(realtimeData.value)
    ? realtimeData.value
    : realtimeData.value?.body ||
      realtimeData.value?.points ||
      realtimeData.value?.spectrum ||
      realtimeData.value?.data ||
      []

  if (!Array.isArray(list) || !list.length) return '--'

  return Math.max(
    ...list.map((p) =>
      typeof p === 'number'
        ? Number(p)
        : Number(p?.rssi ?? p?.dbm ?? p?.value ?? MIN_DB)
    )
  ).toFixed(1)
})

const centerFreqText = computed(() => Number(centerFreq.value).toFixed(3))

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function rssiToRatio(v) {
  const val = Number(v ?? MIN_DB)
  return clamp((val - MIN_DB) / (MAX_DB - MIN_DB), 0, 1)
}

function ratioToColor(ratio) {
  const r = clamp(ratio, 0, 1)

  if (r < 0.10) return 'rgb(5, 15, 55)'
  if (r < 0.22) return 'rgb(10, 35, 110)'
  if (r < 0.38) return 'rgb(25, 75, 185)'
  if (r < 0.55) return 'rgb(70, 140, 235)'
  if (r < 0.72) return 'rgb(170, 215, 255)'
  if (r < 0.86) return 'rgb(240, 245, 255)'
  if (r < 0.95) return 'rgb(255, 220, 90)'
  return 'rgb(255, 180, 40)'
}

function processBins(bins) {
  const arr = Array.isArray(bins) ? bins.map((v) => Number(v ?? MIN_DB)) : []
  return {
    bins: arr,
    max: arr.length ? Math.max(...arr) : MIN_DB,
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function smoothArray(arr, windowSize = 5) {
  if (!Array.isArray(arr) || !arr.length) return []
  const half = Math.floor(windowSize / 2)
  return arr.map((_, i) => {
    let sum = 0
    let count = 0
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length) {
        sum += Number(arr[j] ?? MIN_DB)
        count++
      }
    }
    return count ? sum / count : arr[i]
  })
}

function getFreqRangeMHz() {
  return {
    start: Number(centerFreq.value) - Number(bandwidth.value) / 2,
    end: Number(centerFreq.value) + Number(bandwidth.value) / 2,
  }
}

function freqToX(freqMHz) {
  const { start, end } = getFreqRangeMHz()
  const ratio = (Number(freqMHz) - start) / (end - start)
  return clamp(ratio, 0, 1) * WIDTH
}

function groupWaterfallRows(list = []) {
  const map = new Map()

  for (const item of list) {
    const t = item?.timestamp || ''
    if (!t) continue
    if (!map.has(t)) map.set(t, [])
    map.get(t).push(item)
  }

  return Array.from(map.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([timestamp, rows]) => {
      const sorted = rows
        .slice()
        .sort((a, b) => Number(a.frequency ?? 0) - Number(b.frequency ?? 0))

      return {
        timestamp,
        points: sorted.map((x) => ({
          frequency: Number(x.frequency ?? 0),
          rssi: Number(x.rssi ?? MIN_DB),
        })),
      }
    })
}

function interpolateRowToBins(points, binCount = WIDTH) {
  if (!Array.isArray(points) || !points.length) {
    return new Array(binCount).fill(MIN_DB)
  }

  const sorted = points
    .slice()
    .sort((a, b) => Number(a.frequency) - Number(b.frequency))

  const bins = []

  for (let i = 0; i < binCount; i++) {
    const ratio = i / (binCount - 1)
    const { start, end } = getFreqRangeMHz()
    const freq = lerp(start, end, ratio)

    let left = sorted[0]
    let right = sorted[sorted.length - 1]

    for (let j = 0; j < sorted.length - 1; j++) {
      const a = sorted[j]
      const b = sorted[j + 1]
      if (freq >= a.frequency && freq <= b.frequency) {
        left = a
        right = b
        break
      }
    }

    if (freq <= sorted[0].frequency) {
      bins.push(sorted[0].rssi)
      continue
    }

    if (freq >= sorted[sorted.length - 1].frequency) {
      bins.push(sorted[sorted.length - 1].rssi)
      continue
    }

    const denom = right.frequency - left.frequency || 1
    const t = (freq - left.frequency) / denom
    bins.push(lerp(left.rssi, right.rssi, t))
  }

  return smoothArray(bins, 3)
}

function buildFrameFromRealtime(realtime) {
  let raw = Array.isArray(realtime)
    ? realtime
    : realtime?.body ||
      realtime?.points ||
      realtime?.spectrum ||
      realtime?.data ||
      realtime?.bins ||
      realtime?.spectrum_data ||
      []

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }

  if (!Array.isArray(raw) || !raw.length) return null

  const bins = raw.map((p) => {
    if (typeof p === 'number') return Number(p)
    return Number(p?.rssi ?? p?.dbm ?? p?.value ?? MIN_DB)
  })

  return processBins(bins)
}

function clearSpectrumCanvas() {
  if (!ctxS) return
  ctxS.clearRect(0, 0, WIDTH, HEIGHT_SPECTRUM)
  ctxS.fillStyle = '#08101c'
  ctxS.fillRect(0, 0, WIDTH, HEIGHT_SPECTRUM)
}

function clearWaterfallCanvas() {
  if (!ctxW) return
  ctxW.clearRect(0, 0, WIDTH, HEIGHT_WATERFALL)
  ctxW.fillStyle = '#050a12'
  ctxW.fillRect(0, 0, WIDTH, HEIGHT_WATERFALL)
}

function drawSpectrumGrid() {
  if (!ctxS) return
  ctxS.save()

  ctxS.strokeStyle = 'rgba(148, 163, 184, 0.18)'
  ctxS.lineWidth = 1

  for (let i = 0; i <= 5; i++) {
    const y = (HEIGHT_SPECTRUM / 5) * i
    ctxS.beginPath()
    ctxS.moveTo(0, y)
    ctxS.lineTo(WIDTH, y)
    ctxS.stroke()
  }

  for (let i = 0; i <= 10; i++) {
    const x = (WIDTH / 10) * i
    ctxS.beginPath()
    ctxS.moveTo(x, 0)
    ctxS.lineTo(x, HEIGHT_SPECTRUM)
    ctxS.stroke()
  }

  ctxS.restore()
}

function drawSpectrumAxisLabels() {
  if (!ctxS) return

  const { start: startMHz, end: endMHz } = getFreqRangeMHz()

  ctxS.save()
  ctxS.fillStyle = 'rgba(226, 232, 240, 0.78)'
  ctxS.font = '12px sans-serif'

  for (let i = 0; i <= 5; i++) {
    const y = (HEIGHT_SPECTRUM / 5) * i
    const db = (MAX_DB - ((MAX_DB - MIN_DB) / 5) * i).toFixed(0)
    ctxS.fillText(`${db}`, 8, y + 14)
  }

  for (let i = 0; i <= 5; i++) {
    const x = (WIDTH / 5) * i
    const f = (startMHz + ((endMHz - startMHz) / 5) * i).toFixed(1)
    ctxS.fillText(`${f} MHz`, x + 4, HEIGHT_SPECTRUM - 8)
  }

  ctxS.restore()
}

function renderSpectrum(frame) {
  if (!ctxS || !frame?.bins?.length) return

  clearSpectrumCanvas()
  drawSpectrumGrid()

  const baseBins = smoothArray(frame.bins, 3)

  const bins = baseBins.map((v, i, arr) => {
    const prev = arr[i - 1] ?? v
    const next = arr[i + 1] ?? v

    if (v > prev + 2 && v > next + 2) {
      return v + 4
    }
    return v
  })
  const stepX = WIDTH / Math.max(1, bins.length - 1)

  const fillGradient = ctxS.createLinearGradient(0, 0, 0, HEIGHT_SPECTRUM)
  fillGradient.addColorStop(0, 'rgba(180, 220, 255, 0.95)')
  fillGradient.addColorStop(0.25, 'rgba(90, 170, 255, 0.85)')
  fillGradient.addColorStop(0.6, 'rgba(20, 80, 220, 0.75)')
  fillGradient.addColorStop(1, 'rgba(10, 30, 80, 0.95)')

  ctxS.save()
  ctxS.beginPath()

  bins.forEach((v, idx) => {
    const ratio = rssiToRatio(v)
    const x = idx * stepX
    const y = HEIGHT_SPECTRUM - ratio * (HEIGHT_SPECTRUM - 20) - 10
    if (idx === 0) ctxS.moveTo(x, y)
    else ctxS.lineTo(x, y)
  })

  ctxS.lineTo(WIDTH, HEIGHT_SPECTRUM)
  ctxS.lineTo(0, HEIGHT_SPECTRUM)
  ctxS.closePath()

  ctxS.fillStyle = fillGradient
  ctxS.fill()
  ctxS.restore()

  ctxS.save()
  ctxS.beginPath()
  ctxS.lineWidth = 2
  ctxS.strokeStyle = 'rgba(245, 248, 255, 0.95)'

  bins.forEach((v, idx) => {
    const ratio = rssiToRatio(v)
    const x = idx * stepX
    const y = HEIGHT_SPECTRUM - ratio * (HEIGHT_SPECTRUM - 20) - 10
    if (idx === 0) ctxS.moveTo(x, y)
    else ctxS.lineTo(x, y)
  })

  ctxS.stroke()
  ctxS.restore()

  const peakValue = Math.max(...bins)
  const peakIndex = bins.findIndex((v) => v === peakValue)
  if (peakIndex >= 0) {
    const x = peakIndex * stepX
    const ratio = rssiToRatio(peakValue)
    const y = HEIGHT_SPECTRUM - ratio * (HEIGHT_SPECTRUM - 20) - 10

    ctxS.save()
    ctxS.strokeStyle = 'rgba(255, 80, 80, 0.8)'
    ctxS.lineWidth = 1
    ctxS.beginPath()
    ctxS.moveTo(x, 0)
    ctxS.lineTo(x, HEIGHT_SPECTRUM)
    ctxS.stroke()

    ctxS.fillStyle = 'rgba(255,255,255,0.95)'
    ctxS.fillRect(x - 1, y - 12, 2, 12)
    ctxS.restore()
  }

  drawSpectrumAxisLabels()
}

function renderWaterfall(frame) {
  if (!ctxW || !frame?.bins?.length) return

  const bins = frame.bins
  const rowHeight = 3
  const colWidth = WIDTH / bins.length

  const imageData = ctxW.getImageData(0, 0, WIDTH, HEIGHT_WATERFALL - rowHeight)
  ctxW.putImageData(imageData, 0, rowHeight)

  for (let i = 0; i < bins.length; i++) {
    const ratio = rssiToRatio(bins[i])
    ctxW.fillStyle = ratioToColor(ratio)
    const x = i * colWidth
    ctxW.fillRect(x, 0, Math.ceil(colWidth) + 1, rowHeight)
  }

}

function classifyDroneThreat(freq) {
  const f = Number(freq || 0)

  if (f >= 2400 && f <= 2483.5) return '疑似 2.4G 遥控/数传'
  if (f >= 5725 && f <= 5850) return '疑似 5.8G 图传'
  if (f >= 1430 && f <= 1444) return '疑似 1.4G 行业机'
  if (f >= 890 && f <= 928) return '疑似 900M 远程数传'
  if (f >= 430 && f <= 438) return '疑似 433M 低频遥控'
  return '异常频点'
}

function buildThreatsFromAlarms(list = []) {
  return list.map((a) => {
    const freq = Number(a.frequency ?? 0)
    return {
      name: `${classifyDroneThreat(freq)} (${freq.toFixed(2)} MHz)`,
      power: Number(a.peakRssi ?? a.rssi ?? MIN_DB).toFixed(1),
      time: a.detectedTime || '',
    }
  })
}

// 新增：根据预设推断威胁名称
function inferThreatNameByPreset() {
  switch (activePreset.value) {
    case '2.4G':
      return '疑似 2.4G 遥控/数传异常信号'
    case '5.8G':
      return '疑似 5.8G 高清图传异常信号'
    case '1.4G':
      return '疑似 1.4G 行业无人机信号'
    case '900M':
      return '疑似 900M 远程数传异常信号'
    case '433M':
      return '疑似 433M 低频遥控异常信号'
    default:
      return '疑似异常频谱信号'
  }
}

// 新增：根据实时频谱生成告警
function buildThreatsFromRealtime(frame) {
  if (!frame?.bins?.length) return []

  const peakValue = Math.max(...frame.bins)
  const threshold = -65

  if (peakValue < threshold) return []

  return [
    {
      name: inferThreatNameByPreset(),
      power: Number(peakValue).toFixed(1),
      time: new Date().toLocaleTimeString(),
    },
  ]
}

// 修复后的完整加载函数
async function loadSpectrumData() {
  loading.value = true
  try {
    const [realtime, waterfall, alarms] = await Promise.all([
      getSpectrumRealtime({
        centerFreq: centerFreq.value,
        bandwidth: bandwidth.value,
      }),
      getSpectrumWaterfall({
        startFreq: centerFreq.value - bandwidth.value / 2,
        endFreq: centerFreq.value + bandwidth.value / 2,
      }),
      getSpectrumAlarms(),
    ])

    realtimeData.value = Array.isArray(realtime) ? realtime : realtime?.body || realtime?.data || []
    waterfallData.value = Array.isArray(waterfall) ? waterfall : waterfall?.body || waterfall?.data || []
    alarmsData.value = Array.isArray(alarms) ? alarms : alarms?.body || alarms?.data || []

    console.log('realtime =', realtime)
    console.log('waterfall =', waterfall)
    console.log('alarms =', alarms)

    const realtimeFrame = buildFrameFromRealtime(realtimeData.value)
    const backendThreats = buildThreatsFromAlarms(alarmsData.value)
    const inferredThreats = buildThreatsFromRealtime(realtimeFrame)

    detectedThreats.value = backendThreats.length ? backendThreats : inferredThreats

    if (realtimeData.value?.startHz && realtimeData.value?.endHz) {
      lastMeta.value = {
        start_hz: Number(realtimeData.value.startHz),
        end_hz: Number(realtimeData.value.endHz),
        t: realtimeData.value.timestamp || Date.now(),
      }
    } else {
      lastMeta.value = {
        start_hz: 87 * 1e6,
        end_hz: 110 * 1e6,
        t: Date.now(),
      }
    }

    if (realtimeFrame) {
      renderSpectrum(realtimeFrame)
    } else if (Array.isArray(waterfallData.value) && waterfallData.value.length) {
      const groupedRows = groupWaterfallRows(waterfallData.value)
      const lastRow = groupedRows[groupedRows.length - 1]
      if (lastRow?.points?.length) {
        const fallbackBins = interpolateRowToBins(lastRow.points, WIDTH)
        const fallbackFrame = processBins(fallbackBins)
        renderSpectrum(fallbackFrame)
      }
    }

    if (Array.isArray(waterfallData.value) && waterfallData.value.length) {
      const groupedRows = groupWaterfallRows(waterfallData.value)
      const lastRow = groupedRows[groupedRows.length - 1]

      if (lastRow?.points?.length) {
        const bins = interpolateRowToBins(lastRow.points, WIDTH)
        const frame = processBins(bins)
        renderWaterfall(frame)
      }

      lastMeta.value = {
        start_hz: 87 * 1e6,
        end_hz: 110 * 1e6,
        t: lastRow?.timestamp || Date.now(),
      }
    } else if (realtimeFrame) {
      renderWaterfall(realtimeFrame)
    }

    connectionStatus.value = 'open'
  } catch (e) {
    connectionStatus.value = 'error'
    ElMessage.error(e?.message || '频谱数据加载失败')
  } finally {
    loading.value = false
  }
}

const statusText = computed(() => {
  if (loading.value) return 'loading'
  if (connectionStatus.value === 'open') return 'online'
  if (connectionStatus.value === 'error') return 'error'
  return 'idle'
})

onMounted(() => {
  nextTick(async () => {
    const cS = canvasSpectrumRef.value
    if (cS) {
      cS.width = WIDTH
      cS.height = HEIGHT_SPECTRUM
      ctxS = cS.getContext('2d')
      clearSpectrumCanvas()
    }

    const cW = canvasWaterfallRef.value
    if (cW) {
      cW.width = WIDTH
      cW.height = HEIGHT_WATERFALL
      ctxW = cW.getContext('2d')
      clearWaterfallCanvas()
    }

    await loadSpectrumData()

    refreshTimer = setInterval(() => {
      loadSpectrumData()
    }, 1000)
  })
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }

  if (presetTimer) {
    clearInterval(presetTimer)
    presetTimer = null
  }
})
</script>

<template>
  <div class="sdr-pro-monitor">
    <div class="top-bar">
      <div class="title-area">
        <div class="title">频谱瀑布图监测</div>
        <div class="subtitle">后端接口驱动频谱实时视图</div>
      </div>

      <div class="meta-area">
        <div class="meta-pill">
          <span class="meta-label">CENTER VFO</span>
          <span class="meta-value">{{ centerFreqText }} MHz</span>
        </div>
        <div class="meta-pill">
          <span class="meta-label">STATUS</span>
          <span class="meta-value">{{ statusText }}</span>
        </div>
        <div class="meta-pill">
          <span class="meta-label">MAX</span>
          <span class="meta-value">{{ maxRssi }} dBm</span>
        </div>
      </div>
    </div>

<div class="preset-bar">
  <button
    v-for="preset in droneScanPresets"
    :key="preset.key"
    class="preset-btn"
    :class="{ active: activePreset === preset.key }"
    @click="applyPreset(preset)"
  >
    {{ preset.label }}
  </button>
  <button class="preset-btn" :class="{ active: autoScan }" @click="toggleAutoScan">
    {{ autoScan ? '停止轮巡' : '自动轮巡' }}
  </button>
</div>

    <div class="main-grid">
      <div class="left-panel">
        <div class="panel-title">实时频谱</div>
        <div class="canvas-card spectrum-card">
          <canvas ref="canvasSpectrumRef" class="spectrum-canvas"></canvas>
        </div>

        <div class="panel-title waterfall-title">瀑布图</div>
        <div class="canvas-card waterfall-card">
          <div class="waterfall-layout">
            <div class="waterfall-colorbar">
              <div class="waterfall-colorbar-inner"></div>
            </div>

            <canvas ref="canvasWaterfallRef" class="waterfall-canvas"></canvas>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="video-panel">
          <div class="panel-title">实时视频</div>
          <div class="video-card">
            <video
              v-if="demoVideoUrl"
              class="real-video"
              :src="demoVideoUrl"
              controls
              autoplay
              muted
              loop
              playsinline
            >
              您的浏览器不支持 video 标签
            </video>
            <div v-else class="video-placeholder">
              未配置演示视频
            </div>
          </div>
        </div>

        <div class="threat-panel">
          <div class="panel-title">THREAT DETECTION</div>

          <div v-if="detectedThreats.length" class="threat-list">
            <div v-for="(item, idx) in detectedThreats.slice(0, 4)" :key="idx" class="threat-card">
              <div class="t-name">{{ item.name }}</div>
              <div class="t-info">峰值：{{ item.power }} dBm</div>
              <div class="t-info" v-if="item.time">时间：{{ item.time }}</div>
            </div>
          </div>

          <div v-else class="scanning">
            <div class="radar-circle"></div>
            <div>暂无异常告警</div>
          </div>
        </div>

        <div class="info-panel">
          <div class="panel-title">SYSTEM INFO</div>
          <div class="info-row">
            <span class="info-label">模式</span>
            <span class="info-value">接口轮询</span>
          </div>
          <div class="info-row">
            <span class="info-label">带宽</span>
            <span class="info-value">{{ bandwidth.toFixed(1) }} MHz</span>
          </div>
          <div class="info-row">
            <span class="info-label">中心频率</span>
            <span class="info-value">{{ centerFreqText }} MHz</span>
          </div>
          <div class="info-row">
            <span class="info-label">状态</span>
            <span class="info-value">{{ statusText }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sdr-pro-monitor {
  min-height: 100%;
  padding: 18px;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 30%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 28%),
    #050b12;
  color: #e5eef8;
  box-sizing: border-box;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.68);
}

.meta-area {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-pill {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  min-width: 120px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(59, 130, 246, 0.18);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.meta-label {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.9);
}

.meta-value {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
}

.left-panel,
.right-panel {
  min-width: 0;
}

.panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #8bd3ff;
}

.waterfall-title {
  margin-top: 12px;
}

.canvas-card,
.threat-panel,
.info-panel {
  background: rgba(9, 15, 24, 0.82);
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
}

.canvas-card {
  padding: 10px;
}

.spectrum-card {
  height: 200px;
}

.waterfall-card {
  height: 380px;
  padding: 10px 12px 10px 10px;
}

.waterfall-layout {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  height: 100%;
}

.waterfall-colorbar {
  width: 20px;
  min-width: 20px;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 2px 0;
}

.waterfall-colorbar-inner {
  width: 14px;
  height: 100%;
  border-radius: 10px;
  border: 1px solid rgba(120, 170, 255, 0.28);
  box-shadow:
    inset 0 0 10px rgba(255, 255, 255, 0.08),
    0 0 10px rgba(0, 80, 180, 0.18);
  background: linear-gradient(
    to bottom,
    #ff2b2b 0%,
    #ff5b2b 10%,
    #ff9a1f 22%,
    #ffe54d 36%,
    #8eb2ff 54%,
    #3b6fff 70%,
    #1736a8 84%,
    #040814 100%
  );
}

.spectrum-canvas,
.waterfall-canvas {
  display: block;
  border-radius: 8px;
  background: #061019;
}

.spectrum-canvas {
  width: 100%;
  height: 100%;
}

.waterfall-canvas {
  flex: 1;
  width: auto;
  height: 100%;
  min-width: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.threat-panel,
.info-panel {
  padding: 14px;
}

.threat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.threat-card {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(249, 115, 22, 0.12));
  border: 1px solid rgba(248, 113, 113, 0.18);
  padding: 10px;
  border-radius: 10px;
}

.t-name {
  color: #fda4af;
  font-weight: 700;
  font-size: 13px;
}

.t-info {
  font-size: 12px;
  color: #cbd5e1;
  margin-top: 4px;
}

.scanning {
  text-align: center;
  color: #22c55e;
  font-size: 12px;
  padding: 30px 0 20px;
}

.radar-circle {
  width: 34px;
  height: 34px;
  border: 2px solid #22c55e;
  border-radius: 50%;
  margin: 0 auto 10px;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
}

.info-value {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
}

.video-panel {
  padding: 14px;
  background: rgba(9, 15, 24, 0.82);
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
}

.video-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.real-video {
  width: 100%;
  height: 180px;
  border-radius: 12px;
  object-fit: cover;
  background: #000;
  border: 1px solid rgba(59, 130, 246, 0.12);
  display: block;
}

.video-placeholder {
  width: 100%;
  height: 180px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: rgba(226, 232, 240, 0.58);
  background: rgba(2, 6, 23, 0.72);
  border: 1px dashed rgba(59, 130, 246, 0.2);
  font-size: 13px;
}

.video-caption {
  font-size: 12px;
  color: rgba(226, 232, 240, 0.72);
}

.preset-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.preset-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(59, 130, 246, 0.22);
  background: rgba(15, 23, 42, 0.78);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  border-color: rgba(96, 165, 250, 0.5);
  color: #f8fafc;
}

.preset-btn.active {
  background: rgba(37, 99, 235, 0.22);
  border-color: rgba(96, 165, 250, 0.75);
  color: #8bd3ff;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>