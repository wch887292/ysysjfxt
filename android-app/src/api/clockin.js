// 打卡 & 饮食记录 API
import apiClient from './client';

export const clockinApi = {
  /** 获取打卡记录 */
  getRecords: (params) => apiClient.get('/clock-in/records', { params }),

  /** 创建打卡记录 */
  createRecord: (data) => apiClient.post('/clock-in/record', data),

  /** 上传打卡图片 */
  uploadImage: (formData) =>
    apiClient.post('/clock-in/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10000,
    }),

  /** 获取今日打卡摘要 */
  getTodaySummary: () => apiClient.get('/clock-in/today'),

  /** 获取饮食记录列表 */
  getMeals: (params) => apiClient.get('/meal/list', { params }),

  /** 上传饮食图片 */
  uploadMealImage: (formData) =>
    apiClient.post('/clock-in/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10000,
    }),

  /** 获取餐食类型配置 */
  getMealTypes: () => apiClient.get('/meal/types'),
};