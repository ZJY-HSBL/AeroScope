<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getUavMapData } from '@/api/uavMap.js'

// UAV 频谱瀑布图数据（由 Mock/API 提供）
const mapData = ref(null)
const canvasRef = ref(null)
let resizeObserver = null

// 将 RSSI 数值映射为蓝→绿→黄→红的伪彩色
function rssiToColor(v, min = 0, max = 100) {
  const t = (v - min) / (max - min || 1)
  if (t <= 0.25) {
    const s = t / 0.25
    return `rgb(${Math.round(0 + s * 0)}, ${Math.round(0 + s * 128)}, ${Math.round(150 + s * 105)})`
  }
  if (t <= 0.5) {
    const s = (t - 0.25) / 0.25
    return `rgb(${Math.round(0 + s * 255)}, ${Math.round(128 + s * 127)}, ${Math.round(255 - s * 255)})`
  }
  if (t <= 0.75) {
    const s = (t - 0.5) / 0.25
    return `rgb(255, ${Math.round(255 - s * 130)}, 0)`
  }
  const s = (t - 0.75) / 0.25
  return `rgb(255, ${Math.round(125 - s * 125)}, 0)`
}

// 在 Canvas 上绘制时频瀑布图和游标/坐标轴
function drawHeatmap() {
  const canvas = canvasRef.value
  const data = mapData.value
  if (!canvas || !data?.matrix?.length) return

  const dpr = window.devicePixelRatio || 1
  const padding = { top: 28, right: 12, bottom: 44, left: 48 }
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const chartLeft = padding.left
  const chartTop = padding.top
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom

  const rows = data.matrix.length
  const cols = data.matrix[0].length
  const [rssiMin, rssiMax] = data.rssiRange || [0, 100]

  const cellW = chartW / cols
  const cellH = chartH / rows

  // 瀑布流：按时间行 × 频率列逐格绘制，每格颜色为 RSSI 映射（蓝弱→红强）
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = data.matrix[r][c]
      ctx.fillStyle = rssiToColor(v, rssiMin, rssiMax)
      ctx.fillRect(
        chartLeft + c * cellW,
        chartTop + r * cellH,
        cellW + 0.5,
        cellH + 0.5
      )
    }
  }

  // 网格线：浅灰，横线（时间）+ 竖线（频率）
  ctx.strokeStyle = 'rgba(180, 190, 200, 0.25)'
  ctx.lineWidth = 0.5
  for (let c = 0; c <= cols; c++) {
    const x = chartLeft + c * cellW
    ctx.beginPath()
    ctx.moveTo(x, chartTop)
    ctx.lineTo(x, chartTop + chartH)
    ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    const y = chartTop + r * cellH
    ctx.beginPath()
    ctx.moveTo(chartLeft, y)
    ctx.lineTo(chartLeft + chartW, y)
    ctx.stroke()
  }

  const freqToX = (freq) => {
    const idx = (freq - data.freqMin) / (data.freqStep || 2)
    return chartLeft + (idx / Math.max(cols - 1, 1)) * chartW
  }

  // 红色实线 + 顶部 T 型游标（当前选中频率）
  if (data.cursorFreq != null) {
    const x = freqToX(data.cursorFreq)
    ctx.strokeStyle = '#ff4444'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, chartTop)
    ctx.lineTo(x, chartTop + chartH)
    ctx.stroke()
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.moveTo(x, chartTop)
    ctx.lineTo(x - 6, chartTop + 10)
    ctx.lineTo(x + 6, chartTop + 10)
    ctx.closePath()
    ctx.fill()
  }

  // 白色虚线：频率标记线
  if (data.markerFreq != null) {
    const x = freqToX(data.markerFreq)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(x, chartTop)
    ctx.lineTo(x, chartTop + chartH)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // X 轴：频率刻度 (MHz)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  data.freqLabels?.forEach((label, i) => {
    const x = chartLeft + (i / Math.max(cols - 1, 1)) * chartW
    ctx.fillText(label + 'M', x, chartTop + chartH + 18)
  })
  ctx.fillText('频率 (MHz)', chartLeft + chartW / 2, chartTop + chartH + 34)

  // Y 轴：Time
  ctx.textAlign = 'right'
  ctx.save()
  ctx.translate(chartLeft - 10, chartTop + chartH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('时间', 0, 0)
  ctx.restore()
  ctx.textAlign = 'left'
}

// 页面挂载后加载 UAV MAP 数据
onMounted(() => {
  getUavMapData().then((data) => {
    mapData.value = data
  })
})

// 卸载时断开 ResizeObserver，避免内存泄漏
onUnmounted(() => {
  if (resizeObserver && canvasRef.value) {
    resizeObserver.disconnect()
  }
})

watch(
  mapData,
  async (val) => {
    if (!val) return
    setTimeout(drawHeatmap, 50)
    await nextTick()
    const canvas = canvasRef.value
    if (canvas && typeof ResizeObserver !== 'undefined' && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (mapData.value) drawHeatmap()
      })
      resizeObserver.observe(canvas)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="uav-map-page">
    <div v-if="!mapData" class="uav-map-loading">加载中...</div>
    <template v-else>
      <!-- <h2 class="page-title">{{ mapData.title }}</h2> -->
      <div class="uav-map-content">
        <div class="heatmap-wrap">
          <canvas ref="canvasRef" class="heatmap-canvas"></canvas>
        </div>
        <div class="right-panel">
          <div class="rssi-legend">
            <span class="rssi-label">RSSI</span>
            <div class="rssi-bar"></div>
            <span class="rssi-zero">0</span>
          </div>
          <div class="highlights-block">
            <div class="highlights-title">Highlights</div>
            <p v-for="(line, i) in mapData.highlights" :key="i" class="highlights-line">
              {{ line }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.uav-map-page {
  height: 100%;
  padding: 1.25rem 1.5rem;
  background: #0a0e1a;
  color: #e8f4fc;
}

.uav-map-loading {
  padding: 3rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.page-title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #fff;
  text-align: center;
}

.uav-map-content {
  display: flex;
  gap: 1.5rem;
  align-items: stretch;
  min-height: calc(100vh - 120px);
}

.heatmap-wrap {
  flex: 1;
  min-width: 0;
  background: rgba(8, 12, 24, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.heatmap-canvas {
  width: 100%;
  height: 100%;
  min-height: 400px;
  display: block;
}

.right-panel {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rssi-legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.rssi-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.9);
}

.rssi-bar {
  width: 24px;
  height: 180px;
  border-radius: 4px;
  background: linear-gradient(
    to bottom,
    #ff4444 0%,
    #ff8844 20%,
    #ffcc00 40%,
    #88cc00 60%,
    #00aaff 80%,
    #0066aa 100%
  );
  border: 1px solid rgba(0, 212, 255, 0.25);
}

.rssi-zero {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
}

.highlights-block {
  flex: 1;
  min-height: 120px;
  padding: 0.75rem;
  background: rgba(12, 20, 40, 0.7);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 8px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: rgba(232, 244, 252, 0.9);
}

.highlights-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgba(0, 212, 255, 0.95);
}

.highlights-line {
  margin: 0 0 0.35rem;
}

.highlights-line:last-child {
  margin-bottom: 0;
}
</style>
