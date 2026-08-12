// 用户相关 API
import apiClient from './client';

export const userApi = {
  /** 获取用户信息 */
  getInfo: () => apiClient.get('/user/info'),

  /** 更新用户信息 */
  updateInfo: (data) => apiClient.put('/user/info', data),

  /** 获取仪表盘数据 */
  getDashboard: () => apiClient.get('/user/dashboard'),

  /** 获取隐私可见范围设置 */
  getPrivacyVisibility: () => apiClient.get('/user/privacy/visibility'),

  /** 更新隐私可见范围 */
  updatePrivacyVisibility: (settings) =>
    apiClient.put('/user/privacy/visibility', settings),

  /** 导出个人数据 */
  exportData: () => apiClient.get('/user/export-data'),

  /** 申请删除账号 */
  requestDeletion: (reason) =>
    apiClient.post('/user/request-deletion', { reason }),

  /** 获取资讯列表 */
  getArticles: (params) => apiClient.get('/user/articles', { params }),

  /** 获取资讯详情 */
  getArticleDetail: (id) => apiClient.get(`/user/articles/${id}`),
};