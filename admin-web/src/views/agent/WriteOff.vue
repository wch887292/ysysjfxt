<template>
  <div class="page-container">
    <el-card shadow="never">
      <template #header>
        <span>积分核销</span>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 560px"
        v-loading="loading"
      >
        <el-form-item label="用户" prop="userId">
          <el-select
            v-model="form.userId"
            filterable
            remote
            reserve-keyword
            placeholder="请输入昵称/openid 搜索"
            :remote-method="searchUsers"
            :loading="userLoading"
            style="width: 100%"
          >
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.nickname || '未命名'}（${u.openid || u.id}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="核销积分" prop="points">
          <el-input-number
            v-model="form.points"
            :min="1"
            :max="999999"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="礼品描述" prop="giftDescription">
          <el-input
            v-model="form.giftDescription"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="请输入礼品描述"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="请输入备注（选填）"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submit">提交核销</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 核销结果 -->
    <el-card v-if="result" shadow="never" class="card-gap">
      <template #header>
        <span style="color: #67c23a;">核销成功</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户ID">{{ result.userId || form.userId }}</el-descriptions-item>
        <el-descriptions-item label="核销积分">{{ result.points ?? form.points }}</el-descriptions-item>
        <el-descriptions-item label="核销前余额">{{ result.beforeBalance ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="核销后余额">{{ result.afterBalance ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="核销单号">{{ result.writeOffId || result.id || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const submitting = ref(false)
const userLoading = ref(false)
const userOptions = ref([])
const result = ref(null)

const formRef = ref(null)
const form = reactive({
  userId: '',
  points: 1,
  giftDescription: '',
  remark: ''
})

const rules = {
  userId: [{ required: true, message: '请选择用户', trigger: 'change' }],
  points: [{ required: true, message: '请输入核销积分', trigger: 'change' }],
  giftDescription: [{ required: true, message: '请输入礼品描述', trigger: 'blur' }]
}

// 幂等键：基于 userId + 5 分钟时间窗口
const genIdempotencyKey = (uid) => {
  return `WO_${uid}_${Math.floor(Date.now() / 300000)}`
}

// 加载用户下拉
const loadUsers = async (keyword) => {
  userLoading.value = true
  try {
    const res = await agentAPI.getUsers({ keyword, page: 1, pageSize: 100 })
    const data = res.data || {}
    userOptions.value = data.users || data.list || data.records || []
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    userLoading.value = false
  }
}

const searchUsers = (keyword) => {
  loadUsers(keyword)
}

const submit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    const payload = {
      userId: form.userId,
      points: form.points,
      giftDescription: form.giftDescription,
      remark: form.remark,
      idempotencyKey: genIdempotencyKey(form.userId)
    }
    const res = await agentAPI.writeOffPoints(payload)
    ElMessage.success('核销成功')
    result.value = res.data || {}
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

const reset = () => {
  formRef.value?.resetFields()
  result.value = null
}

onMounted(() => {
  // 预加载用户选项
  loadUsers()
})
</script>
