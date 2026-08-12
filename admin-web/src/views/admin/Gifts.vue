<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="礼品名称" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.category" placeholder="分类" clearable @change="handleSearch">
          <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable @change="handleSearch">
          <el-option label="上架" value="active" />
          <el-option label="下架" value="inactive" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建礼品
        </el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" border stripe style="width: 100%">
        <el-table-column label="图片" prop="image" min-width="90" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.image"
              :src="row.image"
              fit="cover"
              class="gift-img"
              preview-teleported
              :preview-src-list="[row.image]"
            />
            <el-icon v-else :size="32" color="#c0c4cc"><Picture /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column label="分类" prop="category" min-width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="categoryTagType(row.category)">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分价" prop="points" min-width="100" align="right">
          <template #default="{ row }">
            <span class="points-text">{{ row.points ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="现金价" prop="cashPrice" min-width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.cashPrice || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="库存" prop="stock" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="stockTagType(row.stock)" size="small">{{ row.stock ?? 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑礼品' : '新建礼品'" width="560px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入礼品名称" clearable />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="图片URL" prop="image">
          <el-input v-model="form.image" placeholder="请输入图片 URL" clearable />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
            <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分价" prop="points">
          <el-input-number v-model="form.points" :min="0" :max="999999" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="现金价" prop="cashPrice">
          <el-input-number v-model="form.cashPrice" :min="0" :precision="2" :step="0.01" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="库存" prop="stock">
          <el-input-number v-model="form.stock" :min="0" :max="999999" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Picture } from '@element-plus/icons-vue'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const total = ref(0)

const query = reactive({
  keyword: '',
  category: '',
  status: '',
  page: 1,
  pageSize: 10
})

const categoryOptions = [
  { value: 'food', label: '食品' },
  { value: 'health', label: '健康' },
  { value: 'service', label: '服务' },
  { value: 'coupon', label: '优惠券' },
  { value: 'other', label: '其他' }
]

function categoryLabel(val) {
  const opt = categoryOptions.find((o) => o.value === val)
  return opt ? opt.label : val || '-'
}

function categoryTagType(val) {
  const map = { food: 'success', health: 'primary', service: 'warning', coupon: 'danger', other: 'info' }
  return map[val] || ''
}

function stockTagType(stock) {
  if (stock === undefined || stock === null) return 'info'
  if (stock <= 0) return 'danger'
  if (stock < 10) return 'warning'
  return 'success'
}

// 格式化时间
function formatDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function loadList() {
  loading.value = true
  try {
    const params = { ...query }
    Object.keys(params).forEach((k) => {
      if (params[k] === '' || params[k] === null) delete params[k]
    })
    const res = await adminAPI.getGifts(params)
    const data = res.data || {}
    list.value = data.gifts || data.list || data.records || []
    total.value = data.total || 0
  } catch (err) {
    // 错误已由 request 拦截器统一处理
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
  query.category = ''
  query.status = ''
  query.page = 1
  loadList()
}

function handlePageChange(page) {
  query.page = page
  loadList()
}

// ===== 新增/编辑 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const editId = ref(null)
const form = reactive({
  name: '',
  description: '',
  image: '',
  points: 0,
  cashPrice: 0,
  category: '',
  stock: 0
})

const formRules = {
  name: [{ required: true, message: '请输入礼品名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  points: [{ required: true, message: '请输入积分价', trigger: 'blur' }]
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  form.name = row.name
  form.description = row.description || ''
  form.image = row.image || ''
  form.points = row.points ?? 0
  form.cashPrice = Number(row.cashPrice || 0)
  form.category = row.category
  form.stock = row.stock ?? 0
  dialogVisible.value = true
}

function resetForm() {
  form.name = ''
  form.description = ''
  form.image = ''
  form.points = 0
  form.cashPrice = 0
  form.category = ''
  form.stock = 0
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    if (isEdit.value) {
      await adminAPI.updateGift(editId.value, { ...form })
      ElMessage.success('编辑成功')
    } else {
      await adminAPI.createGift({ ...form })
      ElMessage.success('新建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch (err) {
    // 校验失败或请求错误
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除礼品「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.deleteGift(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch (err) {
    // 用户取消或请求错误
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.gift-img {
  width: 60px;
  height: 60px;
  border-radius: 4px;
}

.points-text {
  color: #e6a23c;
  font-weight: 600;
}

.search-bar .el-button {
  margin-left: 0;
}
</style>
