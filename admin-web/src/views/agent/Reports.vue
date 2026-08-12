<template>
  <div class="page-container" v-loading="loading">
    <!-- 顶部信息 -->
    <el-card shadow="never" class="card-gap">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: #606266;">当前查询用户：</span>
        <el-input
          v-model="userId"
          placeholder="请输入用户 ID"
          clearable
          style="width: 240px"
          @keyup.enter="loadList"
        />
        <el-button type="primary" @click="loadList">查询</el-button>
        <el-tag v-if="userName" type="primary">{{ userName }}</el-tag>
        <span v-if="!userId" style="color: #909399; font-size: 13px;">请输入用户 ID 后查询报告</span>
      </div>
    </el-card>

    <!-- 报告列表 -->
    <el-card shadow="never">
      <template #header>
        <span>报告列表</span>
      </template>
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="reportType" label="报告类型" min-width="140">
          <template #default="{ row }">
            <el-tag>{{ row.reportType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险等级" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)">{{ row.riskLevel || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.generatedAt || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openView(row)">查看</el-button>
            <el-button
              type="success"
              link
              :loading="downloadingId === row.id"
              @click="handleDownload(row)"
            >下载</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无报告数据" />
        </template>
      </el-table>
    </el-card>

    <!-- 查看报告全文 drawer -->
    <el-drawer v-model="viewVisible" title="报告详情" size="50%">
      <div v-loading="viewLoading" style="padding: 0 8px;">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="报告类型">{{ currentReport.reportType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="风险等级">
            <el-tag :type="riskTagType(currentReport.riskLevel)">{{ currentReport.riskLevel || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="生成时间">{{ formatTime(currentReport.generatedAt || currentReport.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">报告全文</el-divider>
        <div class="report-content">
          <pre v-if="currentReport.content">{{ currentReport.content }}</pre>
          <el-empty v-else description="暂无报告内容" />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { agentAPI } from '@/api/agent'

const route = useRoute()

const loading = ref(false)
const viewLoading = ref(false)
const list = ref([])
const userId = ref('')
const userName = ref('')
const downloadingId = ref(null)

// 时间格式化 YYYY-MM-DD HH:mm:ss
const formatTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const riskTagType = (level) => {
  const map = { high: 'danger', medium: 'warning', low: 'success', 高: 'danger', 中: 'warning', 低: 'success' }
  return map[level] || 'info'
}

const loadList = async () => {
  if (!userId.value) {
    ElMessage.info('请输入用户 ID')
    return
  }
  loading.value = true
  try {
    const res = await agentAPI.getReports(userId.value)
    const data = res.data
    // 兼容数组或对象包裹
    if (Array.isArray(data)) {
      list.value = data
    } else if (data && Array.isArray(data.reports)) {
      list.value = data.reports
      userName.value = data.userName || data.nickname || ''
    } else if (data && Array.isArray(data.list)) {
      list.value = data.list
      userName.value = data.userName || data.nickname || ''
    } else {
      list.value = []
      userName.value = (data && (data.userName || data.nickname)) || ''
    }
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

// ===== 查看报告 =====
const viewVisible = ref(false)
const currentReport = ref({})

const openView = (row) => {
  currentReport.value = { ...row }
  viewVisible.value = true
}

// ===== 下载报告 =====
const handleDownload = async (row) => {
  downloadingId.value = row.id
  try {
    const response = await agentAPI.downloadReport(row.id)
    // responseType: 'text'，response 为完整 axios response 对象（非标准格式走原始返回）
    const text = response?.data ?? response
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `报告_${row.reportType || row.id}_${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    downloadingId.value = null
  }
}

onMounted(() => {
  // 从路由 query 获取 userId
  const uid = route.query.userId
  if (uid) {
    userId.value = String(uid)
    loadList()
  }
})
</script>

<style scoped>
.report-content pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.8;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  margin: 0;
}
</style>
