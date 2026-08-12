<template>
  <div class="page-container">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="profile-header">
          <span>网点信息</span>
          <div>
            <el-button v-if="!editing" type="primary" @click="startEdit">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button v-if="editing" @click="cancelEdit">取消</el-button>
            <el-button v-if="editing" type="primary" :loading="submitting" @click="handleSave">
              保存
            </el-button>
            <el-button @click="loadProfile">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- 展示模式 -->
      <el-descriptions v-if="!editing" :column="2" border>
        <el-descriptions-item label="网点名称">{{ profile?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ maskedPhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ profile?.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="地址">{{ profile?.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="网点ID">{{ profile?.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(profile?.createdAt) || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 编辑模式 -->
      <el-form
        v-else
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 640px;"
      >
        <el-form-item label="网点名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入网点名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入完整手机号（11位）" maxlength="11" />
          <div class="form-tip">请输入完整手机号，保存后系统将自动加密存储</div>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="100" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input
            v-model="form.address"
            type="textarea"
            :rows="2"
            placeholder="请输入网点地址"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          手机号字段需输入完整的 11 位手机号；如不修改手机号，请留空
        </el-alert>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Refresh } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const loading = ref(false)
const submitting = ref(false)
const editing = ref(false)
const formRef = ref()

const profile = ref(null)

const form = reactive({
  name: '',
  phone: '',
  email: '',
  address: ''
})

// 手机号校验：可空（不修改）或 11 位完整手机号
const validatePhone = (rule, value, callback) => {
  if (!value) {
    // 留空表示不修改
    callback()
    return
  }
  if (!/^1[3-9]\d{9}$/.test(value)) {
    callback(new Error('请输入正确的 11 位手机号'))
  } else {
    callback()
  }
}

const validateEmail = (rule, value, callback) => {
  if (!value) {
    callback()
    return
  }
  if (!/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(value)) {
    callback(new Error('请输入正确的邮箱格式'))
  } else {
    callback()
  }
}

const rules = {
  name: [
    { required: true, message: '请输入网点名称', trigger: 'blur' },
    { min: 2, max: 50, message: '网点名称长度为 2-50 个字符', trigger: 'blur' }
  ],
  phone: [
    { validator: validatePhone, trigger: 'blur' }
  ],
  email: [
    { validator: validateEmail, trigger: 'blur' }
  ],
  address: [
    { max: 200, message: '地址长度不超过 200 个字符', trigger: 'blur' }
  ]
}

// 脱敏手机号：保留前3位和后4位，中间用 **** 替换
const maskedPhone = computed(() => {
  const phone = profile.value?.phone || profile.value?.mobile || ''
  if (!phone) return ''
  // 后端返回的可能是脱敏后的字符串，也可能直接是明文
  if (phone.length === 11 && /^\d{11}$/.test(phone)) {
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
  return phone
})

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadProfile() {
  loading.value = true
  try {
    const res = await serviceProviderAPI.getProfile()
    profile.value = res.data || null
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

function startEdit() {
  form.name = profile.value?.name || ''
  // 编辑时手机号留空，由用户决定是否填写新号码
  form.phone = ''
  form.email = profile.value?.email || ''
  form.address = profile.value?.address || ''
  editing.value = true
  formRef.value?.clearValidate()
}

async function cancelEdit() {
  try {
    await ElMessageBox.confirm('确定要放弃当前编辑吗？修改将不会保存', '提示', {
      confirmButtonText: '放弃',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
    editing.value = false
  } catch {
    // 取消放弃
  }
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const payload = {
      name: form.name,
      email: form.email,
      address: form.address
    }
    // 仅在用户填写了手机号时才传递，避免误清空
    if (form.phone) {
      payload.phone = form.phone
    }
    await serviceProviderAPI.updateProfile(payload)
    ElMessage.success('网点信息更新成功')
    editing.value = false
    await loadProfile()
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile-header > div {
  display: flex;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin-top: 4px;
}
</style>
