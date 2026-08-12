<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.role" placeholder="角色" clearable @change="handleSearch">
          <el-option label="管理员" value="admin" />
          <el-option label="代理商" value="agent" />
          <el-option label="服务商" value="service_provider" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="banned" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建账号
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="账号ID" prop="openid" min-width="160" show-overflow-tooltip />
        <el-table-column label="昵称" prop="nickName" min-width="120" show-overflow-tooltip />
        <el-table-column label="角色" prop="role" min-width="100">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="真实姓名" prop="realName" min-width="100" show-overflow-tooltip />
        <el-table-column label="手机号" prop="phoneMasked" min-width="120" />
        <el-table-column label="状态" prop="status" min-width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联服务商" prop="serviceProviderName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.serviceProviderName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="warning" size="small" @click="openRoleDialog(row)">修改角色</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'danger' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '停用' : '启用' }}
            </el-button>
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

    <!-- 新建账号对话框 -->
    <el-dialog v-model="createVisible" title="新建账号" width="520px" @closed="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="createForm.nickName" placeholder="请输入昵称" clearable />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="createForm.role" placeholder="请选择角色" style="width: 100%" @change="onCreateRoleChange">
            <el-option label="代理商" value="agent" />
            <el-option label="服务商" value="service_provider" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.role === 'agent'" label="关联服务商" prop="serviceProviderId">
          <el-select v-model="createForm.serviceProviderId" placeholder="请选择关联服务商（可选）" clearable style="width: 100%">
            <el-option v-for="sp in serviceProviderList" :key="sp.id" :label="sp.name" :value="sp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="createForm.realName" placeholder="请输入真实姓名" clearable />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="createForm.phone" placeholder="请输入手机号（登录账号）" clearable maxlength="11" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password placeholder="请输入密码" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑账号对话框 -->
    <el-dialog v-model="editVisible" title="编辑账号" width="520px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="100px">
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="editForm.nickName" placeholder="请输入昵称" clearable />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="editForm.realName" placeholder="请输入真实姓名" clearable />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="请输入新手机号（留空不修改）" clearable maxlength="11" />
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input v-model="editForm.password" type="password" show-password placeholder="请输入新密码（留空不修改）" clearable />
        </el-form-item>
        <el-form-item v-if="editForm.role === 'agent'" label="关联服务商">
          <el-select v-model="editForm.serviceProviderId" placeholder="请选择关联服务商（可选）" clearable style="width: 100%">
            <el-option v-for="sp in serviceProviderList" :key="sp.id" :label="sp.name" :value="sp.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改角色对话框 -->
    <el-dialog v-model="roleVisible" title="修改角色" width="420px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="账号">
          <span>{{ currentRow?.nickName }} ({{ currentRow?.phoneMasked || currentRow?.id?.substring(0, 8) }})</span>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="roleForm.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="代理商" value="agent" />
            <el-option label="服务商" value="service_provider" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpdateRole">确定</el-button>
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
const serviceProviderList = ref([])

const query = reactive({
  role: '',
  status: '',
  page: 1,
  pageSize: 10
})

function formatDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function roleLabel(role) {
  const map = { admin: '管理员', agent: '代理商', service_provider: '服务商' }
  return map[role] || role || '-'
}

function roleTagType(role) {
  const map = { admin: 'danger', agent: 'primary', service_provider: 'success' }
  return map[role] || 'info'
}

async function loadList() {
  loading.value = true
  try {
    const res = await adminAPI.getAccounts(query)
    const data = res.data || {}
    const accounts = data.accounts || data.list || data.records || []
    // 解析关联服务商名称
    list.value = accounts.map(acct => ({
      ...acct,
      serviceProviderName: acct.serviceProvider?.name || (acct.serviceProviderId ? acct.serviceProviderId : null)
    }))
    total.value = data.total || 0
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function loadServiceProviders() {
  try {
    const res = await adminAPI.getServiceProviders()
    const data = res.data || {}
    serviceProviderList.value = data.serviceProviders || []
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  }
}

function handleSearch() {
  query.page = 1
  loadList()
}

function handleReset() {
  query.role = ''
  query.status = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 新建账号 =====
const createVisible = ref(false)
const createFormRef = ref()
const createForm = reactive({
  nickName: '',
  role: '',
  realName: '',
  phone: '',
  password: '',
  serviceProviderId: ''
})

const createRules = {
  nickName: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不合法', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 32, message: '密码长度为 8-32 个字符', trigger: 'blur' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: '需至少含字母和数字', trigger: 'blur' }
  ]
}

function openCreate() {
  loadServiceProviders()
  createVisible.value = true
}

function onCreateRoleChange() {
  // 切换角色时清空关联服务商
  createForm.serviceProviderId = ''
}

function resetCreateForm() {
  createForm.nickName = ''
  createForm.role = ''
  createForm.realName = ''
  createForm.phone = ''
  createForm.password = ''
  createForm.serviceProviderId = ''
  createFormRef.value?.clearValidate()
}

async function handleCreate() {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
    submitting.value = true
    await adminAPI.createAccount({ ...createForm })
    ElMessage.success('账号创建成功')
    createVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

// ===== 编辑账号 =====
const editVisible = ref(false)
const editFormRef = ref()
const editForm = reactive({
  id: '',
  nickName: '',
  realName: '',
  phone: '',
  password: '',
  role: '',
  serviceProviderId: ''
})

const editRules = {
  nickName: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  phone: [
    { pattern: /^$|^1[3-9]\d{9}$/, message: '手机号格式不合法', trigger: 'blur' }
  ],
  password: [
    { pattern: /^$|^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/, message: '密码需8-32位且含字母和数字', trigger: 'blur' }
  ]
}

function openEditDialog(row) {
  loadServiceProviders()
  editForm.id = row.id
  editForm.nickName = row.nickName || ''
  editForm.realName = row.realName || ''
  editForm.phone = ''
  editForm.password = ''
  editForm.role = row.role || ''
  editForm.serviceProviderId = row.serviceProviderId || ''
  editVisible.value = true
}

async function handleEdit() {
  if (!editFormRef.value) return
  try {
    await editFormRef.value.validate()
  } catch { return }

  const data = { nickName: editForm.nickName }
  if (editForm.realName) data.realName = editForm.realName
  if (editForm.phone) data.phone = editForm.phone
  if (editForm.password) data.password = editForm.password
  // 代理商才发送 serviceProviderId
  if (editForm.role === 'agent') {
    data.serviceProviderId = editForm.serviceProviderId || null
  }

  submitting.value = true
  try {
    await adminAPI.updateAccount(editForm.id, data)
    ElMessage.success('账号信息更新成功')
    editVisible.value = false
    loadList()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ===== 修改角色 =====
const roleVisible = ref(false)
const currentRow = ref(null)
const roleForm = reactive({ role: '' })

function openRoleDialog(row) {
  currentRow.value = row
  roleForm.role = row.role
  roleVisible.value = true
}

async function handleUpdateRole() {
  if (!roleForm.role) {
    ElMessage.warning('请选择角色')
    return
  }
  try {
    await ElMessageBox.confirm(`确认修改账号「${currentRow.value?.nickName}」的角色吗？此操作可能影响权限。`, '提示', {
      confirmButtonText: '确定修改',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }
  submitting.value = true
  try {
    await adminAPI.updateAccountRole(currentRow.value.id, { role: roleForm.role, confirm: true })
    ElMessage.success('角色修改成功')
    roleVisible.value = false
    loadList()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ===== 启用/停用 =====
async function handleToggleStatus(row) {
  const action = row.status === 'active' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${action}账号「${row.nickName}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const newStatus = row.status === 'active' ? 'banned' : 'active'
    await adminAPI.updateAccountStatus(row.id, { status: newStatus })
    ElMessage.success(`${action}成功`)
    loadList()
  } catch (err) {
    // 用户取消或请求错误
  }
}

onMounted(() => {
  loadServiceProviders()
  loadList()
})
</script>

<style scoped>
.search-bar .el-button {
  margin-left: 0;
}
</style>
