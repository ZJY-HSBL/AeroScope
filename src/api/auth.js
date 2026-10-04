import { BASE_URL, handleResponse, request } from './request.js'

/** 登录接口：调用真实后端 /auth/login，后端返回旧格式 { error, body, message } */
export function login(username, password) {
  return request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: { username, password },
  }).then(handleResponse)
}

/** 退出登录接口：调用真实后端 /auth/logout */
export function logout() {
  return request(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    body: {},
  })
}
