/** 登录 Mock：返回与后端一致的 { error, body, message } */
export function mockLogin(account, password) {
  return {
    error: 0,
    body: { token: 'mock-token-' + Date.now() },
    message: '',
  }
}
