<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="全部" value="all" />
          <el-option label="待审核" value="pending_review" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="代理商" prop="agentName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.agentName || row.agentNickName || '-' }}</template>
        </el-table-column>
        <el-table-column label="标题" prop="title" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" prop="status" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="驳回原因" prop="rejectReason" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rejectReason || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布时间" prop="publishedAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.publishedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">查看详情</el-button>
            <template v-if="row.status === 'pending_review'">
              <el-button link type="success" size="small" @click="openReview(row, 'approved')">通过</el-button>
              <el-button link type="danger" size="small" @click="openReview(row, 'rejected')">驳回</el-button>
            </template>
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
    <el-drawer v-model="detailVisible" title="图文详情" size="50%">
      <div v-if="currentRow">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="代理商">{{ currentRow.agentName || currentRow.agentNickName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentRow.status)" size="small">{{ statusLabel(currentRow.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发布时间">{{ formatDate(currentRow.publishedAt || currentRow.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ currentRow.title }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">正文内容</el-divider>
        <div class="post-content">{{ currentRow.content || '暂无内容' }}</div>
        <template v-if="currentRow.images && currentRow.images.length">
          <el-divider content-position="left">图片</el-divider>
          <div class="post-images">
            <el-image
              v-for="(img, idx) in currentRow.images"
              :key="idx"
              :src="img"
              :preview-src-list="currentRow.images"
              :initial-index="idx"
              fit="cover"
              class="post-image"
              preview-teleported
            />
          </div>
        </template>
        <div v-if="currentRow.rejectReason" class="reject-reason">
          <el-tag type="danger" size="small">驳回原因</el-tag>
          <span>{{ currentRow.rejectReason }}</span>
        </div>
      </div>
    </el-drawer>

    <!-- 审核对话框 -->
    <el-dialog
      v-model="reviewVisible"
      :title="reviewForm.status === 'approved' ? '通过审核' : '驳回图文'"
      width="480px"
    >
      <el-form ref="reviewFormRef" :model="reviewForm" label-width="90px">
        <el-form-item
          v-if="reviewForm.status === 'rejected'"
          label="驳回原因"
          prop="rejectReason"
          :rules="[{ required: true, message: '请输入驳回原因', trigger: 'blur' }]"
        >
          <el-input v-model="reviewForm.rejectReason" type="textarea" :rows="3" placeholder="请输入驳回原因" />
        </el-form-item>
        <el-form-item v-else label="审核意见">
          <el-input v-model="reviewForm.rejectReason" type="textarea" :rows="3" placeholder="审核意见（选填）" />
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
import { ElMessage } from 'element-plus'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  status: 'pending_review',
  page: 1,
  pageSize: 10
})

function statusLabel(status) {
  const map = { pending_review: '待审核', approved: '已通过', rejected: '已驳回' }
  return map[status] || status || '-'
}

function statusTagType(status) {
  const map = { pending_review: 'warning', approved: 'success', rejected: 'danger' }
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
    if (params.status === 'all') delete params.status
    const res = await adminAPI.getPosts(params)
    const data = res.data || {}
    list.value = data.posts || data.list || data.records || []
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
  query.status = 'pending_review'
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 详情 =====
const detailVisible = ref(false)
const currentRow = ref(null)

function openDetail(row) {
  currentRow.value = row
  detailVisible.value = true
}

// ===== 审核 =====
const reviewVisible = ref(false)
const reviewFormRef = ref()
const reviewForm = reactive({ status: 'approved', rejectReason: '' })

function openReview(row, status) {
  currentRow.value = row
  reviewForm.status = status
  reviewForm.rejectReason = ''
  reviewVisible.value = true
}

async function handleConfirmReview() {
  if (!reviewFormRef.value) return
  try {
    await reviewFormRef.value.validate()
    submitting.value = true
    await adminAPI.reviewPost(currentRow.value.id, {
      status: reviewForm.status,
      rejectReason: reviewForm.rejectReason
    })
    ElMessage.success(reviewForm.status === 'approved' ? '已通过' : '已驳回')
    reviewVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.post-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

.post-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.post-image {
  width: 120px;
  height: 120px;
  border-radius: 4px;
  cursor: pointer;
}

.reject-reason {
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
