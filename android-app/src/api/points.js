// 积分 & 签到 & 课程 API
import apiClient from './client';

export const pointsApi = {
  /** 获取积分历史 */
  getHistory: (params) => apiClient.get('/points/history', { params }),

  /** 获取积分总览 */
  getOverview: () => apiClient.get('/points/overview'),

  /** 签到 */
  signIn: () => apiClient.post('/sign-in'),

  /** 获取签到记录 */
  getSignInRecords: (params) => apiClient.get('/sign-in/records', { params }),

  /** 获取签到状态（今日是否已签） */
  getSignInStatus: () => apiClient.get('/sign-in/today-status'),

  /** 获取课程列表 */
  getCourses: (params) => apiClient.get('/course/list', { params }),

  /** 获取课程详情 */
  getCourseDetail: (id) => apiClient.get(`/course/${id}`),

  /** 开始学习课程 */
  startCourse: (courseId) => apiClient.post('/course/start', { courseId }),

  /** 完成课程学习 */
  completeCourse: (courseId, progress) =>
    apiClient.post('/course/complete', { courseId, progress }),

  /** 获取课程学习记录 */
  getCourseRecords: (params) => apiClient.get('/course/records', { params }),
};