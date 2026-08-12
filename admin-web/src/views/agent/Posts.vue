<template>
  <div class="page-container">
    <!-- 顶部操作 -->
    <div class="search-bar">
      <span style="line-height: 32px; color: #606266;">状态：</span>
      <el-select v-model="query.status" placeholder="全部" clearable style="width: 160px">
        <el-option label="待审核" value="pending_review" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
      <el-button type="success" @click="openPublish" style="margin-left: auto;">
        <el-icon><Plus /></el-icon> 发布图文
      </el-button>
    </div>

    <!-- 列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="companyName" label="公司名称" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.publishedAt || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无图文记录" />
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

    <!-- 发布图文对话框 -->
    <el-dialog v-model="publishVisible" title="发布图文" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" maxlength="100" show-word-limit placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            maxlength="2000"
            show-word-limit
            placeholder="请输入内容"
          />
        </el-form-item>
        <el-form-item label="图片链接" prop="images">
          <div style="width: 100%;">
            <div v-for="(img, idx) in form.images" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px;">
              <el-input v-model="form.images[idx]" placeholder="请输入图片 URL" />
              <el-button type="danger" link @click="removeImage(idx)">删除</el-button>
            </div>
            <el-button type="primary" link @click="addImage">+ 添加图片</el-button>
          </div>
        </el-form-item>
        <el-form-item label="公司名称" prop="companyName">
          <el-input v-model="form.companyName" maxlength="100" placeholder="请输入公司名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPublish">发布</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="图文详情" size="45%">
      <div v-loading="false" style="padding: 0 8px;">
        <h3 style="margin-top: 0;">{{ currentRow.title }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="公司名称">{{ currentRow.companyName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentRow.status)">{{ statusLabel(currentRow.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="发布时间">{{ formatTime(currentRow.publishedAt || currentRow.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">内容</el-divider>
        <div style="line-height: 1.8; white-space: pre-wrap;">{{ currentRow.content }}</div>
        <template v-if="(currentRow.images && currentRow.images.length)">
          <el-divider content-position="left">图片</el-divider>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-image
              v-for="(img, idx) in currentRow.images"
              :key="idx"
              :src="img"
              :preview-src-list="currentRow.images"
              :initial-index="idx"
              fit="cover"
              style="width: 120px; height: 120px; border-radius: 4px"
              preview-teleported
            />
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
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
  const map = { pending_review: '待审核', approved: '已通过', rejected: '已驳回' }
  return map[s] || s || '-'
}

const statusTagType = (s) => {
  const map = { pending_review: 'warning', approved: 'success', rejected: 'danger' }
  return map[s] || 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getPosts({
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    const data = res.data || {}
    list.value = data.posts || data.list || data.records || []
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

// ===== 详情 =====
const detailVisible = ref(false)
const currentRow = ref({})

const openDetail = (row) => {
  currentRow.value = { ...row }
  detailVisible.value = true
}

// ===== 发布图文 =====
const publishVisible = ref(false)
const formRef = ref(null)
const form = reactive({
  title: '',
  content: '',
  images: [],
  companyName: ''
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }]
}

// 幂等键：基于标题前缀 + 5 分钟时间窗口
const genIdempotencyKey = () => {
  const key = (form.title || 'POST').slice(0, 16).replace(/\s+/g, '_')
  return `POST_${key}_${Math.floor(Date.now() / 300000)}`
}

const addImage = () => {
  form.images.push('')
}

const removeImage = (idx) => {
  form.images.splice(idx, 1)
}

const openPublish = () => {
  form.title = ''
  form.content = ''
  form.images = []
  form.companyName = ''
  publishVisible.value = true
}

const submitPublish = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  // 过滤空图片链接
  const images = (form.images || []).filter((i) => i && i.trim())

  submitting.value = true
  try {
    await agentAPI.publishPost({
      title: form.title,
      content: form.content,
      images,
      companyName: form.companyName,
      idempotencyKey: genIdempotencyKey()
    })
    ElMessage.success('发布成功，等待审核')
    publishVisible.value = false
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
