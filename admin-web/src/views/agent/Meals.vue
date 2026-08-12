<template>
  <div class="page-container">
    <!-- 筛选栏 -->
    <div class="search-bar">
      <span style="line-height: 32px; color: #606266;">状态：</span>
      <el-select v-model="query.status" placeholder="全部" clearable style="width: 160px">
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column label="餐食图片" min-width="100" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              :preview-src-list="previewList(row)"
              :initial-index="previewIndex(row)"
              fit="cover"
              style="width: 60px; height: 60px; border-radius: 4px"
              preview-teleported
            />
            <span v-else style="color: #c0c4cc;">无图</span>
          </template>
        </el-table-column>
        <el-table-column prop="userName" label="用户" min-width="120" show-overflow-tooltip />
        <el-table-column prop="mealType" label="餐食类型" min-width="110">
          <template #default="{ row }">
            <el-tag>{{ row.mealType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.uploadedAt || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openPreview(row)">查看大图</el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="warning"
              link
              @click="openReview(row)"
            >审核</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无餐食记录" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 审核对话框 -->
    <el-dialog v-model="reviewVisible" title="餐食审核" width="480px">
      <el-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" label-width="90px">
        <el-form-item label="餐食图片">
          <el-image
            v-if="currentMeal.imageUrl"
            :src="currentMeal.imageUrl"
            fit="cover"
            style="width: 100px; height: 100px; border-radius: 4px"
          />
        </el-form-item>
        <el-form-item label="用户">
          <span>{{ currentMeal.userName || '-' }}</span>
        </el-form-item>
        <el-form-item label="审核结果" prop="status">
          <el-radio-group v-model="reviewForm.status">
            <el-radio value="approved">通过</el-radio>
            <el-radio value="rejected">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核意见" prop="comment">
          <el-input
            v-model="reviewForm.comment"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入审核意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReview">提交审核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  status: '',
  page: 1,
  pageSize: 10
})

// 时间格式化 YYYY-MM-DD HH:mm:ss
const formatTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const statusLabel = (s) => {
  const map = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
  return map[s] || s || '-'
}

const statusTagType = (s) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[s] || 'info'
}

// 当前页所有图片，用于多图预览
const previewList = (row) => {
  const urls = list.value.filter((i) => i.imageUrl).map((i) => i.imageUrl)
  return row.imageUrl ? [row.imageUrl] : urls
}

const previewIndex = (row) => {
  const urls = list.value.filter((i) => i.imageUrl).map((i) => i.imageUrl)
  return Math.max(0, urls.indexOf(row.imageUrl))
}

const openPreview = (row) => {
  // el-image 自带预览，这里仅做兜底
  if (!row.imageUrl) {
    ElMessage.info('该记录无图片')
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getMeals({
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    const data = res.data || {}
    list.value = data.meals || data.list || data.records || []
    total.value = data.total || 0
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.page = 1
  loadList()
}

const handleReset = () => {
  query.status = ''
  query.page = 1
  loadList()
}

const handlePageChange = (p) => {
  query.page = p
  loadList()
}

// ===== 审核 =====
const reviewVisible = ref(false)
const reviewFormRef = ref(null)
const currentMeal = ref({})
const reviewForm = reactive({
  status: 'approved',
  comment: ''
})
const reviewRules = {
  status: [{ required: true, message: '请选择审核结果', trigger: 'change' }],
  comment: [{ max: 200, message: '审核意见不超过 200 字', trigger: 'blur' }]
}

const openReview = (row) => {
  currentMeal.value = row
  reviewForm.status = 'approved'
  reviewForm.comment = ''
  reviewVisible.value = true
}

const submitReview = async () => {
  if (!reviewFormRef.value) return
  try {
    await reviewFormRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    await agentAPI.reviewMeal(currentMeal.value.id, {
      status: reviewForm.status,
      comment: reviewForm.comment
    })
    ElMessage.success('审核已提交')
    reviewVisible.value = false
    loadList()
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>
