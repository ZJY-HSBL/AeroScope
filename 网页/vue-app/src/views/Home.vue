<script setup>
import { useRouter } from 'vue-router'
import HelloWorld from '../components/HelloWorld.vue'
import TheWelcome from '../components/TheWelcome.vue'
import { logout as apiLogout } from '@/api/auth.js'
import { TOKEN_KEY } from '@/api/request.js'

const router = useRouter()
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
  <div class="home-page">
    <header>
      <img alt="Vue logo" class="logo" src="../assets/logo.svg" width="125" height="125" />
      <button class="btn-logout" @click="logout">退出登录</button>
      <div class="wrapper">
        <HelloWorld msg="You did it!" />
      </div>
    </header>
    <main>
      <TheWelcome />
    </main>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
}
header {
  line-height: 1.5;
  position: relative;
}
.logo {
  display: block;
  margin: 0 auto 2rem;
}
.btn-logout {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
  color: hsla(160, 100%, 37%, 1);
  background: transparent;
  border: 1px solid hsla(160, 100%, 37%, 0.5);
  border-radius: 6px;
  cursor: pointer;
}
.btn-logout:hover {
  background: hsla(160, 100%, 37%, 0.1);
}
@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }
  .logo {
    margin: 0 2rem 0 0;
  }
  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
