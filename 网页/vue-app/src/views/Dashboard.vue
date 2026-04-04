<script setup>
import { ref, onMounted, computed } from 'vue'
import { getDashboardData, getDashboardMetrics } from '@/api/dashboard.js'
import chinaMapImg from '@/assets/map-china-tech.png'

// 独立加载状态，不再用 dashboardData 是否为空来代替
const loading = ref(true)
const loadError = ref('')

// 仪表盘主数据：GET /dashboard/overview
const dashboardData = ref(null)

// 核心监测指标模块数据来源：GET /dashboard/metrics
const metricsData = ref(null)

// 半圆进度条周长
const arcLength = 100.545

function unwrapApiResult(res) {
  if (!res) return null

  // 兼容 axios 风格
  const raw = res?.data ?? res

  // 兼容常见后端包装
  if (raw?.body != null) return raw.body
  if (raw?.data != null) return raw.data

  // 如果本身就是业务对象
  return raw
}

// PM2.5 指针角度
const pm25NeedleAngle = computed(() => {
  const pm25 =
    metricsData.value?.todayMaxPollution ??
    dashboardData.value?.coreMetrics?.todayMaxPollution

  return pm25 != null
    ? Math.min(90, Math.max(-90, -90 + (Number(pm25) / 300) * 180))
    : -81
})

// 湿度指针角度
const humNeedleAngle = computed(() => {
  const v =
    metricsData.value?.cityHealthIndex ??
    dashboardData.value?.coreMetrics?.cityHealthIndex

  return v != null ? -90 + (Number(v) / 100) * 180 : -37
})

// 更稳地定位无人机设备
const uavDevice = computed(() => {
  const list = dashboardData.value?.deviceStatusList || []
  const lastPos = dashboardData.value?.uavLastPosition || {}

  return (
    list.find((d) => d.deviceType === 'UAV') ||
    list.find((d) => String(d.deviceId || '').startsWith('UAV')) ||
    list.find((d) => String(d.deviceName || '').includes('无人机')) ||
    (String(lastPos.deviceId || '').startsWith('UAV') ? lastPos : null) ||
    (String(lastPos.deviceName || '').includes('无人机') ? lastPos : null) ||
    lastPos ||
    {}
  )
})

// 左下填充：设备温度
const fill1Value = computed(() => {
  const v =
    uavDevice.value?.temperature ??
    dashboardData.value?.uavLastPosition?.temperature

  if (v == null) return 0

  const t = Number(v)
  return Math.max(0, Math.min(100, Math.round((t / 80) * 100)))
})

const fill1Display = computed(() => {
  const v =
    uavDevice.value?.temperature ??
    dashboardData.value?.uavLastPosition?.temperature

  return v == null ? '—' : `${Number(v).toFixed(1)}℃`
})

const fill1Offset = computed(() => (arcLength * (100 - fill1Value.value)) / 100)

// 右下填充：信号强度
const fill2Value = computed(() => {
  const comm =
    dashboardData.value?.deviceStatusList?.find((d) => d.deviceType === 'COMM') ||
    dashboardData.value?.deviceStatusList?.find((d) => d.deviceId?.startsWith('COMM')) ||
    dashboardData.value?.deviceStatusList?.find((d) => String(d.deviceName || '').includes('4G')) ||
    {}

  const raw = comm.signalLevel ?? comm.signalStrength
  if (raw == null) return 60

  const n = Number(raw)
  return Math.max(0, Math.min(100, Math.round((n / 5) * 100)))
})

const fill2Display = computed(() => `${fill2Value.value}%`)
const fill2Offset = computed(() => (arcLength * (100 - fill2Value.value)) / 100)

// ISO 8601 时间格式化为 HH:mm
function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '—' : d.toTimeString().slice(0, 5)
  } catch {
    return '—'
  }
}

// 最后心跳优先读取“最新飞行路径/位置时间”
const lastFlightTime = computed(() => {
  const pos = dashboardData.value?.uavLastPosition || {}

  return (
    pos.collectTime ||
    pos.timestamp ||
    pos.flightTime ||
    pos.updateTime ||
    pos.lastHeartbeat ||
    null
  )
})

// 图中四格状态模块数据
const statusStrip = computed(() => {
  const list = dashboardData.value?.deviceStatusList || []

  const uav =
    list.find((d) => d.deviceType === 'UAV') ||
    list.find((d) => d.deviceId?.startsWith('UAV')) ||
    list.find((d) => String(d.deviceName || '').includes('无人机')) ||
    dashboardData.value?.uavLastPosition ||
    {}

  const comm =
    list.find((d) => d.deviceType === 'COMM') ||
    list.find((d) => d.deviceType === 'GATEWAY') ||
    list.find((d) => String(d.deviceId || '').startsWith('COMM')) ||
    list.find((d) => String(d.deviceId || '').startsWith('HACKRF')) ||
    list.find((d) => String(d.deviceName || '').includes('4G')) ||
    list.find((d) => String(d.deviceName || '').includes('频谱')) ||
    list.find((d) => String(d.deviceName || '').includes('网关')) ||
    {}

  let signalText = null
  if (comm.signalLevel != null) {
    signalText =
      comm.signalLevel >= 4
        ? 'strong signal'
        : comm.signalLevel >= 2
        ? 'weak signal'
        : 'no signal'
  } else if (comm.signalStrength != null) {
    const s = Number(comm.signalStrength)
    signalText = s >= 4 ? 'strong signal' : s >= 2 ? 'weak signal' : 'no signal'
  }

  return {
    uavOnline:
      uav.online != null
        ? (uav.online ? `(${uav.batteryLevel ?? '—'}% online)` : '(offline)')
        : '(—)',
    uavOk: !!uav.online,
    signal: signalText != null ? `(${signalText})` : '(—)',
    temperature: uav.temperature != null ? `(${uav.temperature}C)` : '(—)',
    tempWarn: (uav.temperature ?? 0) > 50,
    battery: uav.batteryLevel != null ? `(${uav.batteryLevel}%)` : '(—)',
  }
})

async function loadDashboard() {
  loading.value = true
  loadError.value = ''

  try {
    const [overviewRes, metricsRes] = await Promise.allSettled([
      getDashboardData(),
      getDashboardMetrics(),
    ])

    if (overviewRes.status === 'fulfilled') {
      const parsed = unwrapApiResult(overviewRes.value)
      dashboardData.value = parsed
      console.log('dashboardData =', parsed)
    } else {
      dashboardData.value = null
      console.error('getDashboardData failed:', overviewRes.reason)
    }

    if (metricsRes.status === 'fulfilled') {
      const parsed = unwrapApiResult(metricsRes.value)
      metricsData.value = parsed
      console.log('metricsData =', parsed)
    } else {
      metricsData.value = null
      console.error('getDashboardMetrics failed:', metricsRes.reason)
    }

    if (!dashboardData.value && !metricsData.value) {
      loadError.value = '主页数据加载失败'
    }
  } catch (e) {
    console.error('loadDashboard error =', e)
    dashboardData.value = null
    metricsData.value = null
    loadError.value = e?.message || '主页数据加载失败'
  } finally {
    loading.value = false
  }
}

// 页面加载
onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="dashboard-main">
    <div v-if="loading" class="dashboard-loading">加载中...</div>

    <div v-else-if="loadError" class="dashboard-loading">
      {{ loadError }}
    </div>

    <div v-else-if="!dashboardData" class="dashboard-loading">
      暂无主页数据
    </div>

    <template v-else>
      <div class="module-first">
        <div class="card card-odometer">
          <div class="card-label">累计监测时长（h）</div>
          <div class="card-value">{{ dashboardData.coreMetrics?.totalMonitorHours ?? '—' }}</div>
        </div>
        <div class="card card-flight">
          <div class="card-label">飞行总架次</div>
          <div class="card-value">{{ dashboardData.coreMetrics?.totalFlights ?? '—' }}</div>
        </div>
      </div>

      <div class="panel health-panel">
        <div class="panel-title">核心监测指标</div>
        <div class="gauges-grid">
          <div class="gauge-cell">
            <div class="gauge-semi-needle">
              <svg viewBox="0 0 100 65" class="gauge-svg">
                <defs>
                  <linearGradient id="segGradH1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#1e40af" />
                    <stop offset="25%" stop-color="#22c55e" />
                    <stop offset="50%" stop-color="#eab308" />
                    <stop offset="75%" stop-color="#f97316" />
                    <stop offset="100%" stop-color="#ef4444" />
                  </linearGradient>
                </defs>
                <path
                  class="gauge-arc"
                  d="M 18 52 A 32 32 0 0 1 82 52"
                  fill="none"
                  stroke="url(#segGradH1)"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="22"
                  stroke="#7dd3fc"
                  stroke-width="2"
                  stroke-linecap="round"
                  :transform="`rotate(${pm25NeedleAngle} 50 50)`"
                />
              </svg>
              <span class="gauge-label">PM2.5</span>
            </div>
          </div>

          <div class="gauge-cell">
            <div class="gauge-semi-needle">
              <svg viewBox="0 0 100 65" class="gauge-svg">
                <defs>
                  <linearGradient id="segGradH2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#1e40af" />
                    <stop offset="25%" stop-color="#22c55e" />
                    <stop offset="50%" stop-color="#eab308" />
                    <stop offset="75%" stop-color="#f97316" />
                    <stop offset="100%" stop-color="#ef4444" />
                  </linearGradient>
                </defs>
                <path
                  class="gauge-arc"
                  d="M 18 52 A 32 32 0 0 1 82 52"
                  fill="none"
                  stroke="url(#segGradH2)"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="22"
                  stroke="#7dd3fc"
                  stroke-width="2"
                  stroke-linecap="round"
                  :transform="`rotate(${humNeedleAngle} 50 50)`"
                />
              </svg>
              <span class="gauge-label">湿度</span>
            </div>
          </div>

          <div class="gauge-cell">
            <div class="gauge-semi-fill">
              <svg viewBox="0 0 100 65" class="gauge-svg">
                <path class="gauge-arc-bg" d="M 18 52 A 32 32 0 0 1 82 52" fill="none" />
                <path
                  class="gauge-arc-fill green"
                  d="M 18 52 A 32 32 0 0 1 82 52"
                  fill="none"
                  :stroke-dasharray="arcLength"
                  :stroke-dashoffset="fill1Offset"
                />
              </svg>
              <span class="gauge-label">设备温度</span>
              <span class="gauge-value green">{{ fill1Display }}</span>
              <span class="gauge-subtext">无人机主设备</span>
            </div>
          </div>

          <div class="gauge-cell">
            <div class="gauge-semi-fill">
              <svg viewBox="0 0 100 65" class="gauge-svg">
                <path class="gauge-arc-bg" d="M 18 52 A 32 32 0 0 1 82 52" fill="none" />
                <path
                  class="gauge-arc-fill green"
                  d="M 18 52 A 32 32 0 0 1 82 52"
                  fill="none"
                  :stroke-dasharray="arcLength"
                  :stroke-dashoffset="fill2Offset"
                />
              </svg>
              <span class="gauge-label">信号强度</span>
              <span class="gauge-value green">{{ fill2Display }}</span>
              <span class="gauge-subtext">当前链路状态</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel map-banner">
        <div class="panel-title">区域态势概览</div>
        <div class="map-banner-media">
          <img :src="chinaMapImg" alt="中国区域态势底图" class="map-banner-img" />
        </div>
      </div>

      <div class="module-34">
        <div class="card card-pollution">
          <div class="card-label">今日最高污染 PM2.5（μg/m³）</div>
          <div class="card-value pollution">{{ dashboardData.coreMetrics?.todayMaxPollution ?? '—' }}</div>
          <div class="pollution-time">
            发生于 {{ formatTime(dashboardData.coreMetrics?.todayMaxPollutionTime) }}
          </div>
        </div>

        <div class="card card-air">
          <div class="card-label">空气质量</div>
          <span class="air-quality-tag" :class="'level-' + (dashboardData.coreMetrics?.airQualityLevel || '')">
            {{ dashboardData.coreMetrics?.airQualityLevel ?? '—' }}
          </span>
          <div class="main-pollutant">首要污染物：{{ dashboardData.coreMetrics?.mainPollutant ?? '—' }}</div>
        </div>

        <div class="card card-flights">
          <div class="card-label">今日数据点</div>
          <div class="card-value">{{ dashboardData.coreMetrics?.todayDataPoints ?? '—' }}</div>
        </div>

        <div class="card card-alarm">
          <div class="card-label">未处理告警</div>
          <div class="card-value alarm-num">{{ dashboardData.alarmStatistics?.pendingAlarmCount ?? '—' }}</div>
        </div>
      </div>

      <div class="panel status-strip-panel">
        <div class="status-strip">
          <div class="status-strip-item">
            <div class="status-strip-icon status-strip-icon--uav">
              <svg viewBox="0 0 100 72" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M50 14 L72 32 L72 52 L50 62 L28 52 L28 32 Z" />
                <circle cx="50" cy="42" r="6" />
              </svg>
            </div>
            <span class="status-strip-name">UAV</span>
            <span class="status-strip-value" :class="statusStrip.uavOk ? 'ok' : 'warn'">
              {{ statusStrip.uavOnline }}
            </span>
          </div>

          <div class="status-strip-item">
            <div class="status-strip-icon status-strip-icon--4g">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </div>
            <span class="status-strip-name">4G</span>
            <span class="status-strip-value ok">{{ statusStrip.signal }}</span>
          </div>

          <div class="status-strip-item">
            <div class="status-strip-icon status-strip-icon--temp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
            </div>
            <span class="status-strip-name">Pi Temp</span>
            <span class="status-strip-value" :class="statusStrip.tempWarn ? 'warn' : 'ok'">
              {{ statusStrip.temperature }}
            </span>
          </div>

          <div class="status-strip-item">
            <div class="status-strip-icon status-strip-icon--battery">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="18" height="10" rx="2" />
                <rect x="4" y="9" width="12" height="6" rx="1" fill="currentColor" />
              </svg>
            </div>
            <span class="status-strip-name">Battery</span>
            <span class="status-strip-value ok">{{ statusStrip.battery }}</span>
          </div>
        </div>
      </div>

      <div class="panel position-panel">
        <div class="panel-title">无人机最后位置</div>
        <template v-if="dashboardData.uavLastPosition && (dashboardData.uavLastPosition.longitude != null || dashboardData.uavLastPosition.latitude != null)">
          <div class="position-row">
            <span class="position-label">经度</span>
            <span class="position-value">{{ dashboardData.uavLastPosition.longitude ?? '—' }}</span>
          </div>
          <div class="position-row">
            <span class="position-label">纬度</span>
            <span class="position-value">{{ dashboardData.uavLastPosition.latitude ?? '—' }}</span>
          </div>
          <div class="position-row">
            <span class="position-label">高度</span>
            <span class="position-value">{{ dashboardData.uavLastPosition.altitude ?? '—' }} m</span>
          </div>
          <div class="position-heartbeat">最后心跳 {{ formatTime(lastFlightTime) }}</div>
        </template>
        <div v-else class="position-empty">暂无位置数据</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-loading {
  grid-column: 1 / -1;
  padding: 3rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.dashboard-main {
  height: 100%;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1.5fr 1.5fr 1fr;
  grid-template-rows: auto auto 1fr;
  gap: 1.25rem;
  grid-template-areas:
    "module-first map-banner map-banner module-34"
    "health map-banner map-banner module-34"
    "statusstrip statusstrip position position";
  overflow: auto;
  color: #e0e8f0;
}

.panel {
  background: rgba(12, 18, 32, 0.9);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}

.panel-title {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 0.75rem;
  letter-spacing: 0.02em;
}

.module-first {
  grid-area: module-first;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.map-banner {
  grid-area: map-banner;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.map-banner-media {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 212, 255, 0.18);
  background: rgba(8, 12, 24, 0.55);
  box-shadow: inset 0 0 0 1px rgba(0, 212, 255, 0.05), 0 10px 26px rgba(15, 23, 42, 0.55);
}

.map-banner-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  object-position: center;
  filter: contrast(1.05) saturate(1.05);
  opacity: 0.92;
}

.card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  padding: 1.25rem 1.25rem 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.card-odometer {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.5) 0%, rgba(34, 197, 94, 0.45) 100%);
}

.card-flight {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.5) 0%, rgba(249, 115, 22, 0.45) 100%);
}

.module-34 {
  grid-area: module-34;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-pollution {
  background: rgba(12, 18, 32, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.card-pollution .card-value.pollution {
  color: #ef4444;
}

.card-flights {
  background: rgba(12, 18, 32, 0.95);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.card-flights .card-value.flights {
  color: #22c55e;
}

.card-air .air-quality-tag {
  font-weight: 600;
  margin-right: 0.5rem;
}

.card-air .main-pollutant {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 0.25rem;
}

.air-quality-tag.level-优 { color: #22c55e; }
.air-quality-tag.level-良 { color: #eab308; }
.air-quality-tag.level-轻度污染 { color: #f97316; }
.air-quality-tag.level-中度污染 { color: #ef4444; }
.air-quality-tag.level-重度污染 { color: #dc2626; }
.air-quality-tag.level-严重污染 { color: #991b1b; }

.card-alarm .alarm-num {
  color: #f97316;
}

.pollution-time {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 0.25rem;
}

.position-panel {
  grid-area: position;
}

.position-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.position-label {
  color: rgba(255, 255, 255, 0.7);
}

.position-heartbeat {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.position-empty {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

.status-strip-panel {
  grid-area: statusstrip;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.status-strip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.5rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-strip-icon {
  width: 48px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-strip-icon svg {
  width: 100%;
  height: 100%;
}

.status-strip-icon--uav { color: rgba(0, 212, 255, 0.95); }
.status-strip-icon--4g { color: rgba(0, 212, 255, 0.9); }
.status-strip-icon--temp { color: #ef4444; }
.status-strip-icon--battery { color: #22c55e; }

.status-strip-name {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.status-strip-value {
  font-size: 0.9rem;
}

.status-strip-value.ok { color: #22c55e; }
.status-strip-value.warn { color: #ef4444; }

.card-label {
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
}

.card-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
}

.health-panel {
  grid-area: health;
}

.gauges-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.gauge-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.gauge-semi-needle,
.gauge-semi-fill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.gauge-svg {
  width: 100%;
  max-width: 150px;
  height: auto;
  display: block;
}

.gauge-arc {
  stroke-linecap: round;
}

.gauge-semi-needle .gauge-arc {
  stroke-width: 8;
}

.gauge-arc-bg {
  stroke: rgba(30, 64, 175, 0.6);
  stroke-width: 8;
  stroke-linecap: round;
}

.gauge-arc-fill {
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

.gauge-arc-fill.green {
  stroke: #22c55e;
}

.gauge-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 600;
}

.gauge-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: #eab308;
}

.gauge-subtext {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
}
</style>