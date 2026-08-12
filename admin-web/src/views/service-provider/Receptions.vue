<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card class="card-gap">
      <div class="search-bar">
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
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增接待记录
        </el-button>
      </div>
    </el-card>

    <!-- 接待记录列表 -->
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
        <el-table-column label="接待时间" prop="receptionTime" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.receptionTime) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="结果" prop="result" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="resultTagType(row.result)" size="small">
              {{ resultText(row.result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容摘要" prop="content" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.content || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无接待记录" />
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

    <!-- 新增接待记录对话框 -->
    <el-dialog
      v-model="createVisible"
      title="新增接待记录"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="客户ID" prop="userId">
          <el-input v-model="form.userId" placeholder="请输入客户ID" />
        </el-form-item>
        <el-form-item label="接待时间" prop="receptionTime">
          <el-date-picker
            v-model="form.receptionTime"
            type="datetime"
            placeholder="请选择接待时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="接待内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="4"
            placeholder="请输入接待内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="结果" prop="result">
          <el-select v-model="form.result" placeholder="请选择结果" style="width: 100%;">
            <el-option label="待跟进" value="pending" />
            <el-option label="已转化" value="converted" />
            <el-option label="需跟进" value="follow_up" />
            <el-option label="流失" value="lost" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          系统将基于客户ID与接待时间自动生成幂等键，5 分钟窗口内重复提交不会产生重复记录
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="接待记录详情"
      width="560px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="客户">{{ detail?.userNickName || detail?.userName || ('#' + (detail?.userId || '-')) }}</el-descriptions-item>
        <el-descriptions-item label="接待时间">{{ formatDateTime(detail?.receptionTime) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="结果">
          <el-tag :type="resultTagType(detail?.result)" size="small">
            {{ resultText(detail?.result) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="接待内容">{{ detail?.content || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail?.createdAt) || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { serviceProviderAPI } from '@/api/serviceProvider'

const loading = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  userId: '',
  page: 1,
  pageSize: 10
})

const createVisible = ref(false)
const submitting = ref(false)
const formRef = ref()

const form = reactive({
  userId: '',
  receptionTime: '',
  content: '',
  result: 'pending'
})

const rules = {
  userId: [{ required: true, message: '请输入客户ID', trigger: 'blur' }],
  receptionTime: [{ required: true, message: '请选择接待时间', trigger: 'change' }],
  content: [{ required: true, message: '请输入接待内容', trigger: 'blur' }],
  result: [{ required: true, message: '请选择结果', trigger: 'change' }]
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

// 结果文案
function resultText(result) {
  const map = {
    pending: '待跟进',
    converted: '已转化',
    follow_up: '需跟进',
    lost: '流失'
  }
  return map[result] || result || '-'
}

// 结果标签类型
function resultTagType(result) {
  const map = {
    pending: 'warning',
    converted: 'success',
    follow_up: 'primary',
    lost: 'danger'
  }
  return map[result] || 'info'
}

/**
 * 幂等键生成：基于 (userId + receptionTime + 5分钟时间窗口)
 * 同一客户在同一 5 分钟窗口内重复提交，会生成相同的幂等键
 * 实现思路：
 *  - 将 receptionTime 解析为时间戳
 *  - 计算所属的 5 分钟窗口编号 = floor(timestamp / (5 * 60 * 1000))
 *  - 拼接 userId + windowNo 生成稳定键
 */
function generateIdempotencyKey(userId, receptionTime) {
  if (!userId || !receptionTime) return null
  const ts = new Date(receptionTime).getTime()
  if (isNaN(ts)) return null
  const windowSize = 5 * 60 * 1000 // 5 分钟
  const windowNo = Math.floor(ts / windowSize)
  return `rcv_${userId}_${windowNo}`
}

async function loadList() {
  loading.value = true
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize
    }
    if (query.userId) params.userId = query.userId
    const res = await serviceProviderAPI.getReceptions(params)
    const data = res.data || {}
    list.value = data.receptions || data.list || data.records || data.items || []
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

function openCreate() {
  form.userId = ''
  form.receptionTime = ''
  form.content = ''
  form.result = 'pending'
  createVisible.value = true
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const idempotencyKey = generateIdempotencyKey(form.userId, form.receptionTime)
    const payload = {
      userId: form.userId,
      receptionTime: form.receptionTime,
      content: form.content,
      result: form.result
    }
    if (idempotencyKey) {
      payload.idempotencyKey = idempotencyKey
    }
    await serviceProviderAPI.createReception(payload)
    ElMessage.success('接待记录创建成功')
    createVisible.value = false
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
  loadList()
})
</script>

<style scoped>
</style>
