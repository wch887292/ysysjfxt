<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card class="card-gap">
      <div class="search-bar">
        <el-input
          v-model="query.keyword"
          placeholder="搜索昵称 / 手机号"
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
        <el-button type="success" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加客户
        </el-button>
      </div>
    </el-card>

    <!-- 客户列表 -->
    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column label="昵称" prop="nickName" min-width="120" show-overflow-tooltip />
        <el-table-column label="手机号" prop="phone" min-width="130" />
        <el-table-column label="是否会员" prop="isMember" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isMember || row.is_member" size="small" type="success">会员</el-tag>
            <el-tag v-else size="small" type="info">非会员</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" prop="points" min-width="90" align="right" />
        <el-table-column label="最后活跃" prop="lastActiveAt" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.lastActiveAt || row.last_active_at) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看详情</el-button>
            <el-button link type="primary" size="small" @click="viewReports(row)">查看报告</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无客户数据" />
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

    <!-- 添加客户对话框 -->
    <el-dialog v-model="addDialogVisible" title="添加名下客户" width="480px" destroy-on-close>
      <el-form ref="addFormRef" :model="addForm" :rules="addFormRules" label-width="80px">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="addForm.phone" placeholder="输入客户手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="addForm.remark" type="textarea" placeholder="可选备注" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="handleAddClient">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="客户详情" size="480px" direction="rtl">
      <div v-loading="detailLoading">
        <el-empty v-if="!detail && !detailLoading" description="暂无数据" />
        <el-descriptions v-else :column="1" border>
          <el-descriptions-item label="用户ID">{{ detail?.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ detail?.nickName || detail?.nick_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail?.phone || detail?.phoneMasked || '-' }}</el-descriptions-item>
          <el-descriptions-item label="是否会员">
            <el-tag v-if="detail?.isMember || detail?.is_member" size="small" type="success">会员</el-tag>
            <el-tag v-else size="small" type="info">非会员</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="积分">{{ detail?.points ?? 0 }}</el-descriptions-item>
          <el-descriptions-item label="最后活跃">{{ formatDateTime(detail?.lastActiveAt || detail?.last_active_at) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatDateTime(detail?.createdAt || detail?.created_at) || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const router = useRouter()

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  keyword: '',
  page: 1,
  pageSize: 10
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

const addDialogVisible = ref(false)
const addLoading = ref(false)
const addFormRef = ref(null)
const addForm = reactive({
  phone: '',
  remark: ''
})
const addFormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
}

function formatDateTime(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d.getTime())) return String(str)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function loadList() {
  loading.value = true
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize
    }
    if (query.keyword) params.keyword = query.keyword
    const res = await serviceProviderAPI.getClients(params)
    const data = res.data || {}
    list.value = data.clients || data.users || data.list || []
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

function showAddDialog() {
  addForm.phone = ''
  addForm.remark = ''
  addDialogVisible.value = true
}

async function handleAddClient() {
  if (!addFormRef.value) return
  await addFormRef.value.validate()
  addLoading.value = true
  try {
    await serviceProviderAPI.addClient({
      phone: addForm.phone,
      remark: addForm.remark
    })
    ElMessage.success('客户添加成功')
    addDialogVisible.value = false
    loadList()
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    addLoading.value = false
  }
}

async function viewDetail(row) {
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    const res = await serviceProviderAPI.getUserDetail(row.id)
    detail.value = res.data || null
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    detailLoading.value = false
  }
}

function viewReports(row) {
  router.push({
    path: '/service-provider/reports',
    query: { userId: row.id }
  })
}

onMounted(() => {
  loadList()
})
</script>
