<template>
  <div class="page-container">
    <el-card shadow="never">
      <template #header>
        <span>礼品核销</span>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 560px"
        v-loading="loading"
      >
        <el-form-item label="核销码" prop="writeOffCode">
          <el-input
            v-model="form.writeOffCode"
            placeholder="请输入礼品核销码"
            clearable
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submit">核销</el-button>
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
        <el-descriptions-item label="礼品名称">{{ result.giftName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="礼品描述">{{ result.giftDescription || '-' }}</el-descriptions-item>
        <el-descriptions-item label="兑换积分">{{ result.points ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="核销码">{{ result.writeOffCode || form.writeOffCode }}</el-descriptions-item>
        <el-descriptions-item label="核销单号">{{ result.writeOffId || result.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="核销时间">{{ formatTime(result.redeemedAt || result.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const submitting = ref(false)
const result = ref(null)

const formRef = ref(null)
const form = reactive({
  writeOffCode: ''
})

const rules = {
  writeOffCode: [{ required: true, message: '请输入核销码', trigger: 'blur' }]
}

// 时间格式化 YYYY-MM-DD HH:mm:ss
const formatTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 幂等键：基于核销码 + 5 分钟时间窗口
const genIdempotencyKey = (code) => {
  return `RD_${code}_${Math.floor(Date.now() / 300000)}`
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
      writeOffCode: form.writeOffCode,
      idempotencyKey: genIdempotencyKey(form.writeOffCode)
    }
    const res = await agentAPI.redeemGift(payload)
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
</script>
