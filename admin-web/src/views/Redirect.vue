<template>
  <div class="redirect-page">
    <el-icon class="loading-icon"><Loading /></el-icon>
    <span>正在跳转...</span>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

onMounted(() => {
  // 根据角色跳转到对应首页
  router.replace(userStore.homePath)
})
</script>

<style scoped>
.redirect-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #909399;
  font-size: 14px;
}

.loading-icon {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
