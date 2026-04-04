import { BASE_URL, request } from './request.js'
import { mockUavTrackData, mockPollutionHeatmap } from '@/mock/uavTrack.js'

// 环境变量开关：VITE_USE_MOCK_UAV_TRACK=true 时使用 Mock，否则默认走后端接口
const USE_MOCK_UAV_TRACK = String(import.meta.env.VITE_USE_MOCK_UAV_TRACK || '').toLowerCase() === 'true'
/**
 * 兼容：{ error, body, message }、{ code, data }，以及 body/data 内再包一层 data
 * @param {Record<string, unknown>} raw
 */
function normalizeFlightPathResponse(raw) {
  if (raw == null) return Promise.reject(new Error('空响应'))
  // 项目标准：{ error, message, body }；error 在部分环境下可能为字符串 "0"
  if (raw.error !== undefined && raw.error !== null) {
    const errNum = Number(raw.error)
    if (!Number.isNaN(errNum)) {
      if (errNum === 0) {
        const body = raw.body ?? raw.data
        return body != null ? body : {}
      }
      if (errNum === 401) return Promise.reject(new Error('未授权，需要登录'))
      if (errNum === 500) return Promise.reject(new Error(raw.message || '系统异常'))
      return Promise.reject(new Error(raw.message || '请求失败'))
    }
  }
  if (raw.code !== undefined) {
    if (Number(raw.code) === 200) return raw.data
    return Promise.reject(new Error(raw.message || raw.msg || `请求失败 (${raw.code})`))
  }
  // 后端直接返回业务 JSON（无 error/code 包裹），例如 { taskId, flightPath, heatmap }
  if (Array.isArray(raw)) {
    return raw
  }
  if (typeof raw === 'object') {
    if (
      Array.isArray(raw.flightPath) ||
      Array.isArray(raw.flight_path) ||
      raw.heatmap != null ||
      raw.heat_map != null
    ) {
      return raw
    }
  }
  return Promise.reject(new Error('无法解析接口返回'))
}

/**
 * 将后端各种嵌套结构摊平为 { taskId, flightPath[], heatmap{} }
 * 支持：camelCase / snake_case、body 内再包 data
 */
function extractVisualizePayload(raw) {
  if (raw == null || typeof raw !== 'object') {
    return { taskId: null, flightPath: [], heatmap: {} }
  }
  let p = raw
  const inner = p.data
  if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
    const hasVisual =
      Array.isArray(inner.flightPath) ||
      Array.isArray(inner.flight_path) ||
      inner.heatmap != null ||
      inner.heat_map != null ||
      Array.isArray(inner.gridPoints) ||
      Array.isArray(inner.grid_points)
    if (hasVisual) p = inner
  }
  const flightPath = p.flightPath ?? p.flight_path ?? []
  const heatmap = p.heatmap ?? p.heat_map ?? {}
  return {
    taskId: p.taskId ?? p.task_id ?? raw.taskId ?? raw.task_id ?? null,
    flightPath: Array.isArray(flightPath) ? flightPath : [],
    heatmap: heatmap && typeof heatmap === 'object' ? heatmap : {},
  }
}

function buildQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  return q.toString()
}

/**
 * 获取完整可视化数据（轨迹 + 热力图），见《uav-flight-path-api.md》
 * GET /uav/flight/visualize；若失败则回退为 path + heatmap 两次请求
 */
export async function getUavFlightVisualize(params) {
  if (USE_MOCK_UAV_TRACK) {
    return Promise.resolve({
      taskId: params.taskId ?? 'TASK-001',
      flightPath: mockUavTrackData.flightPath ?? [],
      heatmap: mockPollutionHeatmap.heatmap ?? {},
    })
  }
  const qs = buildQuery({
    taskId: params.taskId,
    longitude: params.longitude,
    latitude: params.latitude,
    radius: params.radius,
  })
  const url = `${BASE_URL}/uav/flight/visualize?${qs}`
  let firstErr = null
  try {
    const raw = await request(url, { method: 'GET' }).then(normalizeFlightPathResponse)
    const out = extractVisualizePayload(raw)
    const hasPath = out.flightPath.length > 0
    const grid = out.heatmap?.gridPoints ?? out.heatmap?.grid_points
    const hasHeat = Array.isArray(grid) && grid.length > 0
    if (hasPath || hasHeat) return out
  } catch (e) {
    firstErr = e
  }

  const [pathRaw, heatRaw] = await Promise.all([
    request(`${BASE_URL}/uav/flight/path?${buildQuery({ taskId: params.taskId })}`, {
      method: 'GET',
    })
      .then(normalizeFlightPathResponse)
      .catch(() => null),
    request(`${BASE_URL}/uav/flight/heatmap?${qs}`, { method: 'GET' })
      .then(normalizeFlightPathResponse)
      .catch(() => null),
  ])

  const pathArr = Array.isArray(pathRaw)
    ? pathRaw
    : pathRaw?.flightPath ?? pathRaw?.flight_path ?? pathRaw?.points ?? []
  const heatObj =
    heatRaw && typeof heatRaw === 'object' && !Array.isArray(heatRaw)
      ? heatRaw
      : { gridPoints: [] }
  const g2 = heatObj.gridPoints ?? heatObj.grid_points
  const mergedPath = Array.isArray(pathArr) ? pathArr : []
  const hasAny = mergedPath.length > 0 || (Array.isArray(g2) && g2.length > 0)
  if (!hasAny) {
    throw firstErr instanceof Error
      ? firstErr
      : new Error('未获取到轨迹或热力图数据，请检查 taskId 与接口路径')
  }
  return {
    taskId: params.taskId,
    flightPath: mergedPath,
    heatmap: heatObj,
  }
}

/**
 * GET /uav/flight/path
 * @param {{ taskId: string }} params
 */
export function getUavFlightPath(params) {
  if (USE_MOCK_UAV_TRACK) {
    return Promise.resolve(mockUavTrackData.flightPath ?? [])
  }
  const qs = buildQuery({ taskId: params.taskId })
  return request(`${BASE_URL}/uav/flight/path?${qs}`, { method: 'GET' }).then(normalizeFlightPathResponse)
}

/**
 * GET /uav/flight/heatmap
 * @param {{ taskId: string, longitude: number|string, latitude: number|string, radius?: number|string }} params
 */
export function getUavFlightHeatmap(params) {
  if (USE_MOCK_UAV_TRACK) {
    return Promise.resolve(mockPollutionHeatmap.heatmap ?? {})
  }
  const qs = buildQuery({
    taskId: params.taskId,
    longitude: params.longitude,
    latitude: params.latitude,
    radius: params.radius,
  })
  return request(`${BASE_URL}/uav/flight/heatmap?${qs}`, { method: 'GET' }).then(normalizeFlightPathResponse)
}

/** 将 visualize 的 flightPath 转为地图组件使用的点列表 */
export function mapFlightPathToPoints(flightPath) {
  if (!Array.isArray(flightPath)) return []
  return flightPath.map((p) => ({
    taskId: p.taskId ?? p.task_id,
    longitude: Number(p.longitude ?? p.lng),
    latitude: Number(p.latitude ?? p.lat),
    altitude: p.altitude != null ? Number(p.altitude) : undefined,
    speed: p.speed != null ? Number(p.speed) : undefined,
    concentration: p.concentration != null ? Number(p.concentration) : undefined,
    pollutionLevel: p.pollutionLevel ?? p.pollution_level,
    colorCode: typeof p.colorCode === 'string' ? p.colorCode : typeof p.color_code === 'string' ? p.color_code : '#22d3ee',
    time: p.timestamp ?? p.time,
    stepNumber: p.stepNumber ?? p.step_number,
  }))
}

/** 将 heatmap.gridPoints 转为 leaflet.heat 用的 { latitude, longitude, intensity } */
export function mapHeatmapToPoints(heatmap) {
  const grid = heatmap?.gridPoints ?? heatmap?.grid_points
  if (!Array.isArray(grid)) return { points: [], minConcentration: 0, maxConcentration: 1 }
  const minC = Number(heatmap.minConcentration ?? heatmap.min_concentration ?? 0)
  const maxC = Number(heatmap.maxConcentration ?? heatmap.max_concentration ?? 1)
  const range = maxC - minC || 1
  const points = grid.map((gp) => {
    const lat = gp.latitude ?? gp.lat
    const lng = gp.longitude ?? gp.lng
    const w = gp.weight != null ? Number(gp.weight) : null
    const conc = Number(gp.concentration ?? gp.value ?? 0)
    const intensity =
      w != null && !Number.isNaN(w)
        ? Math.max(0, Math.min(1, w))
        : Math.max(0, Math.min(1, (conc - minC) / range))
    return {
      longitude: Number(lng),
      latitude: Number(lat),
      intensity,
      concentration: gp.concentration,
      colorCode: gp.colorCode ?? gp.color_code,
    }
  })
  return {
    points,
    minConcentration: minC,
    maxConcentration: maxC,
    avgConcentration: heatmap.avgConcentration ?? heatmap.avg_concentration,
    colorMapping: heatmap.colorMapping ?? heatmap.color_mapping,
  }
}
