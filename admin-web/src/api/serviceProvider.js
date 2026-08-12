// 服务商端 API（前缀 /api/service-provider）
import request from './request'

export const serviceProviderAPI = {
  // 统计数据
  getStatistics: (params) => request.get('/service-provider/statistics', { params }),

  // 客户管理
  getUsers: (params) => request.get('/service-provider/users', { params }),
  getUserDetail: (userId) => request.get(`/service-provider/users/${userId}`),
  getInactiveUsers: (params) => request.get('/service-provider/users/inactive', { params }),

  // 名下客户管理
  getClients: (params) => request.get('/service-provider/clients', { params }),
  addClient: (data) => request.post('/service-provider/clients', data),

  // 报告查看与下载
  getReports: (userId) => request.get(`/service-provider/reports/${userId}`),
  downloadReport: (reportId) => request.get(`/service-provider/reports/${reportId}/download`, { responseType: 'text' }),

  // 接待记录
  createReception: (data) => request.post('/service-provider/receptions', data),
  getReceptions: (params) => request.get('/service-provider/receptions', { params }),

  // 网点信息
  getProfile: () => request.get('/service-provider/profile'),
  updateProfile: (data) => request.put('/service-provider/profile', data),

  // 流失预警
  getAlerts: (params) => request.get('/service-provider/alerts', { params }),
  followUpAlert: (alertId, data) => request.put(`/service-provider/alerts/${alertId}/follow-up`, data)
}
