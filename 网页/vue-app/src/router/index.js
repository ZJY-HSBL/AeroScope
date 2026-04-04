import { createRouter, createWebHistory } from 'vue-router'
import { TOKEN_KEY } from '@/api/request.js'
import Login from '../views/Login.vue'
import MainLayout from '../layouts/MainLayout.vue'
import Dashboard from '../views/Dashboard.vue'
import OpsMaintenance from '../views/OpsMaintenance.vue'
import AirQualityDeep from '../views/AirQualityDeep.vue'
import UavTrack from '../views/UavTrack.vue'
import SpectrumWaterfall from '../views/SpectrumWaterfall.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: Dashboard,
        meta: { title: '主页' },
      },
      {
        path: 'air-quality-deep',
        name: 'airQualityDeep',
        component: AirQualityDeep,
        meta: { title: '空气检测' },
      },
      {
        path: 'ops-maintenance',
        name: 'opsMaintenance',
        component: OpsMaintenance,
        meta: { title: '设备列表' },
      },
      {
        path: 'uav-track',
        name: 'uavTrack',
        component: UavTrack,
        meta: { title: '无人机轨迹' },
      },
      {
        path: 'spectrum-waterfall',
        name: 'spectrumWaterfall',
        component: SpectrumWaterfall,
        meta: { title: '频谱瀑布图' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const hasToken = typeof localStorage !== 'undefined' && localStorage.getItem(TOKEN_KEY)
  const isLoginPage = to.name === 'login'
  if (!isLoginPage && !hasToken) {
    next({ name: 'login' })
    return
  }
  if (isLoginPage && hasToken) {
    next({ name: 'dashboard' })
    return
  }
  document.title = to.meta?.title ? `${to.meta.title} - UAV 监测系统` : 'UAV 监测系统'
  next()
})

export default router
