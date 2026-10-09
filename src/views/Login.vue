<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login } from '@/api/auth.js'
import { TOKEN_KEY } from '@/api/request.js'

const router = useRouter()
const account = ref('')
const password = ref('')
const loading = ref(false)
const canvasRef = ref(null)
let animationId = null
let particles = []
const PARTICLE_COUNT = 120

// 初始化登录页背景的漂浮粒子（根据窗口大小生成随机点）
function initParticles() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = window.innerHeight + 'px'
  ctx.scale(dpr, dpr)

  const W = window.innerWidth
  const H = window.innerHeight
  particles = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: -(Math.random() * 0.4 + 0.1),
      vy: -(Math.random() * 0.8 + 0.3),
      r: Math.random() * 1.2 + 0.4,
      alpha: Math.random() * 0.5 + 0.4,
    })
  }
}

// 粒子动画循环：更新位置并绘制霓虹小点尾迹
function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = window.innerWidth
  const H = window.innerHeight

  ctx.fillStyle = 'rgba(8, 12, 24, 0.15)'
  ctx.fillRect(0, 0, W, H)

  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < -10) p.x = W + 5
    if (p.x > W + 10) p.x = -5
    if (p.y < -10) p.y = H + 5
    if (p.y > H + 10) p.y = -5

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`
    ctx.fill()
  }

  animationId = requestAnimationFrame(animate)
}

// 窗口尺寸变化时重建粒子画布
function handleResize() {
  initParticles()
}

// 登录表单提交：调用登录 API 并跳转到仪表盘
function handleSubmit() {
  if (!account.value.trim()) {
    ElMessage.error('请输入账户')
    return
  }
  if (!password.value) {
    ElMessage.error('请输入密码')
    return
  }
  loading.value = true
  login(account.value.trim(), password.value)
    .then((body) => {
      if (body?.token) localStorage.setItem(TOKEN_KEY, body.token)
      ElMessage.success('登录成功')
      router.push({ name: 'dashboard' })
    })
    .catch((e) => {
      ElMessage.error(e?.message || '登录失败')
    })
    .finally(() => {
      loading.value = false
    })
}

// 进入页面时启动粒子背景动画并监听窗口尺寸
onMounted(() => {
  initParticles()
  animate()
  window.addEventListener('resize', handleResize)
})

// 离开页面时清理动画帧和事件监听
onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="login-page">
    <div class="bg-gradient"></div>
    <div class="bg-glow-bottom"></div>
    <canvas ref="canvasRef" class="login-bg"></canvas>

    <div class="page-title">LOGIN & AUTH</div>

    <div class="drone-wrap">
      <div class="drone-beams">
        <div class="beam beam-blue"></div>
        <div class="beam beam-pink"></div>
      </div>
      <svg class="drone-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="droneDual" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00d4ff" />
            <stop offset="50%" stop-color="#00d4ff" />
            <stop offset="50%" stop-color="#ff4080" />
            <stop offset="100%" stop-color="#ff4080" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow)" stroke="url(#droneDual)" stroke-width="2" fill="none" stroke-linejoin="round">
          <path d="M60 18 L72 32 L72 52 L60 62 L48 52 L48 32 Z" />
          <circle cx="60" cy="42" r="5" stroke-width="1.5" fill="rgba(0,0,0,0.4)" />
          <path d="M60 32 L60 38 M52 40 L68 40" stroke-width="1.5" />
        </g>
      </svg>
    </div>

    <div class="login-card">
      <div class="card-glow"></div>
      <h1 class="title">AeroScope</h1>
      <p class="subtitle">超视距大气环境与电磁频谱双维监测</p>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="field">
          <label>账户</label>
          <input
            v-model="account"
            type="text"
            placeholder="请输入账户"
            autocomplete="username"
          />
        </div>
        <div class="field">
          <label>密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </div>
        <button type="submit" class="btn-login" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080c18;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 50% at 50% 80%, rgba(0, 80, 120, 0.15) 0%, transparent 50%),
    linear-gradient(180deg, rgba(8, 15, 30, 0.98) 0%, #050812 40%, #030508 100%);
  pointer-events: none;
}

.bg-glow-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 35%;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 180, 255, 0.12) 40%, rgba(0, 150, 220, 0.2) 100%);
  pointer-events: none;
}

.login-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.page-title {
  position: absolute;
  z-index: 5;
  top: 1.5rem;
  left: 1.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.9);
  pointer-events: none;
}

.drone-wrap {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, calc(-50% - 130px));
  width: 160px;
  height: 120px;
  pointer-events: none;
}

.drone-beams {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  height: 180px;
}

.beam {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  height: 100%;
  opacity: 0.4;
}

.beam-blue {
  left: 0;
  clip-path: polygon(50% 0%, 0% 100%, 50% 100%);
  background: linear-gradient(180deg, rgba(0, 212, 255, 0.5) 0%, rgba(0, 212, 255, 0.08) 60%, transparent 100%);
}

.beam-pink {
  right: 0;
  left: auto;
  clip-path: polygon(50% 0%, 50% 100%, 100% 100%);
  background: linear-gradient(180deg, rgba(255, 64, 128, 0.45) 0%, rgba(255, 64, 128, 0.06) 60%, transparent 100%);
}

.drone-svg {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.5)) drop-shadow(0 0 4px rgba(255, 64, 128, 0.4));
}

.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  background: rgba(12, 20, 40, 0.85);
  border: 1px solid rgba(0, 212, 255, 0.25);
  border-radius: 16px;
  box-shadow: 0 0 60px rgba(0, 212, 255, 0.08), inset 0 0 60px rgba(0, 212, 255, 0.03);
  backdrop-filter: blur(12px);
}

.card-glow {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.6), transparent);
  border-radius: 2px;
}

.title {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 600;
  color: #e8f4fc;
  letter-spacing: 0.05em;
  text-align: center;
}

.subtitle {
  margin: 0 0 2rem;
  font-size: 0.8rem;
  color: rgba(0, 212, 255, 0.8);
  text-align: center;
  letter-spacing: 0.08em;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: 0.85rem;
  color: rgba(232, 244, 252, 0.9);
}

.field input {
  padding: 0.75rem 1rem;
  font-size: 1rem;
  color: #e8f4fc;
  background: rgba(0, 20, 40, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input::placeholder {
  color: rgba(200, 220, 240, 0.4);
}

.field input:focus {
  border-color: rgba(0, 212, 255, 0.7);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.15);
}

.btn-login {
  margin-top: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: #080c18;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}

.btn-login:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
