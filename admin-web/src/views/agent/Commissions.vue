<template>
  <div class="page-container">
    <!-- 分润汇总 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ summary.totalAmount ?? 0 }}</div>
            <div class="stat-label">分润总额</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color: #e6a23c;">{{ summary.pendingAmount ?? 0 }}</div>
            <div class="stat-label">待结算</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color: #67c23a;">{{ summary.settledAmount ?? 0 }}</div>
            <div class="stat-label">已结算</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color: #909399;">{{ summary.count ?? 0 }}</div>
            <div class="stat-label">分润笔数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="search-bar">
      <span style="line-height: 32px; color: #606266;">来源：</span>
      <el-select v-model="query.source" placeholder="全部" clearable style="width: 160px">
        <el-option label="礼品兑换" value="gift_exchange" />
        <el-option label="积分核销" value="write_off" />
        <el-option label="会员服务" value="member_service" />
        <el-option label="其他" value="other" />
      </el-select>
      <span style="line-height: 32px; color: #606266;">状态：</span>
      <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
        <el-option label="待结算" value="pending" />
        <el-option label="已结算" value="settled" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <span style="line-height: 32px; color: #606266;">周期：</span>
      <el-input v-model="query.period" placeholder="如 2026-07" clearable style="width: 140px" />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column label="来源" min-width="130">
          <template #default="{ row }">
            <el-tag>{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" min-width="110" align="right" />
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="period" label="周期" min-width="120" />
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无分润记录" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const summary = ref({})

const query = reactive({
  source: '',
  status: '',
  period: '',
  page: 1,
  pageSize: 10
})

// 时间格式化 YYYY-MM-DD HH:mm:ss
const formatTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const sourceLabel = (s) => {
  const map = {
    gift_exchange: '礼品兑换',
    write_off: '积分核销',
    member_service: '会员服务',
    other: '其他'
  }
  return map[s] || s || '-'
}

const statusLabel = (s) => {
  const map = { pending: '待结算', settled: '已结算', cancelled: '已取消' }
  return map[s] || s || '-'
}

const statusTagType = (s) => {
  const map = { pending: 'warning', settled: 'success', cancelled: 'info' }
  return map[s] || 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getCommissions({
      source: query.source || undefined,
      status: query.status || undefined,
      period: query.period || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    const data = res.data || {}
    list.value = data.commissions || data.list || data.records || []
    total.value = data.total || 0
    // 汇总字段
    summary.value = data.summary || {}
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.page = 1
  loadList()
}

const handleReset = () => {
  query.source = ''
  query.status = ''
  query.period = ''
  query.page = 1
  loadList()
}

const handlePageChange = (p) => {
  query.page = p
  loadList()
}

onMounted(() => {
  loadList()
})
</script>
