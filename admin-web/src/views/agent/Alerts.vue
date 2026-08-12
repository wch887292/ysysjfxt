<template>
  <div class="page-container">
    <!-- 筛选栏 -->
    <div class="search-bar">
      <span style="line-height: 32px; color: #606266;">状态：</span>
      <el-select v-model="query.status" placeholder="全部" clearable style="width: 160px">
        <el-option label="待跟进" value="pending" />
        <el-option label="已跟进" value="followed" />
        <el-option label="全部" value="all" />
      </el-select>
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="userName" label="用户" min-width="140" show-overflow-tooltip />
        <el-table-column prop="alertType" label="预警类型" min-width="150">
          <template #default="{ row }">
            <el-tag type="warning">{{ row.alertType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="预警原因" min-width="220" show-overflow-tooltip />
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              link
              @click="openFollowUp(row)"
            >标记跟进</el-button>
            <span v-else style="color: #c0c4cc;">已处理</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无预警记录" />
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

    <!-- 标记跟进对话框 -->
    <el-dialog v-model="followUpVisible" title="标记跟进" width="480px">
      <el-form ref="followUpFormRef" :model="followUpForm" :rules="followUpRules" label-width="100px">
        <el-form-item label="用户">
          <span>{{ currentAlert.userName || '-' }}</span>
        </el-form-item>
        <el-form-item label="预警类型">
          <span>{{ currentAlert.alertType || '-' }}</span>
        </el-form-item>
        <el-form-item label="预警原因">
          <span>{{ currentAlert.reason || '-' }}</span>
        </el-form-item>
        <el-form-item label="跟进结果" prop="followUpResult">
          <el-input
            v-model="followUpForm.followUpResult"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="请输入跟进结果说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitFollowUp">确认跟进</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { agentAPI } from '@/api/agent'

const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  status: '',
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

const statusLabel = (s) => {
  const map = { pending: '待跟进', followed: '已跟进' }
  return map[s] || s || '-'
}

const statusTagType = (s) => {
  const map = { pending: 'warning', followed: 'success' }
  return map[s] || 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize
    }
    // 状态筛选：all 不传 status
    if (query.status && query.status !== 'all') {
      params.status = query.status
    }
    // 若从流失预警页带 userId 跳转，附加筛选
    if (route.query.userId) {
      params.userId = route.query.userId
    }
    const res = await agentAPI.getAlerts(params)
    const data = res.data || {}
    list.value = data.alerts || data.list || data.records || []
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
  query.status = ''
  query.page = 1
  loadList()
}

const handlePageChange = (p) => {
  query.page = p
  loadList()
}

// ===== 标记跟进 =====
const followUpVisible = ref(false)
const followUpFormRef = ref(null)
const currentAlert = ref({})
const followUpForm = reactive({ followUpResult: '' })
const followUpRules = {
  followUpResult: [
    { required: true, message: '请输入跟进结果', trigger: 'blur' },
    { max: 500, message: '跟进结果不超过 500 字', trigger: 'blur' }
  ]
}

const openFollowUp = (row) => {
  currentAlert.value = row
  followUpForm.followUpResult = ''
  followUpVisible.value = true
}

const submitFollowUp = async () => {
  if (!followUpFormRef.value) return
  try {
    await followUpFormRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    await agentAPI.followUpAlert(currentAlert.value.id, {
      followUpResult: followUpForm.followUpResult
    })
    ElMessage.success('跟进已记录')
    followUpVisible.value = false
    loadList()
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>
