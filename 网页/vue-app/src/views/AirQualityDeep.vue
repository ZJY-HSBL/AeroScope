<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getAirQualityDeepData } from '@/api/airQualityDeep.js'
import { getEnvironmentTrend, getEnvironmentWind } from '@/api/environment.js'

const pageData = ref(null)
const trendData = ref([])
const windData = ref(null)

const windRisk = computed(() => {
  return getWindRiskLevel(windData.value?.windSpeed)
})

const radarRef = ref(null)
const trendRef = ref(null)
const sourceBarRef = ref(null)

let radarChart = null
let trendChart = null
let sourceBarChart = null
let resizeHandler = null

function normalizeWindDirectionText(deg) {
  const d = Number(deg)
  if (Number.isNaN(d)) return '未知'
  if (d >= 337.5 || d < 22.5) return '北风'
  if (d < 67.5) return '东北风'
  if (d < 112.5) return '东风'
  if (d < 157.5) return '东南风'
  if (d < 202.5) return '南风'
  if (d < 247.5) return '西南风'
  if (d < 292.5) return '西风'
  return '西北风'
}

function normalizeWindForUav(speedKmh) {
  const s = Number(speedKmh || 0)

  if (s <= 0) return 0
  if (s <= 10.8) return 20 + (s / 10.8) * 15
  if (s <= 21.6) return 35 + ((s - 10.8) / 10.8) * 25
  if (s <= 28.8) return 60 + ((s - 21.6) / 7.2) * 15
  if (s <= 36) return 75 + ((s - 28.8) / 7.2) * 15
  return 100
}

function buildWindRoseValues(wind) {
  const speed = Number(wind?.windSpeed ?? 0)
  const direction = Number(wind?.windDirection ?? 0)

  const displayStrength = normalizeWindForUav(speed)
  const values = new Array(8).fill(0)

  const norm = ((direction % 360) + 360) % 360
  const idx = Math.floor((norm + 22.5) / 45) % 8

  values[idx] = Math.max(8, displayStrength)
  values[(idx + 1) % 8] = Math.max(values[(idx + 1) % 8], displayStrength * 0.45)
  values[(idx + 7) % 8] = Math.max(values[(idx + 7) % 8], displayStrength * 0.35)
  values[(idx + 2) % 8] = Math.max(values[(idx + 2) % 8], displayStrength * 0.18)
  values[(idx + 6) % 8] = Math.max(values[(idx + 6) % 8], displayStrength * 0.15)

  return values.map(v => Number(v.toFixed(2)))
}
function getWindRiskLevel(speedKmh) {
  const s = Number(speedKmh ?? 0)

  if (s < 15) {
    return {
      key: 'normal',
      label: '正常',
      desc: '风速较低，适宜飞行',
    }
  }

  if (s < 25) {
    return {
      key: 'warning',
      label: '警告',
      desc: '风速偏高，注意航迹偏移',
    }
  }

  return {
    key: 'danger',
    label: '报警',
    desc: '风速过高，建议谨慎或暂停飞行',
  }
}

// ✅ 精简污染因子：仅保留 PM2.5 / PM10 / TVOC / 甲醛
function buildPollutionSourceData(list) {
  if (!Array.isArray(list) || !list.length) {
    return [
      { name: 'PM2.5', value: 0 },
      { name: 'PM10', value: 0 },
      { name: 'TVOC', value: 0 },
      { name: '甲醛', value: 0 },
    ]
  }

  const latest = list[list.length - 1] || {}

  const raw = [
    { name: 'PM2.5', value: Number(latest.pm25 ?? 0) },
    { name: 'PM10', value: Number(latest.pm10 ?? 0) },
    { name: 'TVOC', value: Number(latest.tvoc ?? 0) },
    { name: '甲醛', value: Number(latest.formaldehyde ?? 0) },
  ]

  const total = raw.reduce((sum, item) => sum + Math.max(0, item.value), 0)

  if (total <= 0) {
    return raw.map(item => ({ ...item, percent: 0 }))
  }

  return raw.map(item => ({
    ...item,
    percent: Number(((Math.max(0, item.value) / total) * 100).toFixed(1)),
  }))
}

function initRadar() {
  if (!radarRef.value) return

  if (!radarChart) {
    radarChart = echarts.init(radarRef.value)
  }

  const wind = windData.value || {}
  const roseValues = buildWindRoseValues(wind)

const option = {
  backgroundColor: 'transparent',

  angleAxis: {
    type: 'category',
    data: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    startAngle: 112.5,
    clockwise: true,
    boundaryGap: true,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'rgba(226,232,240,0.9)',
      fontSize: 12,
      margin: 14,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: 'rgba(148,163,184,0.22)',
        width: 1,
      },
    },
  },

  radiusAxis: {
    min: 0,
    max: 100,
    interval: 20,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: {
      show: true,
      lineStyle: {
        color: 'rgba(148,163,184,0.25)',
        width: 1,
      },
    },
  },

  polar: {
    radius: '68%',
    center: ['40%', '52%'],
  },


  series: [
    {
      type: 'bar',
      coordinateSystem: 'polar',
      roundCap: true,
      barWidth: 24,
      data: roseValues,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
          { offset: 0, color: '#38bdf8' },
          { offset: 1, color: '#22c55e' },
        ]),
      },
    },
  ],
}

  radarChart.setOption(option)
}

// ✅ 柱状图渐变色：绿→黄→红（安全→危险）
function initSourceBar() {
  if (!sourceBarRef.value) return

  const dom = sourceBarRef.value
  sourceBarChart = echarts.getInstanceByDom(dom) || echarts.init(dom)

  const sourceData = buildPollutionSourceData(trendData.value)
  const names = sourceData.map(item => item.name)
  const percents = sourceData.map(item => item.percent ?? 0)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params?.[0]
        if (!p) return ''
        return `${p.name}<br/>占比：${p.value}%`
      },
    },
    grid: {
      left: 70,
      right: 30,
      top: 20,
      bottom: 20,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: 'rgba(148,163,184,0.12)' },
      },
      axisLabel: {
        color: 'rgba(226,232,240,0.7)',
        formatter: '{value}%',
      },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(226,232,240,0.9)',
        fontSize: 13,
      },
    },
    series: [
      {
        type: 'bar',
        data: percents,
        barWidth: 14,
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
        },
        itemStyle: {
          borderRadius: 8,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#22c55e' },  // 绿色（安全）
            { offset: 0.5, color: '#eab308' }, // 黄色（中等）
            { offset: 1, color: '#ef4444' },  // 红色（危险）
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: '#e2e8f0',
          formatter: '{c}%',
        },
      },
    ],
  }

  sourceBarChart.setOption(option)
}

function initTrend() {
  if (!trendRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendRef.value)
  }

  const list = Array.isArray(trendData.value) ? trendData.value : []
  const labels = list.map(item => {
    const t = item?.time || item?.timestamp || ''
    return t ? String(t).slice(11, 16) : ''
  })

  const pm25Data = list.map(item => Number(item?.pm25 ?? 0))
  const pm10Data = list.map(item => Number(item?.pm10 ?? 0))
  const tempData = list.map(item => Number(item?.temperature ?? 0))
  const humData = list.map(item => Number(item?.humidity ?? 0))
  const tvocData = list.map(item => Number(item?.tvoc ?? 0))
  const hchoData = list.map(item => Number(item?.formaldehyde ?? 0))

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: 'rgba(226,232,240,0.85)' },
      data: ['PM2.5', 'PM10', '温度', '湿度', 'TVOC', '甲醛'],
    },
    grid: [
      { left: 48, right: 24, top: 42, height: '38%' },
      { left: 48, right: 24, top: '60%', height: '26%' },
    ],
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.35)' } },
        axisLabel: { color: 'rgba(226,232,240,0.75)' },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: labels,
        axisLabel: { color: 'rgba(226,232,240,0.75)' },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '浓度/温度',
        nameTextStyle: { color: 'rgba(226,232,240,0.7)' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
        axisLabel: { color: 'rgba(226,232,240,0.75)' },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '柱状',
        nameTextStyle: { color: 'rgba(226,232,240,0.7)' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
        axisLabel: { color: 'rgba(226,232,240,0.75)' },
      },
    ],
    series: [
      {
        name: 'PM2.5',
        type: 'line',
        smooth: true,
        data: pm25Data,
        lineStyle: { color: '#f97316', width: 2 },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: 'PM10',
        type: 'line',
        smooth: true,
        data: pm10Data,
        lineStyle: { color: '#22c55e', width: 2 },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: '温度',
        type: 'line',
        smooth: true,
        data: tempData,
        lineStyle: { color: '#e5e7eb', width: 1.5, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 3,
      },
      {
        name: '湿度',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: humData,
        itemStyle: { color: '#38bdf8', borderRadius: [3, 3, 0, 0] },
        barWidth: 10,
      },
      {
        name: 'TVOC',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: tvocData,
        itemStyle: { color: '#eab308', borderRadius: [3, 3, 0, 0] },
        barWidth: 10,
      },
      {
        name: '甲醛',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: hchoData,
        itemStyle: { color: '#22c55e', borderRadius: [3, 3, 0, 0] },
        barWidth: 10,
      },
    ],
  }

  trendChart.setOption(option)
}

function initCharts() {
  nextTick(() => {
    initRadar()
    initSourceBar()
    initTrend()
    if (!resizeHandler) {
      resizeHandler = () => {
        radarChart && radarChart.resize()
        sourceBarChart && sourceBarChart.resize()
        trendChart && trendChart.resize()
      }
      window.addEventListener('resize', resizeHandler)
    }
  })
}

onMounted(async () => {
  const [data, list, wind] = await Promise.all([
    getAirQualityDeepData(),
    getEnvironmentTrend().catch(() => []),
    getEnvironmentWind().catch(() => ({})),
  ])

  pageData.value = data
  trendData.value = list ?? []
  windData.value = wind ?? {}
  initCharts()
})

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (radarChart) {
    radarChart.dispose()
    radarChart = null
  }
  if (sourceBarChart) {
    sourceBarChart.dispose()
    sourceBarChart = null
  }
  if (trendChart) {
    trendChart.dispose()
    trendChart = null
  }
})
</script>

<template>
  <div class="air-quality-page">
    <div v-if="!pageData" class="loading">加载中...</div>
    <template v-else>
      <div class="top-row">
        <div class="video-card">
          <div class="video-header">
            <span class="video-title">污染因子占比</span>
          </div>
          <div ref="sourceBarRef" class="source-bar-chart" />
          <div class="video-caption">
            基于最新监测值的污染因子占比分析
          </div>
        </div>

        <div class="wind-card">
          <div class="wind-header">
            <span class="wind-title">风玫瑰图</span>
          </div>
          <div ref="radarRef" class="wind-chart" />
          <div class="wind-meta">
            <div>风速: {{ windData?.windSpeed ?? '--' }} km/h</div>
            <div>风向: {{ windData?.windDirectionText || normalizeWindDirectionText(windData?.windDirection) }}</div>

            <div class="wind-feedback" :class="`wind-feedback--${windRisk.key}`">
              <div class="wind-feedback__title">
                风场状态：{{ windRisk.label }}
              </div>
              <div class="wind-feedback__desc">
                {{ windRisk.desc }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-row">
        <div class="bottom-header">
          <span class="bottom-title">实时空气质量趋势</span>
        </div>
        <div ref="trendRef" class="trend-chart" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.video-title {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.04em;
}

.source-bar-chart {
  width: 100%;
  height: 260px;
}

.wind-feedback {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(6px);
}

.wind-feedback__title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.wind-feedback__desc {
  font-size: 0.88rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
}

.wind-feedback--normal {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.22) 0%, rgba(34, 197, 94, 0.28) 100%);
  border-color: rgba(74, 222, 128, 0.28);
}

.wind-feedback--normal .wind-feedback__title {
  color: #86efac;
}

.wind-feedback--warning {
  background: linear-gradient(135deg, rgba(252, 211, 77, 0.2) 0%, rgba(245, 158, 11, 0.28) 100%);
  border-color: rgba(251, 191, 36, 0.28);
}

.wind-feedback--warning .wind-feedback__title {
  color: #fcd34d;
}

.wind-feedback--danger {
  background: linear-gradient(135deg, rgba(251, 113, 133, 0.2) 0%, rgba(239, 68, 68, 0.3) 100%);
  border-color: rgba(248, 113, 113, 0.3);
}

.wind-feedback--danger .wind-feedback__title {
  color: #fda4af;
}

.air-quality-page {
  padding: 1.5rem;
  min-height: 100%;
  background: #0a0e1a;
  color: #e0e8f0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading {
  padding: 3rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.page-title {
  margin: 0 0 1.25rem;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #ffffff;
}

.top-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
  flex: 0 0 32%;
}

.video-card,
.wind-card {
  background: rgba(8, 12, 24, 0.8);
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.24);
  padding: 1rem 1.1rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.7);
}

.wind-card {
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 2fr 1.1fr;
  grid-template-areas:
    'wind-header wind-header'
    'wind-chart wind-meta';
  column-gap: 1rem;
}

.video-caption {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.9);
}

.wind-header {
  grid-area: wind-header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.wind-title {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(244, 244, 245, 0.95);
}

.wind-chart {
  grid-area: wind-chart;
  width: 100%;
  height: 210px;
}

.wind-meta {
  grid-area: wind-meta;
  align-self: center;
  margin-top: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(243, 244, 246, 0.95);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  line-height: 1.6;
}

.wind-meta div {
  white-space: nowrap;
}

.bottom-row {
  background: rgba(8, 12, 24, 0.8);
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.24);
  padding: 1rem 1.2rem 1.3rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.7);
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.bottom-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.6rem;
}

.bottom-title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(248, 250, 252, 0.95);
}

.trend-chart {
  width: 100%;
  flex: 1;
  min-height: 320px;
}

@media (max-width: 1024px) {
  .top-row {
    grid-template-columns: 1fr;
  }
}
</style>