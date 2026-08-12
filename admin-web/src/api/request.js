// axios 封装：统一请求拦截、JWT 注入、错误处理
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/user'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// 请求拦截：注入 JWT Token
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截：统一处理业务码与 HTTP 错误
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 后端统一响应格式：{ success, data, message }
    if (res && typeof res === 'object' && 'success' in res) {
      if (res.success) {
        return res
      }
      // 业务失败
      const msg = res.message || '请求失败'
      ElMessage.error(msg)
      return Promise.reject(new Error(msg))
    }
    // 非标准格式（如文件下载），直接返回
    return response
  },
  (error) => {
    const { response } = error
    if (response) {
      const status = response.status
      const resData = response.data || {}
      const msg = resData.message || `请求错误（${status}）`

      if (status === 401) {
        // 登录接口的401是"账号或密码错误"，不触发"登录失效"弹窗
        const isLoginRequest = error.config?.url?.includes('/auth/web-login') || error.config?.url?.includes('/auth/login')
        if (isLoginRequest) {
          ElMessage.error(msg)
        } else {
          // Token 失效或未登录
          const userStore = useUserStore()
          userStore.clearAuth()
          ElMessageBox.alert('登录已失效，请重新登录', '提示', {
            confirmButtonText: '重新登录',
            type: 'warning'
          }).then(() => {
            router.push('/login')
          })
        }
      } else if (status === 403) {
        // 检查是否是授权过期（LICENSE_EXPIRED）
        if (resData.code === 'LICENSE_EXPIRED') {
          ElMessageBox.alert('试用期已到期，请输入正式版本密钥激活系统', '授权过期', {
            confirmButtonText: '去激活',
            type: 'error'
          }).then(() => {
            router.push('/admin/license')
          })
        } else {
          ElMessage.error(msg || '无权访问')
        }
      } else if (status === 429) {
        ElMessage.error('请求过于频繁，请稍后再试')
      } else {
        ElMessage.error(msg)
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络')
    } else {
      ElMessage.error('网络异常，请稍后重试')
    }
    return Promise.reject(error)
  }
)

export default request
