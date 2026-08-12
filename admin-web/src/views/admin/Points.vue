<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-input v-model="query.userId" placeholder="用户ID" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.source" placeholder="来源" clearable @change="handleSearch">
          <el-option label="签到" value="sign_in" />
          <el-option label="打卡" value="clock_in" />
          <el-option label="课程" value="course" />
          <el-option label="邀请" value="invite" />
          <el-option label="兑换" value="redeem" />
          <el-option label="人工调整" value="adjust" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="query.type" placeholder="类型" clearable @change="handleSearch">
          <el-option label="获得" value="earn" />
          <el-option label="消耗" value="deduct" />
          <el-option label="调整" value="adjust" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="warning" @click="openAdjust">
          <el-icon><EditPen /></el-icon> 人工调整
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="用户" prop="userNickName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.userNickName || row.userName || '-' }}</template>
        </el-table-column>
        <el-table-column label="来源" prop="source" min-width="110">
          <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
        </el-table-column>
        <el-table-column label="类型" prop="type" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分变动" prop="points" min-width="110" align="right">
          <template #default="{ row }">
            <span :class="row.points >= 0 ? 'points-add' : 'points-sub'">
              {{ row.points >= 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="余额" prop="balance" min-width="100" align="right">
          <template #default="{ row }">{{ row.balance ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || row.reason || '-' }}</template>
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

    <!-- 人工调整对话框 -->
    <el-dialog v-model="adjustVisible" title="人工调整积分" width="480px" @closed="resetAdjustForm">
      <el-alert title="注意：人工调整将直接修改用户积分余额，请谨慎操作" type="warning" :closable="false" show-icon style="margin-bottom: 16px;" />
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="90px">
        <el-form-item label="用户ID" prop="userId">
          <el-input v-model="adjustForm.userId" placeholder="请输入用户ID" clearable />
        </el-form-item>
        <el-form-item label="积分" prop="points">
          <el-input-number
            v-model="adjustForm.points"
            :step="1"
            controls-position="right"
            placeholder="正数为增加，负数为扣除"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="adjustForm.reason" type="textarea" :rows="3" placeholder="请输入调整原因" />
        </el-form-item>
        <el-form-item label="确认" prop="confirm">
          <el-input
            v-model="adjustForm.confirm"
            placeholder="请输入「确认调整」以提交"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdjust">提交调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  userId: '',
  source: '',
  type: '',
  page: 1,
  pageSize: 10
})

function typeLabel(type) {
  const map = { earn: '获得', deduct: '消耗', adjust: '调整' }
  return map[type] || type || '-'
}

function typeTagType(type) {
  const map = { earn: 'success', deduct: 'danger', adjust: 'warning' }
  return map[type] || 'info'
}

function sourceLabel(source) {
  const map = {
    sign_in: '签到',
    clock_in: '打卡',
    course: '课程',
    invite: '邀请',
    redeem: '兑换',
    adjust: '人工调整',
    other: '其他'
  }
  return map[source] || source || '-'
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
    const res = await adminAPI.getPointsHistory(params)
    const data = res.data || {}
    list.value = data.history || data.list || data.records || []
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
  query.userId = ''
  query.source = ''
  query.type = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 人工调整 =====
const adjustVisible = ref(false)
const adjustFormRef = ref()
const adjustForm = reactive({
  userId: '',
  points: 0,
  reason: '',
  confirm: ''
})

const adjustRules = {
  userId: [{ required: true, message: '请输入用户ID', trigger: 'blur' }],
  points: [
    { required: true, message: '请输入积分', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value === 0) {
          callback(new Error('积分不能为0'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  confirm: [
    { required: true, message: '请输入确认文字', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== '确认调整') {
          callback(new Error('请输入「确认调整」'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

function openAdjust() {
  adjustVisible.value = true
}

function resetAdjustForm() {
  adjustForm.userId = ''
  adjustForm.points = 0
  adjustForm.reason = ''
  adjustForm.confirm = ''
  adjustFormRef.value?.clearValidate()
}

async function handleAdjust() {
  if (!adjustFormRef.value) return
  try {
    await adjustFormRef.value.validate()
    submitting.value = true
    await adminAPI.adjustPoints({
      userId: adjustForm.userId,
      points: adjustForm.points,
      reason: adjustForm.reason,
      confirm: true  // 后端必传校验：二次确认机制
    })
    ElMessage.success('积分调整成功')
    adjustVisible.value = false
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
.points-add {
  color: #67c23a;
  font-weight: 600;
}

.points-sub {
  color: #f56c6c;
  font-weight: 600;
}

.search-bar .el-button {
  margin-left: 0;
}
</style>
