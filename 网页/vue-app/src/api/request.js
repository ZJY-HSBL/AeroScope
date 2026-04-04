export const BASE_URL = '/daqijiance'
export const TOKEN_KEY = 'token'

export function handleResponse(res) {
  const { error = 0, body = null, message = '' } = res || {}
  if (error === 0) return Promise.resolve(body)
  if (error === 401) return Promise.reject(new Error('未授权，需要登录'))
  if (error === 500) return Promise.reject(new Error(message || '系统异常'))
  return Promise.reject(new Error(message || '请求失败'))
}

export function request(url, options = {}) {
  const method = options.method || 'GET'
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-API-Key': 'daqijiance-api-key-2024-for-testing-only',
    ...(token ? { Authorization: `Bearer ${token}`, auth: token } : {}),
    ...options.headers,
  }

  const body =
    method === 'GET'
      ? undefined
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : '{}'

  return fetch(url, {
    ...options,
    method,
    headers,
    body,
  }).then(async (r) => {
    const text = await r.text()
    if (!text) {
      if (!r.ok) return Promise.reject(new Error(`请求失败 HTTP ${r.status}`))
      return {}
    }

    let json
    try {
      json = JSON.parse(text)
    } catch {
      return Promise.reject(new Error(!r.ok ? `请求失败 HTTP ${r.status}` : '服务器返回非 JSON'))
    }

    if (!r.ok) {
      const msg =
        json?.message ||
        json?.msg ||
        json?.error_description ||
        (typeof json?.error === 'string' ? json.error : null) ||
        `HTTP ${r.status}`
      return Promise.reject(new Error(String(msg)))
    }

    return json
  })
}