<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.promptKey" placeholder="Prompt Key" clearable @change="handleSearch">
          <el-option v-for="opt in promptKeyOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="已激活" value="active" />
          <el-option label="未激活" value="inactive" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建版本
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="Prompt Key" prop="promptKey" min-width="180">
          <template #default="{ row }">
            <span>{{ promptKeyLabel(row.promptKey) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本号" prop="version" min-width="100" align="center">
          <template #default="{ row }">v{{ row.version }}</template>
        </el-table-column>
        <el-table-column label="变更说明" prop="changeLog" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" prop="status" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '已激活' : '未激活' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openContent(row)">查看内容</el-button>
            <el-button
              v-if="row.status !== 'active'"
              link type="success" size="small" @click="handleActivate(row)"
            >激活</el-button>
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

    <!-- 新建版本对话框 -->
    <el-dialog v-model="createVisible" title="新建 Prompt 版本" width="640px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="Prompt Key" prop="promptKey">
          <el-select v-model="form.promptKey" placeholder="请选择" style="width: 100%">
            <el-option v-for="opt in promptKeyOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="8" placeholder="请输入 Prompt 内容" />
        </el-form-item>
        <el-form-item label="变更说明" prop="changeLog">
          <el-input v-model="form.changeLog" type="textarea" :rows="2" placeholder="本次变更说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 查看内容对话框 -->
    <el-dialog v-model="contentVisible" title="Prompt 内容" width="640px">
      <div v-if="currentRow">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Key">{{ promptKeyLabel(currentRow.promptKey) }}</el-descriptions-item>
          <el-descriptions-item label="版本">v{{ currentRow.version }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">内容</el-divider>
        <pre class="prompt-content">{{ currentRow.content }}</pre>
        <div v-if="currentRow.changeLog" class="change-log">
          <el-tag size="small">变更说明</el-tag>
          <span>{{ currentRow.changeLog }}</span>
        </div>
      </div>
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
  promptKey: '',
  status: '',
  page: 1,
  pageSize: 10
})

const promptKeyOptions = [
  { value: 'crisis_hook_system', label: '危机钩子-系统Prompt' },
  { value: 'crisis_hook_user', label: '危机钩子-用户Prompt' },
  { value: '7day_plan_system', label: '7日方案-系统Prompt' },
  { value: '7day_plan_user', label: '7日方案-用户Prompt' }
]

function promptKeyLabel(key) {
  const opt = promptKeyOptions.find((o) => o.value === key)
  return opt ? opt.label : key || '-'
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
    const res = await adminAPI.getPrompts(params)
    const data = res.data || {}
    list.value = data.prompts || data.list || data.records || []
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
  query.promptKey = ''
  query.status = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 新建版本 =====
const createVisible = ref(false)
const formRef = ref()
const form = reactive({
  promptKey: '',
  content: '',
  changeLog: ''
})

const formRules = {
  promptKey: [{ required: true, message: '请选择 Prompt Key', trigger: 'change' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }],
  changeLog: [{ required: true, message: '请输入变更说明', trigger: 'blur' }]
}

function openCreate() {
  createVisible.value = true
}

function resetForm() {
  form.promptKey = ''
  form.content = ''
  form.changeLog = ''
  formRef.value?.clearValidate()
}

async function handleCreate() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    await adminAPI.createPrompt({ ...form })
    ElMessage.success('新建成功')
    createVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

// ===== 查看内容 =====
const contentVisible = ref(false)
const currentRow = ref(null)

function openContent(row) {
  currentRow.value = row
  contentVisible.value = true
}

// ===== 激活 =====
async function handleActivate(row) {
  try {
    await ElMessageBox.confirm(
      `确认激活版本 v${row.version}（${promptKeyLabel(row.promptKey)}）吗？激活后将立即生效。`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await adminAPI.activatePrompt(row.id)
    ElMessage.success('激活成功')
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
.prompt-content {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

.change-log {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}
</style>
