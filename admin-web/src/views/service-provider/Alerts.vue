<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card class="card-gap">
      <div class="search-bar">
        <span>状态：</span>
        <el-select v-model="query.status" placeholder="请选择状态" @change="handleSearch">
          <el-option label="全部" value="all" />
          <el-option label="待跟进" value="pending" />
          <el-option label="已跟进" value="followed" />
        </el-select>
        <el-input
          v-model="query.userId"
          placeholder="按客户ID筛选"
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
        <el-table-column label="客户" min-width="140">
          <template #default="{ row }">
            <span>{{ row.userNickName || row.userName || ('#' + (row.userId || '-')) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预警类型" prop="alertType" min-width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ alertTypeText(row.alertType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="跟进结果" prop="followUpResult" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.followUpResult || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              link
              type="warning"
              size="small"
              @click="openFollowUp(row)"
            >
              标记跟进
            </el-button>
            <el-button
              v-else
              link
              type="primary"
              size="small"
              @click="viewDetail(row)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无预警数据" />
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

    <!-- 标记跟进对话框 -->
    <el-dialog
      v-model="followUpVisible"
      title="标记跟进"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="客户">
          <span>{{ currentAlert?.userNickName || currentAlert?.userName || ('#' + (currentAlert?.userId || '-')) }}</span>
        </el-form-item>
        <el-form-item label="预警类型">
          <el-tag size="small" type="info">{{ alertTypeText(currentAlert?.alertType) }}</el-tag>
        </el-form-item>
        <el-form-item label="跟进结果" prop="followUpResult">
          <el-input
            v-model="form.followUpResult"
            type="textarea"
            :rows="4"
            placeholder="请输入跟进结果（如已联系客户、已安排接待等）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认跟进</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="预警详情"
      width="500px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="客户">{{ detail?.userNickName || detail?.userName || ('#' + (detail?.userId || '-')) }}</el-descriptions-item>
        <el-descriptions-item label="预警类型">
          <el-tag size="small" type="info">{{ alertTypeText(detail?.alertType) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail?.status)" size="small">
            {{ statusText(detail?.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail?.createdAt) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="跟进结果">{{ detail?.followUpResult || '-' }}</el-descriptions-item>
        <el-descriptions-item label="跟进时间">{{ formatDateTime(detail?.followedAt || detail?.followUpAt) || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const route = useRoute()

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  status: 'all',
  userId: '',
  page: 1,
  pageSize: 10
})

const followUpVisible = ref(false)
const submitting = ref(false)
const formRef = ref()
const currentAlert = ref(null)

const form = reactive({
  followUpResult: ''
})

const rules = {
  followUpResult: [{ required: true, message: '请输入跟进结果', trigger: 'blur' }]
}

const detailVisible = ref(false)
const detail = ref(null)

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 状态文案
function statusText(status) {
  const map = {
    pending: '待跟进',
    followed: '已跟进'
  }
  return map[status] || status || '-'
}

// 状态标签类型：pending 用 warning，followed 用 success
function statusTagType(status) {
  const map = {
    pending: 'warning',
    followed: 'success'
  }
  return map[status] || 'info'
}

// 预警类型文案
function alertTypeText(type) {
  const map = {
    inactive: '未活跃预警',
    churn: '流失预警',
    low_activity: '低活跃预警',
    no_reception: '无接待预警'
  }
  return map[type] || type || '预警'
}

async function loadList() {
  loading.value = true
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize
    }
    // 后端可能不识别 'all'，仅在非 all 时传递 status
    if (query.status && query.status !== 'all') params.status = query.status
    if (query.userId) params.userId = query.userId
    const res = await serviceProviderAPI.getAlerts(params)
    const data = res.data || {}
    list.value = data.alerts || data.list || data.records || data.items || []
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
  query.status = 'all'
  query.userId = ''
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

function openFollowUp(row) {
  currentAlert.value = row
  form.followUpResult = ''
  followUpVisible.value = true
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value || !currentAlert.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    await serviceProviderAPI.followUpAlert(currentAlert.value.id, {
      followUpResult: form.followUpResult
    })
    ElMessage.success('已标记为跟进')
    followUpVisible.value = false
    loadList()
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

function viewDetail(row) {
  detail.value = row
  detailVisible.value = true
}

onMounted(() => {
  // 支持从流失预警页面带 userId 跳转过来
  const userId = route.query.userId
  if (userId) {
    query.userId = String(userId)
  }
  loadList()
})
</script>

<style scoped>
</style>
