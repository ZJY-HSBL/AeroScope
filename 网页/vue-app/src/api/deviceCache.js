/**
 * 设备状态列表缓存：供 /dashboard/overview 写入、ops-maintenance 等页面读取
 * 缓存为内存存储，刷新页面后需重新拉取 dashboard 数据
 */

/** @type {Array<{ deviceId: string, deviceName: string, deviceType: string, model: string, online: boolean, [key: string]: unknown }>} */
let deviceStatusListCache = []

/** 写入设备状态列表（由 dashboard 拉取 overview 后调用） */
export function setDeviceStatusList(list) {
  deviceStatusListCache = Array.isArray(list) ? [...list] : []
}

/** 读取缓存的设备状态列表 */
export function getDeviceStatusList() {
  return deviceStatusListCache
}

/** 判断是否有可用缓存（列表非空） */
export function hasDeviceStatusListCache() {
  return deviceStatusListCache.length > 0
}
