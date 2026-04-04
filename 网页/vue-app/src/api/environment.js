import { BASE_URL, request } from './request.js'

/**
 * 环境趋势数据：GET /environment/trend
 * 返回格式：数组，每项 { time, stationId, pm25, pm10, tvoc, formaldehyde, temperature, humidity }
 * 兼容后端 { error, body, message } 或文档格式 { code: 200, data: [] }
 * @param {Object} params - 可选 query：stationId, startTime, endTime
 */
export function getEnvironmentTrend(params = {}) {
  const search = new URLSearchParams()
  if (params.stationId != null) search.set('stationId', params.stationId)
  if (params.startTime) search.set('startTime', params.startTime)
  if (params.endTime) search.set('endTime', params.endTime)

  const qs = search.toString()
  const url = `${BASE_URL}/environment/trend` + (qs ? `?${qs}` : '')

  return request(url, { method: 'GET' }).then((raw) => {
    if (raw?.error !== undefined && raw?.error !== 0) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    if (raw?.code !== undefined && raw?.code !== 200) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    const data = raw?.body ?? raw?.data
    return Array.isArray(data) ? data : []
  })
}

/**
 * 风场数据：GET /environment/wind
 * 返回格式：{ windSpeed, windDirection, windDirectionText, uavHeading, measureTime }
 * 兼容后端 { error, body, message } 或文档格式 { code: 200, data: {} }
 * @param {Object} params - 可选 query：stationId
 */
export function getEnvironmentWind(params = {}) {
  const search = new URLSearchParams()
  if (params.stationId != null) search.set('stationId', params.stationId)

  const qs = search.toString()
  const url = `${BASE_URL}/environment/wind` + (qs ? `?${qs}` : '')

  return request(url, { method: 'GET' }).then((raw) => {
    if (raw?.error !== undefined && raw?.error !== 0) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    if (raw?.code !== undefined && raw?.code !== 200) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    const data = raw?.body ?? raw?.data
    return data != null ? data : {}
  })
}