// 代理端 API（前缀 /api/agent）
import request from './request'

export const agentAPI = {
  // 统计数据
  getStatistics: () => request.get('/agent/statistics'),

  // 名下用户管理
  getUsers: (params) => request.get('/agent/users', { params }),
  getInactiveUsers: (params) => request.get('/agent/users/inactive', { params }),
  convertToMember: (userId, data) => request.post(`/agent/users/${userId}/convert-to-member`, data),

  // 活动记录
  getActivities: () => request.get('/agent/activities'),

  // 餐食审核
  getMeals: (params) => request.get('/agent/meals', { params }),
  reviewMeal: (mealId, data) => request.put(`/agent/meals/${mealId}/review`, data),

  // 积分核销
  writeOffPoints: (data) => request.post('/agent/points/write-off', data),

  // 图文发布
  getPosts: (params) => request.get('/agent/posts', { params }),
  publishPost: (data) => request.post('/agent/posts', data),

  // 分享码
  getShareCode: () => request.get('/agent/share-code'),

  // 分润查询
  getCommissions: (params) => request.get('/agent/commissions', { params }),

  // 报告查看与下载
  getReports: (userId) => request.get(`/agent/reports/${userId}`),
  downloadReport: (reportId) => request.get(`/agent/reports/${reportId}/download`, { responseType: 'text' }),

  // 礼品核销
  redeemGift: (data) => request.post('/agent/gifts/redeem', data),

  // 流失预警
  getAlerts: (params) => request.get('/agent/alerts', { params }),
  followUpAlert: (alertId, data) => request.put(`/agent/alerts/${alertId}/follow-up`, data),

  // 关联服务商数据（权限规则：代理商可查看服务商的数据）
  getServiceProviderUsers: (params) => request.get('/agent/service-provider/users', { params }),
  getServiceProviderUserDetail: (userId) => request.get(`/agent/service-provider/users/${userId}`),
  getServiceProviderReceptions: (params) => request.get('/agent/service-provider/receptions', { params }),
  getServiceProviderReports: (userId) => request.get(`/agent/service-provider/reports/${userId}`),
  getServiceProviderProfile: () => request.get('/agent/service-provider/profile'),

  // 代理商关联服务商设置
  getServiceProviderList: () => request.get('/agent/service-providers'),
  getMyServiceProvider: () => request.get('/agent/service-provider'),
  setMyServiceProvider: (data) => request.put('/agent/service-provider', data)
}
