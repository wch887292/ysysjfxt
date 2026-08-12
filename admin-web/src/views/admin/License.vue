<template>
  <div class="license-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>授权管理</span>
          <el-tag :type="statusType" size="large">{{ statusText }}</el-tag>
        </div>
      </template>

      <!-- 授权状态信息 -->
      <div v-loading="loading">
        <!-- 已授权 -->
        <el-result v-if="status.isLicensed" icon="success" title="系统已授权" :sub-title="`客户：${status.license?.customer || '-'}  |  有效期至：${formatDate(status.license?.validUntil)}`">
          <template #extra>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="客户名称">{{ status.license?.customer || '-' }}</el-descriptions-item>
              <el-descriptions-item label="许可证类型">{{ status.license?.type === 'permanent' ? '正式版' : '年度版' }}</el-descriptions-item>
              <el-descriptions-item label="签发时间">{{ formatDate(status.license?.issuedAt) }}</el-descriptions-item>
              <el-descriptions-item label="有效期至">{{ formatDate(status.license?.validUntil) }}</el-descriptions-item>
              <el-descriptions-item label="绑定域名">{{ status.license?.domain || '不限制' }}</el-descriptions-item>
              <el-descriptions-item label="产品">{{ status.license?.product || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
        </el-result>

        <!-- 试用中 -->
        <el-result v-else-if="!status.isExpired" icon="info" title="试用期" :sub-title="`剩余 ${status.trial?.remainingDays} 天`">
          <template #extra>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="安装日期">{{ formatDate(status.trial?.installDate) }}</el-descriptions-item>
              <el-descriptions-item label="试用天数">{{ status.trial?.trialDays }} 天</el-descriptions-item>
              <el-descriptions-item label="已使用">{{ status.trial?.usedDays }} 天</el-descriptions-item>
              <el-descriptions-item label="剩余天数">
                <span :class="{ 'text-warning': status.trial?.remainingDays <= 7 }">
                  {{ status.trial?.remainingDays }} 天
                </span>
              </el-descriptions-item>
            </el-descriptions>

            <el-progress :percentage="trialProgress" :color="trialColor" :stroke-width="20" :text-inside="true" style="margin-top: 20px;" />

            <el-alert v-if="status.trial?.remainingDays <= 7" type="warning" :closable="false" style="margin-top: 16px;"
              title="试用期即将到期" description="请尽快输入正式版本密钥激活系统，避免影响正常使用。" show-icon />

            <div style="margin-top: 20px;">
              <el-button type="primary" @click="showActivateDialog = true">输入激活密钥</el-button>
              <el-button @click="fetchStatus">刷新状态</el-button>
            </div>
          </template>
        </el-result>

        <!-- 已过期 -->
        <el-result v-else icon="error" title="试用期已到期" sub-title="请输入正式版本密钥激活系统">
          <template #extra>
            <el-alert type="error" :closable="false" style="margin-bottom: 16px;"
              title="系统功能已锁定" description="试用期已结束，所有 API 请求将被拦截。请输入正式版本密钥激活系统后恢复使用。" show-icon />

            <el-button type="primary" size="large" @click="showActivateDialog = true">立即激活</el-button>
            <el-button size="large" @click="fetchStatus">刷新状态</el-button>
          </template>
        </el-result>
      </div>
    </el-card>

    <!-- 激活密钥对话框 -->
    <el-dialog v-model="showActivateDialog" title="激活正式版本" width="600px" :close-on-click-modal="false">
      <el-form @submit.prevent="handleActivate">
        <el-form-item label="许可证密钥">
          <el-input v-model="licenseKey" type="textarea" :rows="6" placeholder="请输入正式版本许可证密钥" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showActivateDialog = false">取消</el-button>
        <el-button type="primary" :loading="activating" @click="handleActivate">激活</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getLicenseStatus, activateLicense } from '@/api/license'

const loading = ref(false)
const activating = ref(false)
const showActivateDialog = ref(false)
const licenseKey = ref('')
const status = ref({
  status: 'trial',
  isLicensed: false,
  isExpired: false,
  license: null,
  trial: { installDate: '', trialDays: 60, usedDays: 0, remainingDays: 60 }
})

const statusText = computed(() => {
  if (status.value.isLicensed) return '已授权'
  if (status.value.isExpired) return '已过期'
  return '试用中'
})

const statusType = computed(() => {
  if (status.value.isLicensed) return 'success'
  if (status.value.isExpired) return 'danger'
  return 'warning'
})

const trialProgress = computed(() => {
  const trial = status.value.trial
  if (!trial) return 0
  return Math.round((trial.usedDays / trial.trialDays) * 100)
})

const trialColor = computed(() => {
  const remaining = status.value.trial?.remainingDays || 0
  if (remaining <= 7) return '#f56c6c'
  if (remaining <= 30) return '#e6a23c'
  return '#67c23a'
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function fetchStatus() {
  loading.value = true
  try {
    const res = await getLicenseStatus()
    status.value = res.data || status.value
  } catch (err) {
    // 如果 403 且 code 为 LICENSE_EXPIRED，也更新状态
    if (err.response?.data?.data) {
      status.value = err.response.data.data
    } else {
      ElMessage.error('获取授权状态失败')
    }
  } finally {
    loading.value = false
  }
}

async function handleActivate() {
  if (!licenseKey.value.trim()) {
    ElMessage.warning('请输入许可证密钥')
    return
  }

  activating.value = true
  try {
    const res = await activateLicense(licenseKey.value.trim())
    ElMessage.success(res.message || '激活成功')
    showActivateDialog.value = false
    licenseKey.value = ''
    await fetchStatus()
  } catch (err) {
    const msg = err.response?.data?.message || '激活失败'
    ElMessage.error(msg)
  } finally {
    activating.value = false
  }
}

onMounted(() => {
  fetchStatus()
})
</script>

<style scoped>
.license-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-warning {
  color: #e6a23c;
  font-weight: bold;
}
</style>
