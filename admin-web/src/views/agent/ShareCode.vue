<template>
  <div class="page-container" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <span>拉新二维码</span>
      </template>

      <div v-if="shareData" class="share-wrap">
        <el-row :gutter="24">
          <!-- 二维码展示 -->
          <el-col :xs="24" :md="12">
            <div class="qr-box">
              <div class="qr-placeholder" v-html="qrSvg"></div>
              <div class="qr-tip">扫码注册，自动绑定代理关系</div>
            </div>
          </el-col>

          <!-- 分享码信息 -->
          <el-col :xs="24" :md="12">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="分享码">
                <span style="font-size: 18px; font-weight: 600; color: var(--el-color-primary);">
                  {{ shareData.shareCode || shareData.code || '-' }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="二维码内容">
                <span style="word-break: break-all;">{{ shareData.qrContent || shareData.qrUrl || '-' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="分享链接">
                <span style="word-break: break-all;">{{ shareData.shareUrl || shareData.qrContent || '-' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="已邀请人数">
                <el-tag type="success">{{ shareData.invitedCount ?? 0 }} 人</el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
              <el-button type="primary" @click="copyText(shareData.shareCode || shareData.code)">
                <el-icon><CopyDocument /></el-icon> 复制分享码
              </el-button>
              <el-button type="success" @click="copyText(shareData.qrContent || shareData.qrUrl)">
                <el-icon><Link /></el-icon> 复制二维码内容
              </el-button>
              <el-button @click="refresh">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </el-col>
        </el-row>

        <!-- 分享说明 -->
        <el-divider content-position="left">分享说明</el-divider>
        <ul class="share-tips">
          <li>将二维码或分享码发送给潜在用户，用户扫码注册后自动成为您的名下用户。</li>
          <li>名下用户产生积分核销、礼品兑换等行为后，您将按约定比例获得分润。</li>
          <li>分享码长期有效，可重复使用；如需重置请联系管理员。</li>
          <li>请勿通过违规渠道推广，违规用户将取消代理资格。</li>
        </ul>
      </div>

      <el-empty v-else description="暂无分享码数据" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Link, Refresh } from '@element-plus/icons-vue'
import { agentAPI } from '@/api/agent'

const loading = ref(false)
const shareData = ref(null)

// 简易二维码占位（用文字呈现二维码内容，无外部依赖）
const qrSvg = computed(() => {
  if (!shareData.value) return ''
  const text = shareData.value.qrContent || shareData.value.qrUrl || ''
  if (!text) return '<div style="color:#c0c4cc;">无二维码内容</div>'
  return `
    <div style="width:220px;height:220px;border:1px dashed #dcdfe6;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;">
      <div style="text-align:center;padding:12px;word-break:break-all;font-size:12px;color:#606266;max-width:200px;">
        ${escapeHtml(text)}
      </div>
    </div>
  `
})

const escapeHtml = (str) => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const loadShareCode = async () => {
  loading.value = true
  try {
    const res = await agentAPI.getShareCode()
    shareData.value = res.data || null
  } catch (e) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}

const refresh = () => {
  loadShareCode()
}

const copyText = async (text) => {
  if (!text) {
    ElMessage.info('内容为空')
    return
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // 兜底方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败，请手动复制')
  }
}

onMounted(() => {
  loadShareCode()
})
</script>

<style scoped>
.share-wrap {
  padding: 8px 0;
}
.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.qr-tip {
  color: #909399;
  font-size: 13px;
}
.share-tips {
  margin: 0;
  padding-left: 20px;
  line-height: 2;
  color: #606266;
}
</style>
