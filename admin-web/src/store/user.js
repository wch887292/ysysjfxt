// 用户状态管理：Token、用户信息、角色权限
import { defineStore } from 'pinia'
import { authAPI } from '@/api/auth'

const TOKEN_KEY = 'ysjfxt_admin_token'
const USER_KEY = 'ysjfxt_admin_user'

// 角色对应的首页路径
const ROLE_HOME_MAP = {
  admin: '/admin/dashboard',
  agent: '/agent/dashboard',
  service_provider: '/service-provider/dashboard'
}

// 角色中文标签
const ROLE_LABEL_MAP = {
  admin: '管理员',
  agent: '代理商',
  service_provider: '服务商'
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.user?.role || '',
    isSuper: (state) => !!state.user?.isSuper,
    roleLabel: (state) => {
      if (state.user?.isSuper) return '超级管理员'
      return ROLE_LABEL_MAP[state.user?.role] || '未知'
    },
    nickName: (state) => state.user?.nickName || '未登录',
    avatarUrl: (state) => state.user?.avatarUrl || '',
    homePath() {
      return ROLE_HOME_MAP[this.role] || '/login'
    }
  },

  actions: {
    // 登录
    async login(account, password) {
      const res = await authAPI.login(account, password)
      const { token, userInfo } = res.data
      this.token = token
      this.user = userInfo
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
      return userInfo
    },

    // 验证 Token 并刷新用户信息
    async validate() {
      if (!this.token) return null
      try {
        const res = await authAPI.validate()
        this.user = res.data
        localStorage.setItem(USER_KEY, JSON.stringify(res.data))
        return res.data
      } catch {
        this.clearAuth()
        return null
      }
    },

    // 登出
    async logout() {
      try { await authAPI.logout() } catch { /* ignore */ }
      this.clearAuth()
    },

    // 清除本地认证信息
    clearAuth() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }
})

// 角色首页路径映射（供路由守卫使用）
export { ROLE_HOME_MAP, ROLE_LABEL_MAP }
