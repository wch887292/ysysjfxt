<template>
  <div class="page-container">
    <!-- 阈值查询栏 -->
    <div class="search-bar">
      <span style="line-height: 32px; color: #606266;">未活跃天数阈值：</span>
      <el-input-number
        v-model="query.days"
        :min="1"
        :max="30"
        :step="1"
        controls-position="right"
        style="width: 140px"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
      <span style="margin-left: auto; color: #909399; font-size: 13px;">
        共 {{ total }} 位流失预警用户
      </span>
    </div>

    <!-- 列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="nickname" label="昵称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="openid" label="openid" min-width="220" show-overflow-tooltip />
        <el-table-column label="最后活跃时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.lastActiveAt) }}
          </template>
        </el-table-column>
        <el-table-column label="未活跃天数" min-width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="daysTagType(row.daysInactive)">
              {{ row.daysInactive ?? 0 }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goAlerts(row)">标记跟进</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无流失预警用户" />
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
import { useRouter } from 'vue-router'
import { agentAPI } from '@/api/agent'

const router = useRouter()

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  days: 3,
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

// 未活跃天数标签：>7 danger，>3 warning，其余 info
const daysTagType = (days) => {
  const d = Number(days) || 0
  if (d > 7) return 'danger'
  if (d > 3) return 'warning'
  return 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getInactiveUsers({
      days: query.days,
      page: query.page,
      pageSize: query.pageSize
    })
    const data = res.data || {}
    list.value = data.users || data.list || data.records || []
    total.value = data.total || 0
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
  query.days = 3
  query.page = 1
  loadList()
}

const handlePageChange = (p) => {
  query.page = p
  loadList()
}

// 标记跟进 → 跳转到预警跟进页
const goAlerts = (row) => {
  router.push({ path: '/agent/alerts', query: { userId: row.id } })
}

onMounted(() => {
  loadList()
})
</script>
