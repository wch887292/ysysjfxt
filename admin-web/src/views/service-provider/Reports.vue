<template>
  <div class="page-container">
    <!-- 顶部信息 -->
    <el-card class="card-gap">
      <div class="search-bar">
        <span>客户ID：</span>
        <el-input :model-value="userId" placeholder="请从客户查询跳转" disabled style="width: 220px;" />
        <el-button type="primary" :loading="loading" @click="loadList">
          <el-icon><Refresh /></el-icon>
          刷新列表
        </el-button>
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>
          返回客户列表
        </el-button>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-left: auto;"
        >
          服务商下载报告不占用用户的月度次数
        </el-alert>
      </div>
    </el-card>

    <!-- 报告列表 -->
    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column label="报告类型" prop="reportType" min-width="140">
          <template #default="{ row }">
            {{ reportTypeText(row.reportType) }}
          </template>
        </el-table-column>
        <el-table-column label="风险等级" prop="riskLevel" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">
              {{ riskLevelText(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" prop="createdAt" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt || row.generatedAt) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewReport(row)">查看</el-button>
            <el-button
              link
              type="success"
              size="small"
              :loading="downloadingId === row.id"
              @click="downloadReport(row)"
            >
              下载
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无报告" />
        </template>
      </el-table>
    </el-card>

    <!-- 报告查看抽屉 -->
    <el-drawer
      v-model="reportVisible"
      :title="reportTitle"
      size="60%"
      direction="rtl"
    >
      <div v-loading="reportLoading" class="report-content">
        <el-empty v-if="!reportContent && !reportLoading" description="暂无内容" />
        <pre v-else>{{ reportContent }}</pre>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Back } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const route = useRoute()
const router = useRouter()

const userId = computed(() => route.query.userId || '')

const loading = ref(false)
const list = ref([])

const reportVisible = ref(false)
const reportLoading = ref(false)
const reportContent = ref('')
const reportTitle = ref('报告详情')

const downloadingId = ref(null)

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 报告类型文案
function reportTypeText(type) {
  const map = {
    daily: '日报',
    weekly: '周报',
    monthly: '月报',
    nutrition: '营养报告',
    health: '健康报告'
  }
  return map[type] || type || '报告'
}

// 风险等级文案
function riskLevelText(level) {
  const map = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '极高风险'
  }
  return map[level] || level || '-'
}

// 风险等级标签类型
function riskTagType(level) {
  const map = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    critical: 'danger'
  }
  return map[level] || 'info'
}

async function loadList() {
  if (!userId.value) {
    ElMessage.warning('缺少客户ID，请从客户查询页面跳转')
    return
  }
  loading.value = true
  try {
    const res = await serviceProviderAPI.getReports(userId.value)
    const data = res.data || {}
    list.value = Array.isArray(data) ? data : (data.reports || data.list || data.records || data.items || [])
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

async function viewReport(row) {
  reportVisible.value = true
  reportLoading.value = true
  reportContent.value = ''
  reportTitle.value = `${reportTypeText(row.reportType)} - ${formatDateTime(row.createdAt) || ''}`
  try {
    // 通过下载接口获取报告全文（text 格式）
    const res = await serviceProviderAPI.downloadReport(row.id)
    let text = ''
    if (res && res.data !== undefined) {
      text = typeof res.data === 'string' ? res.data : (res.data.content || res.data.text || JSON.stringify(res.data, null, 2))
    } else if (typeof res === 'string') {
      text = res
    }
    reportContent.value = text || '（报告内容为空）'
  } catch (err) {
    reportContent.value = '报告加载失败'
  } finally {
    reportLoading.value = false
  }
}

async function downloadReport(row) {
  downloadingId.value = row.id
  try {
    const res = await serviceProviderAPI.downloadReport(row.id)
    let text = ''
    if (res && res.data !== undefined) {
      text = typeof res.data === 'string' ? res.data : (res.data.content || res.data.text || JSON.stringify(res.data, null, 2))
    } else if (typeof res === 'string') {
      text = res
    }
    // 用 Blob + URL.createObjectURL + <a> 触发浏览器下载
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `报告_${reportTypeText(row.reportType)}_${row.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('报告下载成功')
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    downloadingId.value = null
  }
}

function goBack() {
  router.push('/service-provider/users')
}

onMounted(() => {
  if (userId.value) {
    loadList()
  } else {
    ElMessage.warning('缺少客户ID，请从客户查询页面跳转')
  }
})
</script>

<style scoped>
.report-content {
  padding: 16px;
}

.report-content pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  margin: 0;
}
</style>
