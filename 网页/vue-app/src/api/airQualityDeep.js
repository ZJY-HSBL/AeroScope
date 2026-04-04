import { BASE_URL, request } from './request.js'

/** 空气质量深度展示：获取最新监测数据 */
export function getAirQualityDeepData() {
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

