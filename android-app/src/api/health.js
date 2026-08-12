// 健康问卷 & 报告相关 API
import apiClient from './client';

export const healthApi = {
  /** 提交健康问卷 */
  submitQuestionnaire: (answers, consentAccepted = false) =>
    apiClient.post('/user/questionnaire', { answers, consent_accepted: consentAccepted }),

  /** 获取问卷结果 */
  getQuestionnaireResult: () => apiClient.get('/user/questionnaire/result'),

  /** 生成报告 */
  generateReport: () => apiClient.post('/user/reports/generate'),

  /** 获取危机钩子报告 */
  getCrisisHookReport: () => apiClient.get('/user/reports/crisis-hook'),

  /** 获取本人7天调理方案（会员） */
  getMy7DayPlan: () => apiClient.get('/user/reports/my-7day-plan'),

  /** 获取指定用户的7天调理方案（后台） */
  get7DayPlan: (userId) => apiClient.get(`/user/reports/7day-plan/${userId}`),

  /** 下载报告 */
  downloadReport: (reportId) => apiClient.get(`/user/reports/download/${reportId}`, { responseType: 'blob' }),

  /** 提交报告反馈 */
  submitFeedback: (reportId, feedbackType, content) =>
    apiClient.post(`/user/reports/${reportId}/feedback`, { feedbackType, content }),

  /** 获取报告反馈 */
  getFeedback: (reportId) => apiClient.get(`/user/reports/${reportId}/feedback`),
};