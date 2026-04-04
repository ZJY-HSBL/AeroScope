import { BASE_URL, handleResponse, request } from './request.js'

/** 仪表盘数据接口：GET /dashboard/overview，返回 { coreMetrics, deviceStatusList, uavLastPosition, alarmStatistics } */
export function getDashboardData() {
  return request(`${BASE_URL}/dashboard/overview`, { method: 'GET' }).then(handleResponse)
}

/**
 * 核心指标接口：GET /dashboard/metrics，用于首页城市健康指数等
 * 返回 { cityHealthIndex, todayMaxPollution, todayMaxPollutionTime, totalFlights, ... }
 * 兼容 { error, body, message } 或 { code: 200, data: {} }
 */
export function getDashboardMetrics() {
  return request(`${BASE_URL}/dashboard/metrics`, { method: 'GET' }).then((raw) => {
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
