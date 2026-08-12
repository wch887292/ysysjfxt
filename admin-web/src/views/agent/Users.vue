<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="query.keyword"
        placeholder="昵称 / openid 搜索"
        clearable
        @keyup.enter="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>

    <!-- 用户列表 -->
    <el-card shadow="never">
      <el-table :data="list" border stripe v-loading="loading">
        <el-table-column prop="nickname" label="昵称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="openid" label="openid" min-width="220" show-overflow-tooltip />
        <el-table-column prop="identityType" label="身份类型" min-width="110">
          <template #default="{ row }">
            <el-tag>{{ row.identityType || '普通用户' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="是否会员" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isMember ? 'success' : 'info'">
              {{ row.isMember ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" min-width="100" align="right" />
        <el-table-column label="最后活跃时间" min-width="170">
          <template #default="{ row }">
            {{ formatTime(row.lastActiveAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.isMember"
              type="primary"
              link
              @click="openConvert(row)"
            >转化为会员</el-button>
            <el-button type="primary" link @click="goReport(row)">查看报告</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无用户数据" />
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

    <!-- 转化为会员对话框 -->
    <el-dialog v-model="convertVisible" title="转化为会员" width="480px">
      <el-form ref="convertFormRef" :model="convertForm" :rules="convertRules" label-width="90px">
        <el-form-item label="用户">
          <span>{{ currentUser.nickname || '-' }}（{{ currentUser.openid || '-' }}）</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="convertForm.remark"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入转化备注（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="convertVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitConvert">确认转化</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { agentAPI } from '@/api/agent'

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  keyword: '',
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

const loadList = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getUsers({
      keyword: query.keyword || undefined,
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
  query.keyword = ''
  query.page = 1
  loadList()
}

const handlePageChange = (p) => {
  query.page = p
  loadList()
}

// ===== 转化为会员 =====
const convertVisible = ref(false)
const convertFormRef = ref(null)
const currentUser = ref({})
const convertForm = reactive({ remark: '' })
const convertRules = {
  remark: [{ max: 200, message: '备注不超过 200 字', trigger: 'blur' }]
}

const openConvert = (row) => {
  currentUser.value = row
  convertForm.remark = ''
  convertVisible.value = true
}

const submitConvert = async () => {
  try {
    await ElMessageBox.confirm(
      `确认为用户「${currentUser.value.nickname || currentUser.value.openid}」开通会员？`,
      '二次确认',
      { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
    )
  } catch (e) {
    return // 用户取消
  }

  submitting.value = true
  try {
    await agentAPI.convertToMember(currentUser.value.id, { remark: convertForm.remark })
    ElMessage.success('转化成功')
    convertVisible.value = false
    loadList()
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false
  }
}

// 跳转报告页
const goReport = (row) => {
  router.push({ path: '/agent/reports', query: { userId: row.id } })
}

onMounted(() => {
  loadList()
})
</script>
