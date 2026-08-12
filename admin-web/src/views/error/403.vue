<template>
  <el-result
    icon="warning"
    title="403"
    sub-title="抱歉，您无权访问该页面"
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
