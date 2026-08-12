<template>
  <div class="page-container">
    <!-- 顶部阈值控制 -->
    <el-card class="card-gap">
      <div class="search-bar">
        <span>未活跃阈值（天）：</span>
        <el-input-number
          v-model="query.days"
          :min="1"
          :max="30"
          :step="1"
          controls-position="right"
          size="default"
        />
        <el-input
          v-model="query.keyword"
          placeholder="搜索昵称 / openid"
          clearable
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          查询
        </el-button>
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置
        </el-button>
      </div>
    </el-card>

    <!-- 预警列表 -->
    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column label="昵称" prop="nickName" min-width="120" show-overflow-tooltip />
        <el-table-column label="openid" prop="openid" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono-text">{{ row.openid || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最后活跃时间" prop="lastActiveTime" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.lastActiveTime) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="未活跃天数" prop="daysInactive" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="inactiveTagType(row.daysInactive)" size="small">
              {{ row.daysInactive ?? '-' }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看详情</el-button>
            <el-button link type="warning" size="small" @click="markFollowUp(row)">标记跟进</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无未活跃客户" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailVisible"
      title="客户详情"
      size="480px"
      direction="rtl"
    >
      <div v-loading="detailLoading">
        <el-empty v-if="!detail && !detailLoading" description="暂无数据" />
        <el-descriptions v-else :column="1" border>
          <el-descriptions-item label="用户ID">{{ detail?.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ detail?.nickName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="openid">
            <span class="mono-text">{{ detail?.openid || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="身份类型">
            <el-tag size="small" type="info">{{ detail?.identityType || '普通用户' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="是否会员">
            <el-tag v-if="detail?.isMember || detail?.member" size="small" type="success">会员</el-tag>
            <el-tag v-else size="small" type="info">非会员</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="积分">{{ detail?.points ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail?.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最后活跃时间">{{ formatDateTime(detail?.lastActiveTime) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="未活跃天数">
            <el-tag :type="inactiveTagType(detail?.daysInactive)" size="small">
              {{ detail?.daysInactive ?? '-' }} 天
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatDateTime(detail?.createdAt) || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const router = useRouter()

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  days: 3,
  keyword: '',
  page: 1,
  pageSize: 10
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 未活跃天数标签类型：>7 天 danger，>3 天 warning，其余 info
function inactiveTagType(days) {
  const n = Number(days)
  if (isNaN(n)) return 'info'
  if (n > 7) return 'danger'
  if (n > 3) return 'warning'
  return 'info'
}

async function loadList() {
  loading.value = true
  try {
    const params = {
      days: query.days,
      page: query.page,
      pageSize: query.pageSize
    }
    if (query.keyword) params.keyword = query.keyword
    const res = await serviceProviderAPI.getInactiveUsers(params)
    const data = res.data || {}
    list.value = data.users || data.list || data.records || data.items || []
    total.value = data.total || 0
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadList()
}

function handleReset() {
  query.days = 3
  query.keyword = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

function handleSizeChange(size) {
  query.pageSize = size
  query.page = 1
  loadList()
}

async function viewDetail(row) {
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    const res = await serviceProviderAPI.getUserDetail(row.id)
    detail.value = { ...res.data, daysInactive: row.daysInactive }
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    detailLoading.value = false
  }
}

// 标记跟进：跳转到预警跟进页面
function markFollowUp(row) {
  router.push({
    path: '/service-provider/alerts',
    query: { userId: row.id, from: 'inactive' }
  })
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.mono-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
