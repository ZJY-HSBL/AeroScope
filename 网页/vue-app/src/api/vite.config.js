import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue],
  server: {
    proxy: {
      '/daqijiance': {
        target: 'http://47.97.90.196:8080',
        changeOrigin: true
      }
    }
  }
})