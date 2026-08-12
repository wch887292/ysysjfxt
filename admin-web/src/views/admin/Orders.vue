<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-select v-model="query.status" placeholder="订单状态" clearable @change="handleSearch">
          <el-option label="待处理" value="pending" />
          <el-option label="已完成" value="completed" />
          <el-option label="已退款" value="refunded" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-input v-model="query.giftId" placeholder="礼品ID" clearable @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="订单号" prop="orderNo" min-width="180" show-overflow-tooltip />
        <el-table-column label="用户" prop="userNickName" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.userNickName || row.userName || '-' }}</template>
        </el-table-column>
        <el-table-column label="礼品" prop="giftName" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.giftName || row.gift?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="积分/现金" min-width="140" align="right">
          <template #default="{ row }">
            <span v-if="row.points" class="points-text">{{ row.points }} 积分</span>
            <span v-if="row.points && row.cashPrice"> + </span>
            <span v-if="row.cashPrice">¥{{ Number(row.cashPrice).toFixed(2) }}</span>
            <span v-if="!row.points && !row.cashPrice">-</span>
          </template>
        </el-table-column>
        <el-table-column label="数量" prop="quantity" min-width="80" align="center">
          <template #default="{ row }">×{{ row.quantity || 1 }}</template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="兑换时间" prop="createdAt" min-width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt || row.exchangedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canRefund(row.status)"
              link type="warning" size="small" @click="openRefund(row)"
            >退款</el-button>
            <span v-else class="text-muted">-</span>
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

    <!-- 退款对话框 -->
    <el-dialog v-model="refundVisible" title="订单退款" width="480px">
      <el-form ref="refundFormRef" :model="refundForm" :rules="refundRules" label-width="90px">
        <el-form-item label="订单号">
          <span>{{ currentRow?.orderNo }}</span>
        </el-form-item>
        <el-form-item label="礼品">
          <span>{{ currentRow?.giftName || currentRow?.gift?.name || '-' }}</span>
        </el-form-item>
        <el-form-item label="退款原因" prop="reason">
          <el-input v-model="refundForm.reason" type="textarea" :rows="3" placeholder="请输入退款原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleConfirmRefund">确认退款</el-button>
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
  status: '',
  giftId: '',
  page: 1,
  pageSize: 10
})

function statusLabel(status) {
  const map = { pending: '待处理', completed: '已完成', refunded: '已退款', cancelled: '已取消' }
  return map[status] || status || '-'
}

function statusTagType(status) {
  const map = { pending: 'warning', completed: 'success', refunded: 'info', cancelled: 'danger' }
  return map[status] || 'info'
}

function canRefund(status) {
  return status === 'pending' || status === 'completed'
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
    const res = await adminAPI.getOrders(params)
    const data = res.data || {}
    list.value = data.orders || data.list || data.records || []
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
  query.status = ''
  query.giftId = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 退款 =====
const refundVisible = ref(false)
const refundFormRef = ref()
const currentRow = ref(null)
const refundForm = reactive({ reason: '' })
const refundRules = {
  reason: [{ required: true, message: '请输入退款原因', trigger: 'blur' }]
}

async function openRefund(row) {
  try {
    await ElMessageBox.confirm(`确认对订单「${row.orderNo}」发起退款吗？`, '提示', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning'
    })
    currentRow.value = row
    refundForm.reason = ''
    refundVisible.value = true
  } catch (err) {
    // 用户取消
  }
}

async function handleConfirmRefund() {
  if (!refundFormRef.value) return
  try {
    await refundFormRef.value.validate()
    submitting.value = true
    await adminAPI.refundOrder(currentRow.value.id, { reason: refundForm.reason })
    ElMessage.success('退款成功')
    refundVisible.value = false
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
.points-text {
  color: #e6a23c;
  font-weight: 600;
}

.text-muted {
  color: #c0c4cc;
}

.search-bar .el-button {
  margin-left: 0;
}
</style>
