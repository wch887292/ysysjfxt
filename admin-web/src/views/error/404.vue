<template>
  <el-result
    icon="info"
    title="404"
    sub-title="抱歉，您访问的页面不存在"
  >
    <template #extra>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </template>
  </el-result>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

function goHome() {
  router.push(userStore.homePath)
}
</script>

<style scoped>
:deep(.el-result) {
  height: 100vh;
  background: #f5f7fa;
}
</style>
