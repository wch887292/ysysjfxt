// 管理台 API（前缀 /api/admin）
import request from './request'

export const adminAPI = {
  // 统计数据
  getStatistics: () => request.get('/admin/statistics'),

  // ===== 账号管理 =====
  getAccounts: (params) => request.get('/admin/accounts', { params }),
  createAccount: (data) => request.post('/admin/accounts', data),
  updateAccount: (id, data) => request.put(`/admin/accounts/${id}`, data),
  updateAccountRole: (id, data) => request.put(`/admin/accounts/${id}/role`, data),
  updateAccountStatus: (id, data) => request.put(`/admin/accounts/${id}/status`, data),
  resetPassword: (id, data) => request.post(`/admin/accounts/${id}/reset-password`, data),
  getServiceProviders: () => request.get('/admin/service-providers'),

  // ===== 用户管理 =====
  getUsers: (params) => request.get('/admin/users', { params }),
  getUserDetail: (id) => request.get(`/admin/users/${id}`),
  updateUser: (id, data) => request.put(`/admin/users/${id}/edit`, data),
  updateUserStatus: (id, data) => request.put(`/admin/users/${id}/status`, data),
  updateUserRole: (id, data) => request.put(`/admin/users/${id}/role`, data),

  // ===== 系统配置 =====
  getConfig: (params) => request.get('/admin/config', { params }),
  updateConfig: (key, data) => request.put(`/admin/config/${key}`, data),
  resetConfig: (key) => request.post(`/admin/config/${key}/reset`),

  // ===== 违禁词库 =====
  getForbiddenWords: (params) => request.get('/admin/forbidden-words', { params }),
  createForbiddenWord: (data) => request.post('/admin/forbidden-words', data),
  updateForbiddenWord: (id, data) => request.put(`/admin/forbidden-words/${id}`, data),
  deleteForbiddenWord: (id) => request.delete(`/admin/forbidden-words/${id}`),

  // ===== 报告复核 =====
  getFlaggedReports: (params) => request.get('/admin/reports/flagged', { params }),
  getReportReviewDetail: (id) => request.get(`/admin/reports/${id}/review`),
  reviewReport: (id, data) => request.put(`/admin/reports/${id}/review`, data),
  rewriteReport: (id) => request.post(`/admin/reports/${id}/rewrite`),
  getFeedbackStats: () => request.get('/admin/reports/feedback-stats'),

  // ===== Prompt 版本管理 =====
  getPrompts: (params) => request.get('/admin/prompts', { params }),
  createPrompt: (data) => request.post('/admin/prompts', data),
  activatePrompt: (id) => request.put(`/admin/prompts/${id}/activate`),
  getActivePrompt: (key) => request.get(`/admin/prompts/${key}/active`),

  // ===== 内容发布审核 =====
  getPosts: (params) => request.get('/admin/posts', { params }),
  reviewPost: (id, data) => request.put(`/admin/posts/${id}/review`, data),

  // ===== 资讯管理 =====
  getArticles: (params) => request.get('/admin/articles', { params }),
  createArticle: (data) => request.post('/admin/articles', data),
  updateArticle: (id, data) => request.put(`/admin/articles/${id}`, data),
  publishArticle: (id, data) => request.put(`/admin/articles/${id}/publish`, data),
  deleteArticle: (id) => request.delete(`/admin/articles/${id}`),

  // ===== 礼品管理 =====
  getGifts: (params) => request.get('/admin/gifts', { params }),
  createGift: (data) => request.post('/admin/gifts', data),
  updateGift: (id, data) => request.put(`/admin/gifts/${id}`, data),
  deleteGift: (id) => request.delete(`/admin/gifts/${id}`),

  // ===== 订单与退款 =====
  getOrders: (params) => request.get('/admin/orders', { params }),
  refundOrder: (id, data) => request.post(`/admin/orders/${id}/refund`, data),

  // ===== 分润管理 =====
  getCommissions: (params) => request.get('/admin/commissions', { params }),
  getCommissionsSummary: (params) => request.get('/admin/commissions/summary', { params }),
  settleCommissions: (data) => request.post('/admin/commissions/settle', data),
  cancelCommissions: (data) => request.post('/admin/commissions/cancel', data),
  rejectCommissions: (data) => request.post('/admin/commissions/reject', data),

  // ===== 核销记录 =====
  getWriteOffs: (params) => request.get('/admin/write-offs', { params }),

  // ===== 积分管理 =====
  getPointsHistory: (params) => request.get('/admin/points/history', { params }),
  adjustPoints: (data) => request.post('/admin/points/adjust', data),

  // ===== 系统基础设置 =====
  getSystemSettings: (params) => request.get('/admin/system-settings', { params }),
  getSystemSettingsSchema: () => request.get('/admin/system-settings/schema'),
  updateSystemSetting: (key, data) => request.put(`/admin/system-settings/${key}`, data)
}
