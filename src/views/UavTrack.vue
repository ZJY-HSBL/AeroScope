<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import {
  getUavFlightVisualize,
  mapFlightPathToPoints,
} from '@/api/uavTrack.js'

/** 与后端接口一致：taskId + 热力图中心经纬度 */
const taskId = ref('TASK-001')
const centerLng = ref(118.883)
const centerLat = ref(31.654)
const radius = ref(1000)

const loading = ref(true)
const firstLoading = ref(true)
const lastLoadError = ref('')

const playing = ref(true)
const speed = ref(1)
const tickMs = 900

let playbackTimer = null
let autoRefreshTimer = null
let hasInitializedMapView = false
let hasShownPredictedHeatNotice = false
let isAlive = true

const fullPoints = ref([])
const visibleCount = ref(0)

const mapEl = ref(null)
let map = null
let trackLayerGroup = null
let startMarker = null
let endMarker = null
let heatLayer = null

const trackData = ref(null)
const heatData = ref(null)

const lastPoint = computed(() => {
  const pts = trackData.value?.points
  return Array.isArray(pts) && pts.length ? pts[pts.length - 1] : null
})

function fixLeafletDefaultIcon() {
  try {
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
      iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
      shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
    })
  } catch (_) {
    // 忽略
  }
}

function buildLatLngs(points) {
  return (points || [])
    .filter((p) => p && p.latitude != null && p.longitude != null)
    .map((p) => [Number(p.latitude), Number(p.longitude)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
}

function buildHeatLatLngs(points) {
  return (points || [])
    .filter((p) => p && p.latitude != null && p.longitude != null)
    .map((p) => [Number(p.latitude), Number(p.longitude), Number(p.intensity ?? 0.3)])
    .filter(([lat, lng, intensity]) =>
      Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(intensity)
    )
}

function mapHeatmapToPointsLocal(heatmap) {
  const points = Array.isArray(heatmap?.gridPoints) ? heatmap.gridPoints : []

  if (!points.length) {
    return {
      taskId: heatmap?.taskId || '',
      points: [],
      minConcentration: Number(heatmap?.minConcentration ?? 0),
      maxConcentration: Number(heatmap?.maxConcentration ?? 0),
      avgConcentration: Number(heatmap?.avgConcentration ?? 0),
    }
  }

  const minC = Number(heatmap?.minConcentration ?? 0)
  const maxC = Number(heatmap?.maxConcentration ?? 0)
  const range = Math.max(1, maxC - minC)

  const mapped = points
    .map((p) => {
      const concentration = Number(p?.concentration ?? 0)
      const weight = Number(p?.weight ?? 0)

      let intensity = (concentration - minC) / range
      if (Number.isFinite(weight) && weight > 0) {
        intensity = intensity * 0.8 + Math.min(weight, 1) * 0.2
      }

      intensity = Math.max(0.05, Math.min(1, intensity))

      return {
        latitude: Number(p?.latitude),
        longitude: Number(p?.longitude),
        concentration,
        pollutionLevel: Number(p?.pollutionLevel ?? 0),
        colorCode: p?.colorCode || '',
        intensity,
      }
    })
    .filter((p) => {
      if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return false
      if (p.intensity < 0.18) return false

      const dLat = Math.abs(p.latitude - Number(centerLat.value))
      const dLng = Math.abs(p.longitude - Number(centerLng.value))
      return dLat <= 0.006 && dLng <= 0.006
    })

  return {
    taskId: heatmap?.taskId || '',
    points: mapped,
    minConcentration: minC,
    maxConcentration: maxC,
    avgConcentration: Number(heatmap?.avgConcentration ?? 0),
  }
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num))
}

function concentrationToIntensity(c) {
  const val = Number(c ?? 0)
  return clamp(val / 220, 0.08, 0.55)
}

function concentrationToSpread(c) {
  const val = Number(c ?? 0)
  if (val < 40) return 0.00003
  if (val < 60) return 0.00005
  if (val < 90) return 0.00007
  if (val < 130) return 0.00009
  return 0.00012
}

/** 把单个飞行轨迹点扩散成一组预测热力点 */
function expandTrackPointToHeatPoints(p) {
  const lat = Number(p.latitude)
  const lng = Number(p.longitude)
  const c = Number(p.concentration ?? 0)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []

  const intensity = concentrationToIntensity(c)
  const spread = concentrationToSpread(c)

  return [
    { latitude: lat, longitude: lng, intensity, concentration: c, source: 'predicted' },
    { latitude: lat + spread, longitude: lng, intensity: intensity * 0.45, concentration: c, source: 'predicted' },
    { latitude: lat - spread, longitude: lng, intensity: intensity * 0.45, concentration: c, source: 'predicted' },
    { latitude: lat, longitude: lng + spread, intensity: intensity * 0.45, concentration: c, source: 'predicted' },
    { latitude: lat, longitude: lng - spread, intensity: intensity * 0.45, concentration: c, source: 'predicted' },
  ]
}

function buildPredictedHeatFromTrack(trackPoints) {
  return (trackPoints || []).flatMap(expandTrackPointToHeatPoints)
}

function getVisibleTrackPoints() {
  return (fullPoints.value || []).slice(0, Math.max(0, visibleCount.value))
}

function buildVisibleHeatPoints() {
  const visibleTrack = getVisibleTrackPoints()
  const predictedHeatPoints = buildPredictedHeatFromTrack(visibleTrack)
  return predictedHeatPoints
}

function isNear(a, b, threshold = 0.00012) {
  const dLat = Math.abs(Number(a.latitude) - Number(b.latitude))
  const dLng = Math.abs(Number(a.longitude) - Number(b.longitude))
  return dLat <= threshold && dLng <= threshold
}

/** 真实点优先 */
function mergeHeatPoints(realPoints = [], predictedPoints = []) {
  if (!realPoints.length) return predictedPoints

  const filteredPredicted = predictedPoints.filter((pp) => {
    return !realPoints.some((rp) => isNear(pp, rp))
  })

  return [...filteredPredicted, ...realPoints]
}

function safeFitBounds(bounds, options = { padding: [24, 24] }) {
  if (!map) {
    console.warn('safeFitBounds: map is null')
    return
  }
  if (!bounds) {
    console.warn('safeFitBounds: bounds is null')
    return
  }
  if (typeof bounds.isValid === 'function' && !bounds.isValid()) {
    console.warn('safeFitBounds: bounds invalid')
    return
  }

  try {
    map.fitBounds(bounds, options)
  } catch (e) {
    console.warn('safeFitBounds error:', e)
  }
}

function resetMapLayers() {
  stopPlayback()
  try {
    if (heatLayer) {
      heatLayer.remove()
      heatLayer = null
    }
    if (trackLayerGroup) {
      trackLayerGroup.remove()
      trackLayerGroup = null
    }
    if (startMarker) {
      startMarker.remove()
      startMarker = null
    }
    if (endMarker) {
      endMarker.remove()
      endMarker = null
    }
  } catch (_) {
    // 忽略
  }
}

function initMap(center) {
  if (!mapEl.value || map) return

  map = L.map(mapEl.value, {
    zoomControl: true,
    attributionControl: false,
  }).setView(center, 12)

  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
    }
  ).addTo(map)

  map.createPane('trackPane')
  map.getPane('trackPane').style.zIndex = 410

  map.createPane('markerPaneCustom')
  map.getPane('markerPaneCustom').style.zIndex = 430
}

function renderTrack() {
  if (!map) return

  const points = (fullPoints.value || []).slice(0, Math.max(0, visibleCount.value))
  const latLngs = buildLatLngs(points)
  if (!latLngs.length) return

  if (!trackLayerGroup) {
    trackLayerGroup = L.layerGroup().addTo(map)
  }
  trackLayerGroup.clearLayers()

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const seg = [
      [Number(a.latitude), Number(a.longitude)],
      [Number(b.latitude), Number(b.longitude)],
    ]
    const color = (b.colorCode || a.colorCode || '#22d3ee').toString()

    L.polyline(seg, {
      pane: 'trackPane',
      color,
      weight: 3,
      opacity: 0.42,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(trackLayerGroup)
  }

  if (!startMarker) {
    startMarker = L.circleMarker(latLngs[0], {
      pane: 'markerPaneCustom',
      radius: 6,
      color: '#22c55e',
      fillColor: '#22c55e',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map)
  } else {
    startMarker.setLatLng(latLngs[0])
  }

  if (!endMarker) {
    endMarker = L.circleMarker(latLngs[latLngs.length - 1], {
      pane: 'markerPaneCustom',
      radius: 6,
      color: '#f472b6',
      fillColor: '#f472b6',
      fillOpacity: 0.95,
      weight: 2,
    }).addTo(map)
  } else {
    endMarker.setLatLng(latLngs[latLngs.length - 1])
  }
}

function renderHeat() {
  if (!map) return

  const pts = buildVisibleHeatPoints()
  if (!pts.length) {
    if (heatLayer) {
      heatLayer.remove()
      heatLayer = null
    }
    return
  }

  const heatPts = buildHeatLatLngs(pts)
  if (!heatPts.length) return

  if (heatLayer) {
    heatLayer.remove()
    heatLayer = null
  }

  heatLayer = L.heatLayer(heatPts, {
    radius: 18,
    blur: 14,
    maxZoom: 20,
    minOpacity: 0.16,
    gradient: {
      0.15: '#60a5fa',
      0.35: '#22c55e',
      0.60: '#facc15',
      0.82: '#f97316',
      1.00: '#ef4444',
    },
  }).addTo(map)

  setTimeout(() => {
    const el = heatLayer?._canvas
    if (el) {
      el.style.zIndex = '420'
      el.style.pointerEvents = 'none'
    }
  }, 0)
}

function stopPlayback() {
  if (playbackTimer) {
    clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function startPlayback() {
  stopPlayback()
  playbackTimer = setInterval(() => {
    if (!playing.value || !isAlive) return
    const total = fullPoints.value?.length || 0
    if (!total) return
    if (visibleCount.value >= total) return

    visibleCount.value = Math.min(total, visibleCount.value + Math.max(1, Number(speed.value) || 1))
    renderTrack()
    renderHeat()
  }, tickMs)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    if (!isAlive) return
    loadData(false)
  }, 2000)
}

function togglePlaying() {
  playing.value = !playing.value
}

function restartPlayback() {
  visibleCount.value = Math.min(1, fullPoints.value?.length || 0)
  renderTrack()
  renderHeat()
}

async function loadData(showMask = false) {
  if (!isAlive) return

  if (showMask && firstLoading.value) {
    loading.value = true
  }

  try {
    const tid = taskId.value.trim()
    if (!tid) {
      ElMessage.warning('请填写任务 ID')
      return
    }

    const raw = await getUavFlightVisualize({
      taskId: tid,
      longitude: centerLng.value,
      latitude: centerLat.value,
      radius: radius.value,
    })

    if (!isAlive) return

    const path = mapFlightPathToPoints(raw?.flightPath)
    const heat = mapHeatmapToPointsLocal(raw?.heatmap || {})

    const realHeatPoints = (heat?.points || []).map((p) => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      intensity: Number(p.intensity ?? 0.4),
      concentration: Number(p.concentration ?? 0),
      source: 'real',
    }))

    const predictedHeatPoints = buildPredictedHeatFromTrack(path)
    const mergedHeatPoints = mergeHeatPoints(realHeatPoints, predictedHeatPoints)

    trackData.value = { points: path, taskId: raw?.taskId ?? tid }
    heatData.value = {
      points: mergedHeatPoints,
      realCount: realHeatPoints.length,
      predictedCount: predictedHeatPoints.length,
    }

    const oldCount = visibleCount.value
    fullPoints.value = path
    visibleCount.value = Math.min(Math.max(oldCount, 1), fullPoints.value.length)

    if (!path.length) {
      ElMessage.warning('未返回轨迹点，仅展示地图中心')
    }

    const center = lastPoint.value
      ? [Number(lastPoint.value.latitude), Number(lastPoint.value.longitude)]
      : [Number(centerLat.value), Number(centerLng.value)]

    if (!map) {
      initMap(center)
    }

    if (!map) {
      console.warn('loadData: map 初始化失败')
      return
    }

    if (!hasInitializedMapView) {
      const latLngs = buildLatLngs(path)
      if (latLngs.length >= 2) {
        const fullBounds = L.latLngBounds(latLngs)
        safeFitBounds(fullBounds, { padding: [24, 24] })
        hasInitializedMapView = true
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], 15)
        hasInitializedMapView = true
      } else {
        map.setView([Number(centerLat.value), Number(centerLng.value)], 13)
      }
    }

    renderHeat()
    renderTrack()
    startPlayback()
    lastLoadError.value = ''
  } catch (e) {
    const msg = e?.message || '加载失败'
    lastLoadError.value = msg
    ElMessage.error(msg)
    console.error('loadData error =', e)
  } finally {
    if (showMask && firstLoading.value) {
      loading.value = false
      firstLoading.value = false
    }
  }
}

function onRefresh() {
  loadData(false)
}

onMounted(async () => {
  isAlive = true
  fixLeafletDefaultIcon()
  await nextTick()
  await loadData(true)
  startAutoRefresh()
})

onUnmounted(() => {
  isAlive = false
  stopPlayback()
  stopAutoRefresh()
  resetMapLayers()
  try {
    if (map) {
      map.remove()
      map = null
    }
  } catch (_) {
    // 忽略
  }
})
</script>

<template>
  <div class="uav-track-page">
    <div class="page-header">
      <div class="header-left">
        <div class="title">无人机轨迹与污染热力图</div>
        <p v-if="lastLoadError" class="load-error">{{ lastLoadError }}</p>
      </div>

      <div class="actions">
        <el-input
          v-model="taskId"
          size="small"
          class="id-input"
          placeholder="任务 taskId"
        />

        <el-input-number
          v-model="centerLng"
          size="small"
          class="coord-input"
          :controls="false"
          :precision="6"
          placeholder="中心经度"
        />

        <el-input-number
          v-model="centerLat"
          size="small"
          class="coord-input"
          :controls="false"
          :precision="6"
          placeholder="中心纬度"
        />

        <el-input-number
          v-model="radius"
          size="small"
          class="radius-input"
          :min="100"
          :max="50000"
          :step="100"
          placeholder="半径 m"
        />

        <el-button size="small" :disabled="loading" @click="togglePlaying">
          {{ playing ? '暂停' : '播放' }}
        </el-button>

        <el-button size="small" :disabled="loading" @click="restartPlayback">
          重播
        </el-button>

        <el-select v-model="speed" size="small" class="speed-select" :disabled="loading">
          <el-option :value="1" label="1x" />
          <el-option :value="2" label="2x" />
          <el-option :value="3" label="3x" />
          <el-option :value="5" label="5x" />
        </el-select>

        <el-button type="primary" size="small" :loading="loading" @click="onRefresh">
          刷新
        </el-button>
      </div>
    </div>

    <div class="map-wrap">
      <div v-if="loading" class="loading-mask">地图加载中...</div>
      <div ref="mapEl" class="map" />

      <div class="legend">
        <div class="legend-title">PM2.5 污染度</div>
        <div class="legend-bar" />
        <div class="legend-labels">
          <span>优</span>
          <span>重度</span>
        </div>
        <div class="legend-note">
          轨迹：弱化显示，热力层为主；起点：绿色；终点：粉色<br />
          数据：GET /uav/flight/visualize<br />
          回放：{{ visibleCount }}/{{ fullPoints.length || 0 }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uav-track-page {
  height: calc(100vh - 56px);
  padding: 0.75rem;
  background: #0a0e1a;
  color: #e0e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-left {
  min-width: 0;
}

.title {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.95);
}

.load-error {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: rgba(248, 113, 113, 0.95);
  max-width: 36rem;
  line-height: 1.4;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.id-input {
  width: 140px;
}

.coord-input {
  width: 128px;
}

.radius-input {
  width: 108px;
}

.speed-select {
  width: 82px;
}

.map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.22);
  background: rgba(8, 12, 24, 0.75);
  overflow: hidden;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.75);
}

.map {
  width: 100%;
  height: 100%;
}

.loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 26, 0.55);
  z-index: 600;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
}

.legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 210px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.22);
  background: rgba(8, 12, 24, 0.8);
  backdrop-filter: blur(8px);
  z-index: 650;
}

.legend-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

.legend-bar {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    #60a5fa 0%,
    #22c55e 25%,
    #facc15 55%,
    #f97316 75%,
    #ef4444 100%
  );
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.65);
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.75);
}

.legend-note {
  margin-top: 8px;
  font-size: 0.72rem;
  color: rgba(226, 232, 240, 0.65);
  line-height: 1.35;
}
</style>