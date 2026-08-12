<template>
  <div class="page-container">
    <el-card shadow="never">
      <template #header>
        <span>关联服务商设置</span>
      </template>

      <el-form label-width="120px" style="max-width: 500px;">
        <el-form-item label="当前关联服务商">
          <template v-if="currentSP">
            <el-tag type="success">{{ currentSP.name }}</el-tag>
          </template>
          <template v-else>
            <el-tag type="info">未关联</el-tag>
          </template>
        </el-form-item>

        <el-form-item label="选择服务商">
          <el-select
            v-model="selectedSPId"
            placeholder="请选择要关联的服务商"
            clearable
            style="width: 100%"
            :loading="loadingSP"
          >
            <el-option
              v-for="sp in serviceProviderList"
              :key="sp.id"
              :label="sp.name"
              :value="sp.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" :disabled="selectedSPId === originalSPId" @click="handleSave">
            保存关联
          </el-button>
          <el-button @click="handleClear" :loading="saving" :disabled="!originalSPId">解除关联</el-button>
        </el-form-item>
      </el-form>

      <el-divider />

      <el-alert
        title="关联说明"
        type="info"
        :closable="false"
        show-icon
      >
        <p>1. 关联服务商后，您可以查看该服务商的客户数据</p>
        <p>2. 关联关系会同步到超级管理员后台，管理员可以查看和修改</p>
        <p>3. 解除关联后，您将无法查看该服务商的客户数据</p>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { agentAPI } from '@/api/agent'

const currentSP = ref(null)
const originalSPId = ref(null)
const selectedSPId = ref('')
const serviceProviderList = ref([])
const loadingSP = ref(false)
const saving = ref(false)

async function loadServiceProviderList() {
  loadingSP.value = true
  try {
    const res = await agentAPI.getServiceProviderList()
    const data = res.data || {}
    serviceProviderList.value = data.serviceProviders || []
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    loadingSP.value = false
  }
}

async function loadCurrentSP() {
  try {
    const res = await agentAPI.getMyServiceProvider()
    const data = res.data || {}
    currentSP.value = data.serviceProvider || null
    originalSPId.value = data.serviceProviderId || null
    selectedSPId.value = data.serviceProviderId || ''
  } catch (err) {
    // 错误已由拦截器处理
  }
}

async function handleSave() {
  try {
    await ElMessageBox.confirm(
      `确认关联服务商「${serviceProviderList.value.find(sp => sp.id === selectedSPId)?.name || ''}」吗？此操作将同步到超级管理员后台。`,
      '确认关联',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  saving.value = true
  try {
    await agentAPI.setMyServiceProvider({ serviceProviderId: selectedSPId.value })
    ElMessage.success('关联服务商设置成功')
    await loadCurrentSP()
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    saving.value = false
  }
}

async function handleClear() {
  try {
    await ElMessageBox.confirm(
      '确认解除当前关联的服务商吗？解除后将无法查看该服务商的客户数据。',
      '确认解除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  saving.value = true
  try {
    await agentAPI.setMyServiceProvider({ serviceProviderId: null })
    ElMessage.success('已解除关联服务商')
    selectedSPId.value = ''
    await loadCurrentSP()
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadServiceProviderList()
  loadCurrentSP()
})
</script>

<style scoped>
.el-alert p {
  margin: 4px 0;
  font-size: 13px;
}
</style>
