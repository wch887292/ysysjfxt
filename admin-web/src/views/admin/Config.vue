<template>
  <div class="page-container">
    <!-- 分类切换 -->
    <el-card shadow="never" class="card-gap">
      <div class="search-bar">
        <el-radio-group v-model="currentCategory" @change="handleCategoryChange">
          <el-radio-button v-for="cat in categories" :key="cat.value" :label="cat.value">
            {{ cat.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="loadList">刷新</el-button>
      </div>
    </el-card>

    <!-- 配置列表 -->
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <span>{{ currentCategoryLabel }} 配置项</span>
      </template>
      <div v-if="configList.length">
        <div v-for="item in configList" :key="item.key" class="config-item">
          <div class="config-info">
            <div class="config-key">
              <span class="config-name">{{ item.key }}</span>
              <el-tag size="small" type="info" effect="plain">{{ item.key }}</el-tag>
            </div>
            <div class="config-desc">{{ item.description || item.remark || '暂无描述' }}</div>
          </div>
          <div class="config-value">
            <el-input
              v-if="editingKey === item.key"
              v-model="editingValue"
              type="textarea"
              :rows="2"
              placeholder="请输入配置值"
            />
            <div v-else class="value-display">
              <span class="value-text">{{ formatValue(item.value) }}</span>
              <el-tag v-if="item.isDefault" size="small" type="success">默认</el-tag>
            </div>
          </div>
          <div class="config-actions">
            <template v-if="editingKey === item.key">
              <el-button type="primary" size="small" :loading="submitting" @click="handleSave(item)">保存</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" size="small" @click="openEdit(item)">编辑</el-button>
              <el-button link type="warning" size="small" @click="handleReset(item)">重置</el-button>
            </template>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无配置项" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const submitting = ref(false)
const configList = ref([])
const currentCategory = ref('sign_in')

const categories = [
  { value: 'sign_in', label: '签到配置' },
  { value: 'clock_in', label: '打卡配置' },
  { value: 'course', label: '课程配置' },
  { value: 'invite', label: '邀请配置' },
  { value: 'assessment', label: '评估配置' }
]

const currentCategoryLabel = computed(() => {
  const cat = categories.find((c) => c.value === currentCategory.value)
  return cat ? cat.label : ''
})

// 编辑相关
const editingKey = ref('')
const editingValue = ref('')

function formatValue(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function loadList() {
  loading.value = true
  try {
    const res = await adminAPI.getConfig({ category: currentCategory.value })
    const data = res.data
    configList.value = Array.isArray(data) ? data : data.configs || data.list || []
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function handleCategoryChange() {
  cancelEdit()
  loadList()
}

function openEdit(item) {
  editingKey.value = item.key
  editingValue.value = formatValue(item.value)
}

function cancelEdit() {
  editingKey.value = ''
  editingValue.value = ''
}

async function handleSave(item) {
  submitting.value = true
  try {
    await adminAPI.updateConfig(item.key, { value: editingValue.value })
    ElMessage.success('配置已更新')
    cancelEdit()
    loadList()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

async function handleReset(item) {
  try {
    await ElMessageBox.confirm(`确认将配置「${item.key}」重置为默认值吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await adminAPI.resetConfig(item.key)
    ElMessage.success('已重置为默认值')
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
.config-item {
  display: grid;
  grid-template-columns: 1fr 1.2fr auto;
  gap: 16px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
}

.config-item:last-child {
  border-bottom: none;
}

.config-info {
  min-width: 0;
}

.config-key {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.config-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}

.config-desc {
  font-size: 12px;
  color: #909399;
  word-break: break-all;
}

.config-value {
  min-width: 0;
}

.value-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-text {
  font-size: 13px;
  color: #606266;
  word-break: break-all;
  font-family: 'Courier New', monospace;
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
</style>
