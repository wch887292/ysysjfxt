<template>
  <div class="page-container" v-loading="loading">
    <!-- 用户概览 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalUsers ?? 0 }}</div>
            <div class="stat-label">客户总数</div>
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
            <div class="stat-value" style="color:#f56c6c;">{{ s.inactiveUsers ?? 0 }}</div>
            <div class="stat-label">未活跃客户</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.newUsersToday ?? 0 }}</div>
            <div class="stat-label">今日新增</div>
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
            <div class="stat-value" style="color:#e6a23c;">{{ s.todayExchanges ?? 0 }}</div>
            <div class="stat-label">今日兑换</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 接待统计 -->
    <el-row :gutter="16" class="card-gap">
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ s.totalReceptions ?? 0 }}</div>
            <div class="stat-label">累计接待</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#67c23a;">{{ s.todayReceptions ?? 0 }}</div>
            <div class="stat-label">今日接待</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#f56c6c;">{{ s.newUsersMonth ?? 0 }}</div>
            <div class="stat-label">本月新增客户</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" style="color:#e6a23c;">{{ s.totalExchanges ?? 0 }}</div>
            <div class="stat-label">累计兑换</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 未活跃客户数变化趋势 -->
    <el-card shadow="never">
      <template #header>
        <div class="trend-header">
          <span>未活跃客户数变化趋势（最近 {{ days }} 天）</span>
          <el-tag v-if="trendDelta !== null" :type="trendDelta > 0 ? 'danger' : 'success'" size="small">
            {{ trendDelta > 0 ? '↑' : '↓' }} {{ Math.abs(trendDelta) }}
          </el-tag>
        </div>
      </template>

      <el-empty v-if="!trendList.length" description="暂无趋势数据" />

      <div v-else class="trend-wrap">
        <div v-for="item in trendList" :key="item.date" class="trend-item">
          <div class="trend-bar-wrap">
            <div class="trend-bar" :style="{ height: barHeight(item.count) + 'px' }" :title="`${item.date}：${item.count} 人`">
              <span class="trend-count">{{ item.count }}</span>
            </div>
          </div>
          <div class="trend-date">{{ item.date }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const loading = ref(false)
const days = ref(3)
const s = ref({})
const trendList = ref([])

function formatNum(v) { return v == null ? '0' : Number(v).toLocaleString() }

const trendDelta = computed(() => {
  if (!trendList.value.length || trendList.value.length < 2) return null
  const first = trendList.value[0].count
  const last = trendList.value[trendList.value.length - 1].count
  return last - first
})

const maxCount = computed(() => {
  if (!trendList.value.length) return 1
  return Math.max(...trendList.value.map(i => i.count || 0), 1)
})

function barHeight(count) {
  const minH = 6, maxH = 160
  if (maxCount.value <= 0) return minH
  return Math.max(minH, Math.round((count / maxCount.value) * maxH))
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function loadStatistics() {
  loading.value = true
  try {
    const res = await serviceProviderAPI.getStatistics({ days: days.value })
    const data = res.data || {}
    s.value = data
    // 兼容多种趋势字段名
    const trend = data.inactiveTrend || data.trend || data.inactiveTrends || []
    trendList.value = (Array.isArray(trend) ? trend : []).map((item) => ({
      date: formatDate(item.date || item.day || item.time),
      count: Number(item.count || item.value || item.inactiveCount || 0)
    })).filter(i => i.date)
  } catch { /* 错误已由拦截器处理 */ } finally {
    loading.value = false
  }
}

onMounted(() => { loadStatistics() })
</script>

<style scoped>
.trend-header { display: flex; align-items: center; justify-content: space-between; }
.trend-wrap { display: flex; align-items: flex-end; gap: 12px; height: 220px; padding: 16px 8px 0; overflow-x: auto; }
.trend-item { display: flex; flex-direction: column; align-items: center; min-width: 48px; flex: 1; }
.trend-bar-wrap { height: 180px; display: flex; align-items: flex-end; justify-content: center; width: 100%; }
.trend-bar {
  width: 60%; min-width: 24px; max-width: 48px; background: linear-gradient(180deg, #f56c6c 0%, #fab6b6 100%);
  border-radius: 4px 4px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 4px;
  transition: height 0.3s ease; cursor: pointer;
}
.trend-bar:hover { background: linear-gradient(180deg, #e64242 0%, #f89c9c 100%); }
.trend-count { font-size: 12px; color: #fff; font-weight: 600; }
.trend-date { margin-top: 8px; font-size: 12px; color: #909399; white-space: nowrap; }
.stat-card { text-align: center; padding: 8px 0; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; line-height: 1.4; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
</style>
