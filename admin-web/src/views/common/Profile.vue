<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <span>个人设置</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户ID">{{ userStore.user?.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="账号(openid)">{{ userStore.user?.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ userStore.nickName }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag type="primary">{{ userStore.roleLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="头像">
          <el-avatar :size="64" :src="userStore.avatarUrl">
            {{ userStore.nickName.charAt(0) }}
          </el-avatar>
        </el-descriptions-item>
        <el-descriptions-item label="身份类型">{{ userStore.user?.identityType || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div style="margin-top: 24px;">
        <el-button type="primary" @click="changePwdVisible = true">
          <el-icon><Lock /></el-icon> 修改密码
        </el-button>
      </div>
    </el-card>

    <ChangePasswordDialog v-model:visible="changePwdVisible" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue'

const userStore = useUserStore()
const changePwdVisible = ref(false)
</script>
