<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logout as apiLogout } from '@/api/auth.js'
import { TOKEN_KEY } from '@/api/request.js'

const route = useRoute()
const router = useRouter()
const pageTitle = computed(() => route.meta?.title ?? 'AeroScope')

async function logout() {
  try {
    await apiLogout()
  } catch (_) {
    // 忽略接口失败，仍清除本地并跳转
  }
  localStorage.removeItem(TOKEN_KEY)
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">
    <header class="layout-header">
      <h1 class="header-title">{{ pageTitle }}</h1>
    </header>
    <aside class="layout-sidebar">
      <h2 class="sidebar-title">AeroScope</h2>
      <nav class="nav">
        <router-link to="/dashboard" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
          </span>
          <span class="nav-text">主页</span>
        </router-link>

        <router-link to="/air-quality-deep" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M4 12h16M12 4v16"/></svg>
          </span>
          <span class="nav-text">空气检测</span>
        </router-link>

        <router-link to="/uav-track" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19c4-8 8-12 16-14"/>
              <path d="M4 5c4 8 8 12 16 14"/>
              <circle cx="18" cy="5" r="1.5"/>
              <circle cx="18" cy="19" r="1.5"/>
              <circle cx="4" cy="12" r="1.5"/>
            </svg>
          </span>
          <span class="nav-text">无人机轨迹</span>
        </router-link>

        <router-link to="/spectrum-waterfall" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19V5M4 12h4l3-6 4 12 3-6h6"/>
            </svg>
          </span>
          <span class="nav-text">频谱瀑布图</span>
        </router-link>

        <router-link to="/ops-maintenance" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </span>
          <span class="nav-text">设备列表</span>
        </router-link>
      </nav>

      <button type="button" class="nav-item nav-logout" @click="logout">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </span>
        <span class="nav-text">退出登录</span>
      </button>
    </aside>
    <main class="layout-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  background: #0a0e1a;
  color: #e0e8f0;
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas: "layout-sidebar layout-header" "layout-sidebar layout-main";
  overflow: hidden;
}

.layout-header {
  grid-area: layout-header;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(0, 212, 255, 0.15);
}

.header-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #fff;
}

.layout-sidebar {
  grid-area: layout-sidebar;
  display: flex;
  flex-direction: column;
  background: rgba(8, 12, 24, 0.95);
  border-right: 1px solid rgba(0, 212, 255, 0.12);
}

.sidebar-title {
  margin: 0;
  padding: 1.25rem 1rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #fff;
  text-align: center;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.nav-logout {
  margin-top: auto;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.nav-logout:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(239, 68, 68, 0.15);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
}

.nav-item:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 212, 255, 0.06);
}

.nav-item.active {
  background: rgba(0, 212, 255, 0.18) !important;
  color: #e0e8f0 !important;
  border-left: 3px solid rgba(0, 212, 255, 0.9);
  padding-left: calc(1rem - 3px);
}
.nav-item.active .nav-icon {
  color: rgba(0, 212, 255, 0.95);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-icon svg {
  width: 100%;
  height: 100%;
}

.layout-main {
  grid-area: layout-main;
  overflow: auto;
  min-height: 0;
}
</style>