<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="标题关键词" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.category" placeholder="分类" clearable @change="handleSearch">
          <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="已发布" value="published" />
          <el-option label="已下架" value="offline" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建资讯
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="封面" prop="coverImage" min-width="100" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.coverImage"
              :src="row.coverImage"
              fit="cover"
              class="cover-img"
              preview-teleported
              :preview-src-list="[row.coverImage]"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="标题" prop="title" min-width="200" show-overflow-tooltip />
        <el-table-column label="摘要" prop="summary" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || '-' }}</template>
        </el-table-column>
        <el-table-column label="分类" prop="category" min-width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="categoryTagType(row.category)">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sortOrder" min-width="80" align="center" />
        <el-table-column label="状态" prop="status" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'published'"
              link type="success" size="small" @click="handlePublish(row, 'publish')"
            >发布</el-button>
            <el-button
              v-else
              link type="warning" size="small" @click="handlePublish(row, 'offline')"
            >下架</el-button>
            <el-button
              link type="danger" size="small" :disabled="row.status === 'published'"
              @click="handleDelete(row)"
            >删除</el-button>
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

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑资讯' : '新建资讯'"
      width="680px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" clearable />
        </el-form-item>
        <el-form-item label="摘要" prop="summary">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="请输入摘要" />
        </el-form-item>
        <el-form-item label="封面图" prop="coverImage">
          <el-input v-model="form.coverImage" placeholder="请输入封面图 URL" clearable />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="8" placeholder="请输入正文内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  keyword: '',
  category: '',
  status: '',
  page: 1,
  pageSize: 10
})

const categoryOptions = [
  { value: 'news', label: '新闻动态' },
  { value: 'health_tips', label: '健康贴士' },
  { value: 'activity', label: '活动公告' },
  { value: 'announcement', label: '系统公告' },
  { value: 'other', label: '其他' }
]

function categoryLabel(val) {
  const opt = categoryOptions.find((o) => o.value === val)
  return opt ? opt.label : val || '-'
}

function categoryTagType(val) {
  const map = { news: 'primary', health_tips: 'success', activity: 'warning', announcement: 'danger', other: 'info' }
  return map[val] || ''
}

function statusLabel(status) {
  const map = { published: '已发布', offline: '已下架', draft: '草稿' }
  return map[status] || status || '-'
}

function statusTagType(status) {
  const map = { published: 'success', offline: 'info', draft: 'warning' }
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
    Object.keys(params).forEach((k) => {
      if (params[k] === '' || params[k] === null) delete params[k]
    })
    const res = await adminAPI.getArticles(params)
    const data = res.data || {}
    list.value = data.articles || data.list || data.records || []
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
  query.keyword = ''
  query.category = ''
  query.status = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 新增/编辑 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const editId = ref(null)
const form = reactive({
  title: '',
  content: '',
  summary: '',
  coverImage: '',
  category: '',
  sortOrder: 0
})

const formRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入正文', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  form.title = row.title
  form.content = row.content || ''
  form.summary = row.summary || ''
  form.coverImage = row.coverImage || ''
  form.category = row.category
  form.sortOrder = row.sortOrder ?? 0
  dialogVisible.value = true
}

function resetForm() {
  form.title = ''
  form.content = ''
  form.summary = ''
  form.coverImage = ''
  form.category = ''
  form.sortOrder = 0
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    if (isEdit.value) {
      await adminAPI.updateArticle(editId.value, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await adminAPI.createArticle({ ...form })
      ElMessage.success('新建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

// ===== 发布/下架 =====
async function handlePublish(row, action) {
  const actionText = action === 'publish' ? '发布' : '下架'
  try {
    await ElMessageBox.confirm(`确认${actionText}资讯「${row.title}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.publishArticle(row.id, { action })
    ElMessage.success(`${actionText}成功`)
    loadList()
  } catch (err) {
    // 用户取消或请求错误
  }
}

// ===== 删除 =====
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除资讯「${row.title}」吗？删除后不可恢复。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.deleteArticle(row.id)
    ElMessage.success('删除成功')
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
.cover-img {
  width: 80px;
  height: 50px;
  border-radius: 4px;
}

.search-bar .el-button {
  margin-left: 0;
}
</style>
