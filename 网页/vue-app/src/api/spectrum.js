import { BASE_URL, request } from './request.js'

export function getSpectrumRealtime(params = {}) {
  const search = new URLSearchParams()
  if (params.centerFreq != null) search.set('centerFreq', params.centerFreq)
  if (params.bandwidth != null) search.set('bandwidth', params.bandwidth)

  const qs = search.toString()
  const url = `${BASE_URL}/spectrum/realtime` + (qs ? `?${qs}` : '')

  return request(url, { method: 'GET' }).then((raw) => {
    if (raw?.error !== undefined && raw?.error !== 0) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    if (raw?.code !== undefined && raw?.code !== 200) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    return raw?.body ?? raw?.data ?? {}
  })
}

export function getSpectrumWaterfall(params = {}) {
  const search = new URLSearchParams()
  if (params.startFreq != null) search.set('startFreq', params.startFreq)
  if (params.endFreq != null) search.set('endFreq', params.endFreq)
  if (params.startTime) search.set('startTime', params.startTime)
  if (params.endTime) search.set('endTime', params.endTime)

  const qs = search.toString()
  const url = `${BASE_URL}/spectrum/waterfall` + (qs ? `?${qs}` : '')

  return request(url, { method: 'GET' }).then((raw) => {
    if (raw?.error !== undefined && raw?.error !== 0) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    if (raw?.code !== undefined && raw?.code !== 200) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    return raw?.body ?? raw?.data ?? []
  })
}

export function getSpectrumAlarms(params = {}) {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)

  const qs = search.toString()
  const url = `${BASE_URL}/spectrum/alarms` + (qs ? `?${qs}` : '')

  return request(url, { method: 'GET' }).then((raw) => {
    if (raw?.error !== undefined && raw?.error !== 0) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    if (raw?.code !== undefined && raw?.code !== 200) {
      return Promise.reject(new Error(raw?.message || '请求失败'))
    }
    return raw?.body ?? raw?.data ?? []
  })
}