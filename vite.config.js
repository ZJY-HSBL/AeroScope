import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // 请求 /daqijiance/auth/login 会转发到 http://localhost:8081/daqijiance/auth/login
      '/daqijiance': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
        // 将 Origin 改为与 target 一致，避免 Spring 等后端拒绝来自 localhost 的 WS 握手
        rewriteWsOrigin: true,
        // WS 握手阶段从 query 提取 token，并转为后端要求的鉴权请求头
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq, req) => {
            try {
              const parsed = new URL(req.url || '', 'http://localhost')
              const token = parsed.searchParams.get('token')
              if (!token) return
              proxyReq.setHeader('authorization', `Bearer ${token}`)
              proxyReq.setHeader('auth', token)
            } catch {
              // URL 解析失败时保持默认透传
            }
          })
        },
      },
    },
  },
})
