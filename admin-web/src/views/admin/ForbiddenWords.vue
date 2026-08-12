<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.category" placeholder="分类" clearable @change="handleSearch">
          <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon> 新增违禁词
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="匹配模式" prop="pattern" min-width="200" show-overflow-tooltip />
        <el-table-column label="提示信息" prop="message" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类" prop="category" min-width="120">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.category)" size="small">
              {{ categoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="note" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑违禁词' : '新增违禁词'" width="560px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="匹配模式" prop="pattern">
          <el-input v-model="form.pattern" placeholder="请输入正则或关键词" clearable />
        </el-form-item>
        <el-form-item label="提示信息" prop="message">
          <el-input v-model="form.message" type="textarea" :rows="2" placeholder="命中时给用户的提示" clearable />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="note">
          <el-input v-model="form.note" type="textarea" :rows="2" placeholder="备注（选填）" clearable />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="form.status" active-value="active" inactive-value="inactive" active-text="启用" inactive-text="停用" />
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
  category: '',
  status: '',
  page: 1,
  pageSize: 10
})

const categoryOptions = [
  { value: 'diagnosis', label: '诊断类' },
  { value: 'treatment', label: '治疗类' },
  { value: 'promise', label: '效果承诺' },
  { value: 'intimidation', label: '恐吓性' },
  { value: 'other', label: '其他' }
]

function categoryLabel(val) {
  const opt = categoryOptions.find((o) => o.value === val)
  return opt ? opt.label : val || '-'
}

function categoryTagType(val) {
  const map = { diagnosis: 'danger', treatment: 'warning', promise: 'success', intimidation: 'info', other: '' }
  return map[val] || ''
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
    const res = await adminAPI.getForbiddenWords(params)
    const data = res.data || {}
    list.value = data.words || data.list || data.records || []
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
  pattern: '',
  message: '',
  category: '',
  note: '',
  status: 'active'
})

const formRules = {
  pattern: [{ required: true, message: '请输入匹配模式', trigger: 'blur' }],
  message: [{ required: true, message: '请输入提示信息', trigger: 'blur' }],
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
  form.pattern = row.pattern
  form.message = row.message
  form.category = row.category
  form.note = row.note || ''
  form.status = row.status || 'active'
  dialogVisible.value = true
}

function resetForm() {
  form.pattern = ''
  form.message = ''
  form.category = ''
  form.note = ''
  form.status = 'active'
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    if (isEdit.value) {
      await adminAPI.updateForbiddenWord(editId.value, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await adminAPI.createForbiddenWord({ ...form })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除违禁词「${row.pattern}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.deleteForbiddenWord(row.id)
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
.search-bar .el-button {
  margin-left: 0;
}
</style>
