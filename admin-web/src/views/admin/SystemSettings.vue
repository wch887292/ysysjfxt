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
        <el-button type="primary" @click="loadSettings">刷新</el-button>
      </div>
    </el-card>

    <!-- 配置列表 -->
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <span>{{ currentCategoryLabel }}</span>
      </template>
      <div v-if="settingsList.length">
        <div v-for="item in settingsList" :key="item.key" class="setting-item">
          <div class="setting-header">
            <span class="setting-label">{{ item.label }}</span>
            <div class="setting-badges">
              <el-tag v-if="item.sensitive" size="small" type="danger" effect="plain">敏感</el-tag>
              <el-tag size="small" :type="item.source === 'database' ? 'primary' : 'info'" effect="plain">
                {{ item.source === 'database' ? '数据库' : '环境变量' }}
              </el-tag>
            </div>
          </div>
          <div class="setting-value">
            <span :class="['value-text', item.sensitive ? 'value-masked' : '']">
              {{ item.value || '未配置' }}
            </span>
          </div>
          <div class="setting-desc">{{ item.description }}</div>
          <div class="setting-actions">
            <el-button type="primary" size="small" @click="openEdit(item)">修改</el-button>
            <el-button
              v-if="item.source === 'database'"
              type="warning"
              size="small"
              plain
              @click="handleClear(item)"
            >清除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无配置项" />
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="`修改「${editingLabel}」`"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="editingSensitive"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        此为敏感配置，新值将加密存储。输入后不会显示明文。
      </el-alert>
      <el-form label-position="top">
        <el-form-item label="新值">
          <el-input-number
            v-if="editingType === 'number'"
            v-model="editingValue"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
          <el-switch
            v-else-if="editingType === 'boolean'"
            v-model="editingBoolValue"
            active-text="开启"
            inactive-text="关闭"
          />
          <el-input
            v-else
            v-model="editingValue"
            :type="editingSensitive ? 'password' : 'text'"
            :placeholder="editingSensitive ? '请输入新的密钥值' : '请输入新值'"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminAPI } from '@/api/admin'

const loading = ref(false)
const saving = ref(false)
const settingsMap = ref({})
const currentCategory = ref('wechat')

const categories = [
  { value: 'wechat', label: '微信小程序配置' },
  { value: 'ai_text', label: 'AI 文本模型配置' },
  { value: 'ai_vision', label: 'AI 视觉模型配置' },
  { value: 'content_security', label: '内容安全配置' },
  { value: 'oss', label: 'OSS 存储配置' },
  { value: 'course', label: '学习课程配置' },
  { value: 'system', label: '系统安全配置' }
]

const currentCategoryLabel = computed(() => {
  const cat = categories.find((c) => c.value === currentCategory.value)
  return cat ? cat.label : ''
})

const settingsList = computed(() => {
  return settingsMap.value[currentCategory.value] || []
})

// 编辑相关
const editDialogVisible = ref(false)
const editingKey = ref('')
const editingLabel = ref('')
const editingSensitive = ref(false)
const editingType = ref('string')
const editingValue = ref('')
const editingBoolValue = ref(false)

async function loadSettings() {
  loading.value = true
  try {
    const res = await adminAPI.getSystemSettings({ category: currentCategory.value })
    if (res.data && res.data.settings) {
      settingsMap.value = { ...settingsMap.value, ...res.data.settings }
    }
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function handleCategoryChange() {
  // 如果还没加载过该分类，则加载
  if (!settingsMap.value[currentCategory.value]) {
    loadSettings()
  }
}

function openEdit(item) {
  editingKey.value = item.key
  editingLabel.value = item.label
  editingSensitive.value = item.sensitive
  editingType.value = item.type
  editingValue.value = item.type === 'number' ? (item.value || 0) : ''
  editingBoolValue.value = item.type === 'boolean' ? !!item.value : false
  editDialogVisible.value = true
}

async function handleSave() {
  const value = editingType.value === 'boolean' ? editingBoolValue.value : editingValue.value

  if (value === '' && value !== 0) {
    ElMessage.warning('请输入新值')
    return
  }

  // 二次确认
  const confirmMsg = editingSensitive.value
    ? `确定要修改「${editingLabel.value}」吗？输入的新值将加密存储。\n\n此操作不可撤销，请确认无误。`
    : `确定要修改「${editingLabel.value}」吗？`

  try {
    await ElMessageBox.confirm(confirmMsg, '确认修改', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      dangerouslyUseHTMLString: false
    })
  } catch {
    return // 用户取消
  }

  saving.value = true
  try {
    await adminAPI.updateSystemSetting(editingKey.value, {
      value,
      confirm: true
    })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadSettings()
  } catch (err) {
    // 错误已由 request 拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function handleClear(item) {
  try {
    await ElMessageBox.confirm(
      `确定要清除「${item.label}」的数据库配置吗？清除后将回退到环境变量。`,
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await adminAPI.updateSystemSetting(item.key, { value: '', confirm: true })
    ElMessage.success('已清除，回退到环境变量')
    loadSettings()
  } catch (err) {
    // 用户取消或请求错误
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.setting-item {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.setting-label {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.setting-badges {
  display: flex;
  gap: 6px;
}

.setting-value {
  margin-bottom: 6px;
}

.value-text {
  font-size: 14px;
  color: #606266;
  word-break: break-all;
  font-family: 'Courier New', monospace;
}

.value-masked {
  color: #409eff;
  font-weight: 600;
}

.setting-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
  line-height: 1.5;
}

.setting-actions {
  display: flex;
  gap: 8px;
}
</style>
