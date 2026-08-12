// 认证相关 API
import apiClient from './client';

export const authApi = {
  /** 微信小程序登录（Android 端不使用） */
  wechatLogin: (code, shareCode, referrerId) =>
    apiClient.post('/auth/login', { code, shareCode, referrerId }),

  /** Web 后台账号密码登录（admin/agent/service_provider） */
  webLogin: (account, password) =>
    apiClient.post('/auth/web-login', { account, password }),

  /** 移动端手机号密码登录（普通用户） */
  mobileLogin: (phone, password, shareCode, referrerId) =>
    apiClient.post('/auth/mobile-login', { phone, password, shareCode, referrerId }),

  /** 移动端手机号注册（普通用户，注册后自动登录） */
  mobileRegister: (phone, password, shareCode, referrerId) =>
    apiClient.post('/auth/register', { phone, password, shareCode, referrerId }),

  /** 验证 Token 有效性 */
  validateToken: () => apiClient.get('/auth/validate'),

  /** 登出 */
  logout: () => apiClient.post('/auth/logout'),

  /** 获取分享码 */
  getMyShareCode: () => apiClient.get('/auth/my-share-code'),

  /** 获取推荐列表 */
  getMyReferrals: (page = 1, pageSize = 10) =>
    apiClient.get('/auth/my-referrals', { params: { page, pageSize } }),

  /** 获取拉新统计 */
  getMyReferralStats: () => apiClient.get('/auth/my-referral-stats'),

  /** 修改密码 */
  changePassword: (oldPassword, newPassword) =>
    apiClient.post('/auth/change-password', { oldPassword, newPassword }),
};
