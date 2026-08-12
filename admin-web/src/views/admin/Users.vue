<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="昵称/手机号" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.role" placeholder="角色" clearable @change="handleSearch">
          <el-option label="普通用户" value="user" />
          <el-option label="代理商" value="agent" />
          <el-option label="服务商" value="service_provider" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="正常" value="active" />
          <el-option label="已封禁" value="banned" />
        </el-select>
        <el-select v-model="query.isMember" placeholder="是否会员" clearable @change="handleSearch">
          <el-option label="会员" :value="true" />
          <el-option label="非会员" :value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="昵称" prop="nickName" min-width="120" show-overflow-tooltip />
        <el-table-column label="手机号" prop="phoneMasked" min-width="120" />
        <el-table-column label="角色" prop="role" min-width="100">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '正常' : '已封禁' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="会员" prop="isMember" min-width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isMember ? 'warning' : 'info'" size="small">
              {{ row.isMember ? '会员' : '非会员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" prop="points" min-width="90" align="right" />
        <el-table-column label="注册时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="warning" size="small" @click="openRoleDialog(row)">修改角色</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'danger' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '封禁' : '解封' }}
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

    <!-- 编辑用户对话框 -->
    <el-dialog v-model="editVisible" title="编辑用户" width="560px">
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
        <el-form-item label="性别" prop="gender">
          <el-select v-model="editForm.gender" placeholder="请选择性别" style="width: 100%">
            <el-option label="未知" value="unknown" />
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="editForm.age" :min="0" :max="200" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="身高(cm)" prop="height">
          <el-input-number v-model="editForm.height" :min="0" :max="300" :precision="1" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="体重(kg)" prop="weight">
          <el-input-number v-model="editForm.weight" :min="0" :max="500" :precision="1" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input v-model="editForm.password" type="password" show-password placeholder="请输入新密码（留空不修改）" clearable />
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
        <el-form-item label="用户">
          <span>{{ currentRow?.nickName }} ({{ currentRow?.phoneMasked || currentRow?.id?.substring(0, 8) }})</span>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="roleForm.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="普通用户" value="user" />
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

    <!-- 封禁对话框 -->
    <el-dialog v-model="banVisible" :title="banForm.status === 'banned' ? '封禁用户' : '解封用户'" width="460px">
      <el-form ref="banFormRef" :model="banForm" :rules="banRules" label-width="80px">
        <el-form-item label="用户">
          <span>{{ currentRow?.nickName }} ({{ currentRow?.phoneMasked || '-' }})</span>
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input
            v-model="banForm.reason"
            type="textarea"
            :rows="3"
            :placeholder="banForm.status === 'banned' ? '请输入封禁原因' : '请输入解封原因'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleConfirmBan">确定</el-button>
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
  keyword: '',
  role: '',
  status: '',
  isMember: '',
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
  const map = { user: '普通用户', admin: '管理员', agent: '代理商', service_provider: '服务商' }
  return map[role] || role || '-'
}

function roleTagType(role) {
  const map = { user: 'info', admin: 'danger', agent: 'primary', service_provider: 'success' }
  return map[role] || 'info'
}

async function loadList() {
  loading.value = true
  try {
    const params = { ...query }
    Object.keys(params).forEach((k) => {
      if (params[k] === '' || params[k] === null) delete params[k]
    })
    const res = await adminAPI.getUsers(params)
    const data = res.data || {}
    list.value = data.users || data.list || data.records || []
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
  query.role = ''
  query.status = ''
  query.isMember = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 编辑用户 =====
const editVisible = ref(false)
const editFormRef = ref()
const editForm = reactive({
  id: '',
  nickName: '',
  realName: '',
  phone: '',
  gender: 'unknown',
  age: null,
  height: null,
  weight: null,
  password: ''
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
  editForm.id = row.id
  editForm.nickName = row.nickName || ''
  editForm.realName = row.realName || ''
  editForm.phone = ''
  editForm.gender = row.gender || 'unknown'
  editForm.age = row.age || null
  editForm.height = row.height || null
  editForm.weight = row.weight || null
  editForm.password = ''
  editVisible.value = true
}

async function handleEdit() {
  if (!editFormRef.value) return
  try {
    await editFormRef.value.validate()
  } catch { return }

  const data = { nickName: editForm.nickName, gender: editForm.gender }
  if (editForm.realName) data.realName = editForm.realName
  if (editForm.phone) data.phone = editForm.phone
  if (editForm.age !== null && editForm.age !== undefined) data.age = editForm.age
  if (editForm.height !== null && editForm.height !== undefined) data.height = editForm.height
  if (editForm.weight !== null && editForm.weight !== undefined) data.weight = editForm.weight
  if (editForm.password) data.password = editForm.password

  submitting.value = true
  try {
    await adminAPI.updateUser(editForm.id, data)
    ElMessage.success('用户信息更新成功')
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
    await ElMessageBox.confirm(`确认修改用户「${currentRow.value?.nickName}」的角色吗？`, '提示', {
      confirmButtonText: '确定修改',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }
  submitting.value = true
  try {
    await adminAPI.updateUserRole(currentRow.value.id, { role: roleForm.role, confirm: true })
    ElMessage.success('角色修改成功')
    roleVisible.value = false
    loadList()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ===== 封禁/解封 =====
const banVisible = ref(false)
const banFormRef = ref()
const banForm = reactive({ status: 'banned', reason: '' })
const banRules = {
  reason: [{ required: true, message: '请输入原因', trigger: 'blur' }]
}

async function handleToggleStatus(row) {
  const action = row.status === 'active' ? '封禁' : '解封'
  try {
    await ElMessageBox.confirm(`确认${action}用户「${row.nickName}」吗？`, '提示', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning'
    })
    currentRow.value = row
    banForm.status = row.status === 'active' ? 'banned' : 'active'
    banForm.reason = ''
    banVisible.value = true
  } catch (err) {
    // 用户取消
  }
}

async function handleConfirmBan() {
  if (!banFormRef.value) return
  try {
    await banFormRef.value.validate()
    submitting.value = true
    await adminAPI.updateUserStatus(currentRow.value.id, {
      status: banForm.status,
      reason: banForm.reason
    })
    ElMessage.success(banForm.status === 'banned' ? '封禁成功' : '解封成功')
    banVisible.value = false
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
.search-bar .el-button {
  margin-left: 0;
}
</style>
