import { BASE_URL, handleResponse, request } from './request.js'

/** 设备状态列表：GET /device/status/list，返回设备列表（数组） */
export function getDeviceStatusList() {
  return request(`${BASE_URL}/device/status/list`, { method: 'GET' })
    .then(handleResponse)
    .then((body) => (Array.isArray(body) ? body : (body?.list ?? [])))
}

/** 远程重启所有传感器：开发阶段走 Mock */
export function remoteRestartAllSensors() {
  return Promise.resolve({ error: 0, body: { success: true }, message: '' }).then(handleResponse)
}
