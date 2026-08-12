<template>
  <div class="page-container" v-loading="loading">
    <!-- 用户概览 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalUsers ?? 0 }}</div>
            <div class="stat-label">名下用户</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.totalMembers ?? 0 }}</div>
            <div class="stat-label">会员数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#f56c6c;">{{ s.newUsersToday ?? 0 }}</div>
            <div class="stat-label">今日新增</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.newUsersMonth ?? 0 }}</div>
            <div class="stat-label">本月新增</div>
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
            <div class="stat-value" style="color:#f56c6c;">{{ s.pendingReports ?? 0 }}</div>
            <div class="stat-label">待复核报告</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.pendingCommissions ?? 0 }}</div>
            <div class="stat-label">待结算分润</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 关联服务商数据 -->
    <el-card v-if="s.serviceProviderStats" shadow="never" class="card-gap">
      <template #header>
        <div class="card-header"><span>关联服务商数据</span></div>
      </template>
      <el-row :gutter="16">
        <el-col :xs="12" :sm="6">
          <div class="stat-card">
            <div class="stat-value" style="color:#409eff;">{{ s.serviceProviderStats.spUserCount ?? 0 }}</div>
            <div class="stat-label">服务商客户</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.serviceProviderStats.spActiveToday ?? 0 }}</div>
            <div class="stat-label">今日活跃</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card">
            <div class="stat-value">{{ s.serviceProviderStats.spTotalReceptions ?? 0 }}</div>
            <div class="stat-label">累计接待</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.serviceProviderStats.spTodayReceptions ?? 0 }}</div>
            <div class="stat-label">今日接待</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 最近活动记录 -->
    <el-card shadow="never">
      <template #header>
        <span>最近活动记录</span>
      </template>
      <el-table :data="activities" border stripe v-loading="loading">
        <el-table-column type="index" label="#" width="60" align="center" />
        <el-table-column prop="userName" label="用户" min-width="120" show-overflow-tooltip />
        <el-table-column prop="action" label="行为" min-width="140" show-overflow-tooltip />
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无活动记录" /></template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const s = ref({})
const activities = ref([])

function formatNum(v) { return v == null ? '0' : Number(v).toLocaleString() }

const formatTime = (val) => {
  if (!val) return '-'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const loadAll = async () => {
  loading.value = true
  try {
    const [statRes, actRes] = await Promise.all([
      agentAPI.getStatistics(),
      agentAPI.getActivities().catch(() => ({ data: [] }))
    ])
    s.value = statRes.data || {}
    // 后端返回 { activities: [...] }，需解包 activities 字段
    const list = actRes.data?.activities || actRes.data || []
    activities.value = Array.isArray(list) ? list.slice(0, 10) : []
  } finally { loading.value = false }
}

onMounted(() => { loadAll() })
</script>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; font-weight: 600; }
.stat-card { text-align: center; padding: 8px 0; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; line-height: 1.4; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
</style>
