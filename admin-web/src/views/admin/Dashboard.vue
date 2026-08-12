<template>
  <div class="page-container" v-loading="loading">
    <!-- 用户概览 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalUsers ?? 0 }}</div>
            <div class="stat-label">用户总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.totalMembers ?? 0 }}</div>
            <div class="stat-label">会员数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.totalAgents ?? 0 }}</div>
            <div class="stat-label">代理商</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#409eff;">{{ s.totalServiceProviders ?? 0 }}</div>
            <div class="stat-label">服务商</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#f56c6c;">{{ s.newUsersToday ?? 0 }}</div>
            <div class="stat-label">今日新增</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#909399;">{{ s.totalAdmins ?? 0 }}</div>
            <div class="stat-label">管理员</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 活跃与积分 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.activeUsersToday ?? 0 }}</div>
            <div class="stat-label">今日活跃</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.activeUsersWeek ?? 0 }}</div>
            <div class="stat-label">周活跃</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.activeUsersMonth ?? 0 }}</div>
            <div class="stat-label">月活跃</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ formatNum(s.totalPointsIssued) }}</div>
            <div class="stat-label">积分发放总量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#f56c6c;">{{ formatNum(s.totalPointsUsed) }}</div>
            <div class="stat-label">积分消耗总量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.newUsersMonth ?? 0 }}</div>
            <div class="stat-label">本月新增用户</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 业务统计 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalMeals ?? 0 }}</div>
            <div class="stat-label">饮食记录</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.todayCheckIns ?? 0 }}</div>
            <div class="stat-label">今日打卡</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#409eff;">{{ s.todaySignIns ?? 0 }}</div>
            <div class="stat-label">今日签到</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalCourses ?? 0 }}</div>
            <div class="stat-label">课程学习</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.totalExchanges ?? 0 }}</div>
            <div class="stat-label">礼品兑换</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#f56c6c;">{{ s.totalCommissions ?? 0 }}</div>
            <div class="stat-label">分润记录</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办与快捷入口 -->
    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="card-gap">
          <template #header>
            <div class="card-header"><span>待办事项</span></div>
          </template>
          <div v-for="todo in todoItems" :key="todo.label" class="todo-item">
            <div class="todo-info">
              <el-tag :type="todo.type" size="small" effect="plain">{{ todo.tag }}</el-tag>
              <span class="todo-label">{{ todo.label }}</span>
            </div>
            <div class="todo-action">
              <span class="todo-count">{{ todo.count }}</span>
              <el-button type="primary" link size="small" @click="router.push(todo.path)">去处理</el-button>
            </div>
          </div>
          <el-empty v-if="!todoItems.length" description="暂无待办" :image-size="80" />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="card-gap">
          <template #header>
            <div class="card-header"><span>快捷入口</span></div>
          </template>
          <div class="quick-entry">
            <div v-for="entry in quickEntries" :key="entry.path" class="quick-item" @click="router.push(entry.path)">
              <el-icon :size="24" :color="entry.color"><component :is="entry.icon" /></el-icon>
              <span class="quick-label">{{ entry.label }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminAPI } from '@/api/admin'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const s = ref({})

function formatNum(v) {
  if (v == null) return '0'
  return Number(v).toLocaleString()
}

const todoItems = computed(() => [
  { tag: '报告', label: '待复核报告', count: s.value.pendingReports ?? 0, type: 'danger', path: '/admin/reports' },
  { tag: '图文', label: '待审核图文', count: s.value.pendingPosts ?? 0, type: 'warning', path: '/admin/posts' },
  { tag: '分润', label: '待结算分润', count: s.value.pendingCommissions ?? 0, type: 'success', path: '/admin/commissions' },
  { tag: '兑换', label: '今日兑换', count: s.value.todayExchanges ?? 0, type: 'info', path: '/admin/orders' }
])

const quickEntries = computed(() => {
  const entries = [
    { label: '账号管理', path: '/admin/accounts', icon: 'UserFilled', color: '#409eff' },
    { label: '用户管理', path: '/admin/users', icon: 'User', color: '#67c23a' },
    { label: '系统配置', path: '/admin/config', icon: 'Setting', color: '#909399' },
    { label: '违禁词库', path: '/admin/forbidden-words', icon: 'Warning', color: '#e6a23c' },
    { label: '报告复核', path: '/admin/reports', icon: 'Document', color: '#f56c6c' },
    { label: '发布审核', path: '/admin/posts', icon: 'Picture', color: '#9c27b0' },
    { label: '积分管理', path: '/admin/points', icon: 'Coin', color: '#ff9800' }
  ]
  if (userStore.isSuper) {
    entries.push(
      { label: '系统设置', path: '/admin/system-settings', icon: 'Tools', color: '#607d8b' },
      { label: '代理商管理', path: '/agent/dashboard', icon: 'Suitcase', color: '#1e88e5' },
      { label: '服务商管理', path: '/service-provider/dashboard', icon: 'OfficeBuilding', color: '#43a047' }
    )
  }
  return entries
})

async function loadStatistics() {
  loading.value = true
  try {
    const res = await adminAPI.getStatistics()
    s.value = res.data || {}
  } catch { /* 错误已由拦截器处理 */ } finally {
    loading.value = false
  }
}

onMounted(() => { loadStatistics() })
</script>

<style scoped>
.card-header {
  display: flex; align-items: center; justify-content: space-between; font-weight: 600;
}
.stat-card {
  text-align: center; padding: 8px 0;
}
.stat-value {
  font-size: 28px; font-weight: 700; color: #303133; line-height: 1.4;
}
.stat-label {
  font-size: 13px; color: #909399; margin-top: 4px;
}
.todo-item {
  display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #ebeef5;
}
.todo-item:last-child { border-bottom: none; }
.todo-info { display: flex; align-items: center; gap: 8px; }
.todo-label { font-size: 14px; color: #303133; }
.todo-action { display: flex; align-items: center; gap: 12px; }
.todo-count { font-size: 18px; font-weight: 600; color: var(--el-color-primary); min-width: 32px; text-align: right; }
.quick-entry { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px; border-radius: 8px; cursor: pointer; transition: background 0.2s;
}
.quick-item:hover { background: #f5f7fa; }
.quick-label { font-size: 13px; color: #606266; }
</style>
