<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="new-page">
    <header class="page-header">
      <button class="btn-back" @click="router.push({ name: 'dashboard' })">← 返回仪表盘</button>
      <h1 class="page-title">新页面</h1>
    </header>
    <main class="page-main">
      <p class="placeholder">在此添加页面内容。</p>
    </main>
  </div>
</template>

<style scoped>
.new-page {
  min-height: 100vh;
  background: #0a0e1a;
  color: #e0e8f0;
}

.page-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 212, 255, 0.15);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
  color: rgba(0, 212, 255, 0.95);
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
}

.btn-back:hover {
  background: rgba(0, 212, 255, 0.1);
}

.page-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.page-main {
  padding: 2rem 1.5rem;
}

.placeholder {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1rem;
}
</style>
