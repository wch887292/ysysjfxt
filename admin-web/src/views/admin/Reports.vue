<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.reviewStatus" placeholder="复核状态" clearable @change="handleSearch">
          <el-option label="全部" value="all" />
          <el-option label="待复核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="待重写" value="rewritten" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="用户" prop="userNickName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.userNickName || row.userName || '-' }}</template>
        </el-table-column>
        <el-table-column label="报告类型" prop="reportType" min-width="120">
          <template #default="{ row }">{{ reportTypeLabel(row.reportType) }}</template>
        </el-table-column>
        <el-table-column label="风险等级" prop="riskLevel" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">{{ riskLabel(row.riskLevel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标记" prop="flagged" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.flagged ? 'danger' : 'info'" size="small">
              {{ row.flagged ? '已标记' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="复核状态" prop="reviewStatus" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="reviewStatusTagType(row.reviewStatus)" size="small">
              {{ reviewStatusLabel(row.reviewStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" prop="generatedAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.generatedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">查看详情</el-button>
            <el-button
              v-if="row.reviewStatus === 'pending'"
              link type="success" size="small" @click="openReview(row, 'approve')"
            >通过</el-button>
            <el-button
              v-if="row.reviewStatus === 'pending'"
              link type="danger" size="small" @click="openReview(row, 'reject')"
            >驳回</el-button>
            <el-button
              link type="warning" size="small" @click="handleRewrite(row)"
            >触发重写</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="报告详情" size="50%">
      <div v-loading="detailLoading">
        <el-descriptions :column="2" border v-if="detail">
          <el-descriptions-item label="用户">{{ detail.userNickName || detail.userName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="报告类型">{{ reportTypeLabel(detail.reportType) }}</el-descriptions-item>
          <el-descriptions-item label="风险等级">
            <el-tag :type="riskTagType(detail.riskLevel)" size="small">{{ riskLabel(detail.riskLevel) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="复核状态">
            <el-tag :type="reviewStatusTagType(detail.reviewStatus)" size="small">{{ reviewStatusLabel(detail.reviewStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="生成时间">{{ formatDate(detail.generatedAt || detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="是否标记">{{ detail.flagged ? '是' : '否' }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">报告内容</el-divider>
        <div class="report-content" v-if="detail">
          <div v-if="detail.title" class="report-title">{{ detail.title }}</div>
          <div class="report-text">{{ detail.content || detail.reportContent || '暂无内容' }}</div>
          <div v-if="detail.flagReason" class="flag-reason">
            <el-tag type="danger" size="small">标记原因</el-tag>
            <span>{{ detail.flagReason }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无详情" />
      </div>
    </el-drawer>

    <!-- 复核对话框 -->
    <el-dialog v-model="reviewVisible" :title="reviewForm.action === 'approve' ? '通过复核' : '驳回报告'" width="480px">
      <el-form ref="reviewFormRef" :model="reviewForm" label-width="80px">
        <el-form-item label="复核意见" prop="remark" :rules="[{ required: true, message: '请输入复核意见', trigger: 'blur' }]">
          <el-input
            v-model="reviewForm.remark"
            type="textarea"
            :rows="3"
            :placeholder="reviewForm.action === 'approve' ? '请输入通过意见' : '请输入驳回原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleConfirmReview">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  reviewStatus: 'pending',
  page: 1,
  pageSize: 10
})

function reportTypeLabel(type) {
  const map = { crisis_hook: '危机干预钩子', seven_day_plan: '7日方案', daily: '日报', weekly: '周报' }
  return map[type] || type || '-'
}

function riskLabel(level) {
  const map = { high: '高风险', medium: '中风险', low: '低风险', none: '无' }
  return map[level] || level || '-'
}

function riskTagType(level) {
  const map = { high: 'danger', medium: 'warning', low: 'success', none: 'info' }
  return map[level] || 'info'
}

function reviewStatusLabel(status) {
  const map = { pending: '待复核', approved: '已通过', rejected: '已驳回', rewritten: '待重写' }
  return map[status] || status || '-'
}

function reviewStatusTagType(status) {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger', rewritten: 'info' }
  return map[status] || 'info'
}

// 格式化时间
function formatDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function loadList() {
  loading.value = true
  try {
    const params = { ...query }
    if (params.reviewStatus === 'all') delete params.reviewStatus
    const res = await adminAPI.getFlaggedReports(params)
    const data = res.data || {}
    list.value = data.reports || data.list || data.records || []
    total.value = data.total || 0
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadList()
}

function handleReset() {
  query.reviewStatus = 'pending'
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await adminAPI.getReportReviewDetail(row.id)
    detail.value = res.data || null
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    detailLoading.value = false
  }
}

// ===== 复核 =====
const reviewVisible = ref(false)
const reviewFormRef = ref()
const currentRow = ref(null)
const reviewForm = reactive({ action: 'approve', remark: '' })

function openReview(row, action) {
  currentRow.value = row
  reviewForm.action = action
  reviewForm.remark = ''
  reviewVisible.value = true
}

async function handleConfirmReview() {
  if (!reviewFormRef.value) return
  try {
    await reviewFormRef.value.validate()
    submitting.value = true
    await adminAPI.reviewReport(currentRow.value.id, {
      action: reviewForm.action,
      remark: reviewForm.remark
    })
    ElMessage.success(reviewForm.action === 'approve' ? '已通过' : '已驳回')
    reviewVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

// ===== 触发重写 =====
async function handleRewrite(row) {
  try {
    await ElMessageBox.confirm(`确认触发报告「${reportTypeLabel(row.reportType)}」重写吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.rewriteReport(row.id)
    ElMessage.success('已触发重写')
    loadList()
  } catch (err) {
    // 用户取消或请求错误
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.report-content {
  padding: 0 4px;
}

.report-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.report-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

.flag-reason {
  margin-top: 16px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #f56c6c;
}
</style>
