<template>
  <div class="page-container">
    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="6" v-for="item in summaryCards" :key="item.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-input v-model="query.agentId" placeholder="代理商ID" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="待结算" value="pending" />
          <el-option label="已结算" value="settled" />
          <el-option label="已取消" value="cancelled" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-date-picker
          v-model="query.period"
          type="month"
          placeholder="选择周期"
          format="YYYY-MM"
          value-format="YYYY-MM"
          clearable
          @change="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button
          type="success"
          :disabled="!selectedRows.length"
          @click="openSettle"
        >
          <el-icon><Check /></el-icon> 批量结算 ({{ selectedRows.length }})
        </el-button>
        <el-button
          type="warning"
          :disabled="!selectedRows.length"
          @click="openCancel"
        >
          批量取消 ({{ selectedRows.length }})
        </el-button>
        <el-button
          type="danger"
          :disabled="!selectedRows.length"
          @click="openReject"
        >
          批量驳回 ({{ selectedRows.length }})
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table
        :data="list"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" :selectable="(row) => row.status === 'pending'" />
        <el-table-column label="代理商" prop="agentName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.agentName || row.agentNickName || '-' }}</template>
        </el-table-column>
        <el-table-column label="来源" prop="source" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
        </el-table-column>
        <el-table-column label="金额" prop="amount" min-width="110" align="right">
          <template #default="{ row }">
            <span class="amount-text">¥{{ Number(row.amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="周期" prop="period" min-width="110">
          <template #default="{ row }">{{ row.period || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="结算时间" prop="settledAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.settledAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="success"
              size="small"
              @click="openSettleRow(row)"
            >结算</el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="warning"
              size="small"
              @click="openCancelRow(row)"
            >取消</el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="danger"
              size="small"
              @click="openRejectRow(row)"
            >驳回</el-button>
            <span v-if="row.status !== 'pending'" class="no-action">-</span>
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

    <!-- 批量结算对话框 -->
    <el-dialog v-model="settleVisible" title="批量结算分润" width="480px">
      <el-form ref="settleFormRef" :model="settleForm" :rules="settleRules" label-width="90px">
        <el-form-item label="选中条数">
          <span>{{ selectedRows.length }} 条</span>
        </el-form-item>
        <el-form-item label="总金额">
          <span class="amount-text">¥{{ selectedAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="结算备注" prop="remark">
          <el-input v-model="settleForm.remark" type="textarea" :rows="3" placeholder="请输入结算备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settleVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleConfirmSettle">确认结算</el-button>
      </template>
    </el-dialog>

    <!-- 批量取消对话框 -->
    <el-dialog v-model="cancelVisible" title="批量取消分润" width="480px">
      <el-form ref="cancelFormRef" :model="cancelForm" label-width="90px">
        <el-form-item label="选中条数">
          <span>{{ selectedRows.length }} 条</span>
        </el-form-item>
        <el-form-item label="总金额">
          <span class="amount-text">¥{{ selectedAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="取消原因" prop="remark">
          <el-input v-model="cancelForm.remark" type="textarea" :rows="3" placeholder="请输入取消原因（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelVisible = false">关闭</el-button>
        <el-button type="warning" :loading="submitting" @click="handleConfirmCancel">确认取消</el-button>
      </template>
    </el-dialog>

    <!-- 批量驳回对话框 -->
    <el-dialog v-model="rejectVisible" title="批量驳回分润" width="480px">
      <el-form ref="rejectFormRef" :model="rejectForm" label-width="90px">
        <el-form-item label="选中条数">
          <span>{{ selectedRows.length }} 条</span>
        </el-form-item>
        <el-form-item label="总金额">
          <span class="amount-text">¥{{ selectedAmount.toFixed(2) }}</span>
        </el-form-item>
        <el-form-item label="驳回原因" prop="remark">
          <el-input v-model="rejectForm.remark" type="textarea" :rows="3" placeholder="请输入驳回原因（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">关闭</el-button>
        <el-button type="danger" :loading="submitting" @click="handleConfirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)
const selectedRows = ref([])
const summary = ref({})

const query = reactive({
  agentId: '',
  status: '',
  period: '',
  page: 1,
  pageSize: 10
})

// 汇总卡片
const summaryCards = computed(() => [
  { label: '待结算笔数', value: summary.value.pendingCount ?? 0 },
  { label: '待结算金额', value: `¥${Number(summary.value.pendingAmount || 0).toFixed(2)}` },
  { label: '已结算笔数', value: summary.value.settledCount ?? 0 },
  { label: '已结算金额', value: `¥${Number(summary.value.settledAmount || 0).toFixed(2)}` },
  { label: '已取消笔数', value: summary.value.cancelledCount ?? 0 },
  { label: '已驳回笔数', value: summary.value.rejectedCount ?? 0 }
])

const selectedAmount = computed(() => {
  return selectedRows.value.reduce((sum, row) => sum + Number(row.amount || 0), 0)
})

function statusLabel(status) {
  const map = { pending: '待结算', settled: '已结算', cancelled: '已取消', rejected: '已驳回' }
  return map[status] || status || '-'
}

function statusTagType(status) {
  const map = { pending: 'warning', settled: 'success', cancelled: 'info', rejected: 'danger' }
  return map[status] || 'info'
}

function sourceLabel(source) {
  const map = {
    gift_exchange: '礼品兑换',
    write_off: '积分核销',
    member_service: '会员服务',
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
    const res = await adminAPI.getCommissions(params)
    const data = res.data || {}
    list.value = data.commissions || data.list || data.records || []
    total.value = data.total || 0
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const params = {}
    if (query.period) params.period = query.period
    if (query.status) params.status = query.status
    const res = await adminAPI.getCommissionsSummary(params)
    summary.value = res.data || {}
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  }
}

function handleSearch() {
  query.page = 1
  loadList()
  loadSummary()
}

function handleReset() {
  query.agentId = ''
  query.status = ''
  query.period = ''
  query.page = 1
  loadList()
  loadSummary()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// ===== 批量结算 =====
const settleVisible = ref(false)
const settleFormRef = ref()
const settleForm = reactive({ remark: '' })
const settleRules = {
  remark: [{ required: true, message: '请输入结算备注', trigger: 'blur' }]
}

function openSettle() {
  settleForm.remark = ''
  settleVisible.value = true
}

async function handleConfirmSettle() {
  if (!settleFormRef.value) return
  try {
    await settleFormRef.value.validate()
    submitting.value = true
    await adminAPI.settleCommissions({
      commissionIds: selectedRows.value.map((r) => r.id),
      remark: settleForm.remark
    })
    ElMessage.success('结算成功')
    settleVisible.value = false
    loadList()
    loadSummary()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

// ===== 批量取消 =====
const cancelVisible = ref(false)
const cancelFormRef = ref()
const cancelForm = reactive({ remark: '' })

function openCancel() {
  cancelForm.remark = ''
  cancelVisible.value = true
}

async function handleConfirmCancel() {
  submitting.value = true
  try {
    await adminAPI.cancelCommissions({
      commissionIds: selectedRows.value.map((r) => r.id),
      remark: cancelForm.remark
    })
    ElMessage.success('取消成功')
    cancelVisible.value = false
    loadList()
    loadSummary()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ===== 批量驳回 =====
const rejectVisible = ref(false)
const rejectFormRef = ref()
const rejectForm = reactive({ remark: '' })

function openReject() {
  rejectForm.remark = ''
  rejectVisible.value = true
}

async function handleConfirmReject() {
  submitting.value = true
  try {
    await adminAPI.rejectCommissions({
      commissionIds: selectedRows.value.map((r) => r.id),
      remark: rejectForm.remark
    })
    ElMessage.success('驳回成功')
    rejectVisible.value = false
    loadList()
    loadSummary()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// ===== 单行操作 =====
async function openSettleRow(row) {
  try {
    await ElMessageBox.confirm(
      `确认结算该条分润？金额：¥${Number(row.amount || 0).toFixed(2)}`,
      '结算确认',
      { confirmButtonText: '确认结算', cancelButtonText: '取消', type: 'success' }
    )
    submitting.value = true
    await adminAPI.settleCommissions({
      commissionIds: [row.id],
      remark: '单条结算'
    })
    ElMessage.success('结算成功')
    loadList()
    loadSummary()
  } catch (err) {
    if (err !== 'cancel') throw err
  } finally {
    submitting.value = false
  }
}

async function openCancelRow(row) {
  try {
    await ElMessageBox.confirm(
      `确认取消该条分润？金额：¥${Number(row.amount || 0).toFixed(2)}`,
      '取消确认',
      { confirmButtonText: '确认取消', cancelButtonText: '取消', type: 'warning' }
    )
    submitting.value = true
    await adminAPI.cancelCommissions({
      commissionIds: [row.id],
      remark: '单条取消'
    })
    ElMessage.success('取消成功')
    loadList()
    loadSummary()
  } catch (err) {
    if (err !== 'cancel') throw err
  } finally {
    submitting.value = false
  }
}

async function openRejectRow(row) {
  try {
    await ElMessageBox.confirm(
      `确认驳回该条分润？金额：¥${Number(row.amount || 0).toFixed(2)}`,
      '驳回确认',
      { confirmButtonText: '确认驳回', cancelButtonText: '取消', type: 'danger' }
    )
    submitting.value = true
    await adminAPI.rejectCommissions({
      commissionIds: [row.id],
      remark: '单条驳回'
    })
    ElMessage.success('驳回成功')
    loadList()
    loadSummary()
  } catch (err) {
    if (err !== 'cancel') throw err
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadList()
  loadSummary()
})
</script>

<style scoped>
.amount-text {
  color: #f56c6c;
  font-weight: 600;
}

.search-bar .el-button {
  margin-left: 0;
}

.no-action {
  color: #999;
}
</style>
