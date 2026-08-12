// 认证相关 API
import request from './request'

export const authAPI = {
  // Web 后台账号密码登录
  login: (account, password) =>
    request.post('/auth/web-login', { account, password }),

  // 验证 Token 有效性
  validate: () => request.get('/auth/validate'),

  // 登出
  logout: () => request.post('/auth/logout'),

  // 修改密码
  changePassword: (oldPassword, newPassword) =>
    request.post('/auth/change-password', { oldPassword, newPassword })
}
