// utils/api.js - API接口定义
const request = require('./request');

/**
 * 图片URL补全（统一处理相对路径 → 绝对HTTPS URL）
 *
 * 处理逻辑：
 * 1. 如果已经是完整URL（https://） → 直接返回
 * 2. 如果是 http:// 开头 → 转为 https:// 后返回
 * 3. 如果是 /static/xxx → 用 origin + /static/xxx 拼接
 * 4. 如果是 /uploads/xxx → 用 origin + /uploads/xxx 拼接
 * 5. 如果是 /images/xxx (旧格式) → 自动补 /static 前缀
 * 6. 其他情况 → 返回空字符串
 *
 * @param {string} relativeUrl - 数据库存储的相对路径
 * @returns {string} 完整的 HTTPS URL
 */
function resolveImageUrl(relativeUrl) {
  if (!relativeUrl || typeof relativeUrl !== 'string') return '';

  // 已经是完整URL，直接返回（确保HTTPS）
  if (relativeUrl.startsWith('https://')) return relativeUrl;
  if (relativeUrl.startsWith('http://')) return relativeUrl.replace('http://', 'https://');

  // 获取 origin（不带 /api 或 /static 的纯域名）
  let origin = 'https://rry.klai.top';
  try {
    const app = getApp();
    const baseUrl = (app && app.globalData && app.globalData.baseUrl) || origin + '/api';
    const match = baseUrl.match(/^(https?:\/\/[^\/]+)/);
    if (match) {
      origin = match[1].replace('http://', 'https://');
    }
  } catch (e) {}

  // 确保路径以 / 开头（数据库可能存储不带前导 / 的路径）
  if (!relativeUrl.startsWith('/')) {
    relativeUrl = '/' + relativeUrl;
  }

  // /static/ 开头的路径 → https://domain/static/xxx
  if (relativeUrl.startsWith('/static/')) {
    return origin + relativeUrl;
  }

  // /uploads/ 开头的路径 → https://domain/uploads/xxx
  if (relativeUrl.startsWith('/uploads/')) {
    return origin + relativeUrl;
  }

  // /images/ 开头的旧格式 → https://domain/static/images/xxx
  if (relativeUrl.startsWith('/images/')) {
    return origin + '/static' + relativeUrl;
  }

  // 其他以 / 开头的路径
  return origin + relativeUrl;
}

/**
 * 获取默认礼品图片 URL
 */
function getDefaultGiftImage() {
  // 后端 /static 映射到 server/public，实际文件为 default.jpg（非 .png），
  // 写错扩展名会导致默认占位图 404。
  return resolveImageUrl('/static/images/gifts/default.jpg');
}

/**
 * 用户相关API
 */
const userAPI = {
  // 获取用户信息
  getInfo: () => request.get('/user/info'),

  // 更新用户信息
  updateInfo: (data) => request.put('/user/info', data),

  // 获取积分
  getPoints: () => request.get('/user/points'),

  // 获取积分历史
  getPointsHistory: (params) => request.get('/user/points/history', params),

  // 获取用户仪表盘数据
  getDashboard: () => request.get('/user/dashboard'),

  // 规格7.4：获取信息可见范围设置
  getVisibility: () => request.get('/user/privacy/visibility'),

  // 规格7.4：更新信息可见范围设置
  updateVisibility: (data) => request.put('/user/privacy/visibility', data),

  // 规格7.4：申请删除账号数据
  requestDeletion: (reason) => request.post('/user/request-deletion', { reason }),

  // 规格7.4：导出个人数据（返回下载URL路径，供 wx.downloadFile 使用）
  getExportUrl: () => '/user/export-data'
};

/**
 * 餐食相关API
 */
const mealAPI = {
  // 上传餐食
  // @deprecated 已废弃，请使用 clockInAPI.imageClockIn
  upload: (filePath, formData) => request.uploadFile(filePath, formData),

  // 获取餐食列表
  getList: (params) => request.get('/meals/list', params),

  // 删除餐食
  delete: (mealId) => request.del(`/meals/${mealId}`)
};

/**
 * 积分兑换相关API
 */
const giftAPI = {
  // 获取礼品列表
  getList: () => request.get('/gifts/list'),

  // 兑换礼品（自动生成稳定幂等键，防止双击/网络重试导致的双扣和超卖）
  // 幂等键按(userId,giftId,时间窗口)维度生成：5分钟内对同一礼物的多次请求复用同一幂等键
  // 这样双击/快速重试都会命中同一个幂等键，后端返回首次兑换结果
  exchange: (giftId) => {
    const app = getApp();
    const userId = (app.globalData && app.globalData.userInfo && app.globalData.userInfo.id) || 'anon';
    // 5分钟时间窗口：floor(Date.now() / 300000) 让同一窗口内的多次请求生成相同幂等键
    const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    const idempotencyKey = `EX_${userId}_${giftId}_${timeWindow}`;
    return request.post('/gifts/exchange', { giftId, idempotencyKey });
  },

  // 获取兑换记录
  getExchangeHistory: (params) => request.get('/gifts/history', params)
};

/**
 * 问卷相关API
 */
const questionnaireAPI = {
  // 提交问卷（含答案、完成时间、隐私授权确认）
  submit: (data) => request.post('/user/questionnaire', data),

  // 获取问卷结果（silent=true：未完成时不弹错误提示）
  getResult: (silent) => request.get('/user/questionnaire/result', {}, silent),
};

/**
 * 课程学习相关API
 */
const courseAPI = {
  // 更新学习进度
  updateProgress: (data) => request.post('/user/courses/progress', data),

  // 获取学习历史
  getHistory: (params) => request.get('/user/courses/history', params),

  // 获取课程列表
  getList: () => request.get('/user/courses/list')
};

/**
 * 打卡相关API
 */
const clockInAPI = {
  // 图标打卡
  iconClockIn: (data) => request.post('/clock-in/icon', data),

  // 图片打卡
  imageClockIn: (filePath, formData) => request.uploadFile(filePath, formData, '/clock-in/image'),

  // 获取今日打卡记录
  getToday: () => request.get('/clock-in/today'),

  // 获取打卡历史
  getHistory: (params) => request.get('/clock-in/history', params)
};

/**
 * 签到相关API
 */
const signInAPI = {
  // 每日签到
  signIn: () => request.post('/user/sign-in'),

  // 获取签到历史
  getHistory: (params) => request.get('/user/sign-in/history', params)
};

/**
 * 报告相关API
 */
const reportAPI = {
  // 生成报告
  generate: () => request.post('/user/reports/generate'),

  // 获取危机钩子报告
  getCrisisHook: () => request.get('/user/reports/crisis-hook'),

  // 获取7天调理方案（需传入用户ID，供后台/到店查看）
  get7DayPlan: (userId) => request.get(`/user/reports/7day-plan/${userId}`),

  // 获取本人的7天调理方案（无需传userId）
  getMy7DayPlan: () => request.get('/user/reports/my-7day-plan'),

  // 会员下载报告 PDF（方案3.3：每月限1次）返回下载URL，前端用 wx.downloadFile
  downloadReport: (reportId) => `/user/reports/download/${reportId}`
};

/**
 * Agent相关API
 */
const agentAPI = {
  // 获取用户列表
  getUsers: (params) => request.get('/agent/users', params),

  // 获取统计数据
  getStatistics: () => request.get('/agent/statistics'),

  // 获取名下用户餐食列表（供审核页使用）
  getMeals: (params) => request.get('/agent/meals', params),

  // 审核餐食
  reviewMeal: (mealId, data) => request.put(`/agent/meals/${mealId}/review`, data),

  // 核销积分（自动附带幂等键，防止重复核销；如需跨重试幂等，调用方应自行传入稳定的 idempotencyKey）
  writeOffPoints: (data) => {
    const payload = { ...data };
    if (!payload.idempotencyKey) {
      payload.idempotencyKey = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
    }
    return request.post('/agent/points/write-off', payload);
  },

  // 发布图文信息（自动生成幂等键，防重复发布）
  publishPost: (data) => {
    const payload = { ...data };
    if (!payload.idempotencyKey && !payload.idempotency_key) {
      // 基于内容生成稳定幂等键：5分钟内相同内容视为重复提交
      const contentHash = (payload.title + '|' + (payload.content || '')).length;
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      payload.idempotencyKey = `POST_${contentHash}_${timeWindow}`;
    }
    return request.post('/agent/posts', payload);
  },

  // 获取发布列表
  getPosts: (params) => request.get('/agent/posts', params),

  // 获取分润记录（支持 source/status/period 筛选）
  getCommissions: (params) => request.get('/agent/commissions', params),

  // 获取专属拉新二维码/分享码
  getShareCode: () => request.get('/agent/share-code'),

  // 获取未活跃会员列表（方案3.5 流失预警，支持 days 自定义阈值）
  getInactiveUsers: (params) => request.get('/agent/users/inactive', params),

  // 会员转化（方案3.2：代理商线下讲解后转化用户为会员，自动生成幂等键）
  convertToMember: (userId, data) => {
    const payload = { ...data };
    if (!payload.idempotencyKey && !payload.idempotency_key) {
      // 基于 userId 生成稳定幂等键：5分钟时间窗口内重复提交视为同一次转化
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      payload.idempotencyKey = `CONV_${userId}_${timeWindow}`;
    }
    return request.post(`/agent/users/${userId}/convert-to-member`, payload);
  },

  // 获取名下用户完整报告列表（含7天调理方案，方案3.2）
  getReports: (userId) => request.get(`/agent/reports/${userId}`),

  // 编辑名下用户报告内容
  editReport: (reportId, data) => request.put(`/agent/reports/${reportId}/edit`, data),

  // 下载名下用户报告（返回下载路径，前端用 wx.downloadFile）
  downloadReport: (reportId) => `/agent/reports/${reportId}/download`,

  // 核销礼品兑换码（方案3.4：线下核销实物兑换，自动生成幂等键）
  redeemGift: (data) => {
    const payload = { ...data };
    if (!payload.idempotencyKey && !payload.idempotency_key) {
      // 基于核销码生成稳定幂等键：同一核销码5分钟内重复提交视为同一次核销
      const code = payload.writeOffCode || payload.write_off_code || '';
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      payload.idempotencyKey = `REDEEM_${code}_${timeWindow}`;
    }
    return request.post('/agent/gifts/redeem', payload);
  },

  // 获取待跟进的流失预警列表（方案3.5：后台自动提醒 → 主动跟进）
  getAlerts: (params) => request.get('/agent/alerts', params),

  // 标记预警为已跟进
  followUpAlert: (alertId, data) => request.put(`/agent/alerts/${alertId}/follow-up`, data),

  // 获取最近活动列表
  getActivities: () => request.get('/agent/activities')
};

/**
 * 服务商后台相关API
 */
const serviceProviderAPI = {
  // 获取统计数据（支持 days 参数自定义活跃度阈值）
  getStatistics: (params) => request.get('/service-provider/statistics', params),

  // 获取客户列表
  getUsers: (params) => request.get('/service-provider/users', params),

  // 获取客户详情
  getUserDetail: (userId) => request.get(`/service-provider/users/${userId}`),

  // 获取未活跃客户（支持 days 参数自定义阈值，默认3天）
  getInactiveUsers: (params) => request.get('/service-provider/users/inactive', params),

  // 获取客户报告
  getReports: (userId) => request.get(`/service-provider/reports/${userId}`),

  // 下载客户报告（返回下载路径，前端用 wx.downloadFile）
  downloadReport: (reportId) => `/service-provider/reports/${reportId}/download`,

  // 创建接待记录（自动生成幂等键，防重复创建）
  createReception: (data) => {
    const payload = { ...data };
    if (!payload.idempotencyKey && !payload.idempotency_key) {
      // 基于内容生成稳定幂等键：5分钟内相同内容视为重复提交
      const contentHash = (payload.userId || payload.user_id || '') + '|' + (payload.receptionTime || payload.reception_time || '');
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      payload.idempotencyKey = `RECP_${contentHash.length}_${timeWindow}`;
    }
    return request.post('/service-provider/receptions', payload);
  },

  // 获取接待记录（支持按 userId 筛选）
  getReceptions: (params) => request.get('/service-provider/receptions', params),

  // 获取网点信息
  getProfile: () => request.get('/service-provider/profile'),

  // 更新网点信息
  updateProfile: (data) => request.put('/service-provider/profile', data),

  // 获取待跟进的流失预警列表（方案3.5：后台自动提醒 → 主动跟进）
  getAlerts: (params) => request.get('/service-provider/alerts', params),

  // 标记预警为已跟进
  followUpAlert: (alertId, data) => request.put(`/service-provider/alerts/${alertId}/follow-up`, data)
};

/**
 * 资讯相关API（用户端）
 */
const articleAPI = {
  // 获取已发布资讯列表
  getList: (params) => request.get('/user/articles', params),

  // 获取资讯详情
  getDetail: (id) => request.get(`/user/articles/${id}`)
};

/**
 * 认证相关API
 */
const authAPI = {
  // 登录（支持分享码与推荐人ID）
  login: (code, shareCode, referrerId) => request.post('/auth/login', {
    code,
    shareCode,
    referrerId
  }),

  // 管理员登录（账号密码，仅限 admin/agent/service_provider 角色）
  webLogin: (account, password) => request.post('/auth/web-login', { account, password }),

  // 验证token
  validate: () => request.get('/auth/validate'),

  // 登出
  logout: () => request.post('/auth/logout'),

  // 获取用户端分享码
  getMyShareCode: () => request.get('/auth/my-share-code'),

  // 获取我的推荐列表
  getMyReferrals: (params) => request.get('/auth/my-referrals', params),

  // 获取我的拉新统计
  getMyReferralStats: () => request.get('/auth/my-referral-stats')
};

/**
 * Admin 相关API（对齐 Web 端 admin-web/src/api/admin.js 的 25+ 方法）
 * 确保小程序端与 Web 端调用同一后端接口，数据源统一
 */
const adminAPI = {
  // 统计数据
  getStatistics: () => request.get('/admin/statistics'),

  // ===== 账号管理 =====
  getAccounts: (params) => request.get('/admin/accounts', params),
  createAccount: (data) => request.post('/admin/accounts', data),
  updateAccountRole: (id, data) => request.put(`/admin/accounts/${id}/role`, data),
  updateAccountStatus: (id, data) => request.put(`/admin/accounts/${id}/status`, data),
  resetPassword: (id, data) => request.post(`/admin/accounts/${id}/reset-password`, data),

  // ===== 用户管理 =====
  getUsers: (params) => request.get('/admin/users', params),
  getUserDetail: (id) => request.get(`/admin/users/${id}`),
  updateUserStatus: (id, data) => request.put(`/admin/users/${id}/status`, data),
  updateUserRole: (id, data) => request.put(`/admin/users/${id}/role`, data),

  // ===== 系统配置 =====
  getConfig: (params) => request.get('/admin/config', params),
  updateConfig: (key, data) => request.put(`/admin/config/${key}`, data),
  resetConfig: (key) => request.post(`/admin/config/${key}/reset`),

  // ===== 违禁词库 =====
  getForbiddenWords: (params) => request.get('/admin/forbidden-words', params),
  createForbiddenWord: (data) => request.post('/admin/forbidden-words', data),
  updateForbiddenWord: (id, data) => request.put(`/admin/forbidden-words/${id}`, data),
  deleteForbiddenWord: (id) => request.del(`/admin/forbidden-words/${id}`),

  // ===== 接口配置 =====
  getInterfaceConfig: () => request.get('/admin/interface-config'),
  updateInterfaceConfig: (key, data) => request.put(`/admin/interface-config/${key}`, data),

  // ===== 报告复核 =====
  getFlaggedReports: (params) => request.get('/admin/reports/flagged', params),
  getReportReviewDetail: (id) => request.get(`/admin/reports/${id}/review`),
  reviewReport: (id, data) => request.put(`/admin/reports/${id}/review`, data),
  rewriteReport: (id) => request.post(`/admin/reports/${id}/rewrite`),
  getFeedbackStats: () => request.get('/admin/reports/feedback-stats'),

  // ===== Prompt 版本管理 =====
  getPrompts: (params) => request.get('/admin/prompts', params),
  createPrompt: (data) => request.post('/admin/prompts', data),
  activatePrompt: (id) => request.put(`/admin/prompts/${id}/activate`),
  getActivePrompt: (key) => request.get(`/admin/prompts/${key}/active`),

  // ===== 内容发布审核 =====
  getPosts: (params) => request.get('/admin/posts', params),
  reviewPost: (id, data) => request.put(`/admin/posts/${id}/review`, data),

  // ===== 资讯管理 =====
  getArticles: (params) => request.get('/admin/articles', params),
  createArticle: (data) => request.post('/admin/articles', data),
  updateArticle: (id, data) => request.put(`/admin/articles/${id}`, data),
  publishArticle: (id, data) => request.put(`/admin/articles/${id}/publish`, data),
  deleteArticle: (id) => request.del(`/admin/articles/${id}`),

  // ===== 礼品管理 =====
  getGifts: (params) => request.get('/admin/gifts', params),
  createGift: (data) => request.post('/admin/gifts', data),
  updateGift: (id, data) => request.put(`/admin/gifts/${id}`, data),
  deleteGift: (id) => request.del(`/admin/gifts/${id}`),

  // ===== 订单与退款 =====
  getOrders: (params) => request.get('/admin/orders', params),
  refundOrder: (id, data) => request.post(`/admin/orders/${id}/refund`, data),

  // ===== 分润管理 =====
  getCommissions: (params) => request.get('/admin/commissions', params),
  getCommissionsSummary: (params) => request.get('/admin/commissions/summary', params),
  settleCommissions: (data) => request.post('/admin/commissions/settle', data),

  // ===== 核销记录 =====
  getWriteOffs: (params) => request.get('/admin/write-offs', params),

  // ===== 积分管理 =====
  getPointsHistory: (params) => request.get('/admin/points/history', params),
  adjustPoints: (data) => request.post('/admin/points/adjust', data),

  // ===== 系统基础设置 =====
  getSystemSettings: (params) => request.get('/admin/system-settings', params),
  getSystemSettingsSchema: () => request.get('/admin/system-settings/schema'),
  updateSystemSetting: (key, data) => request.put(`/admin/system-settings/${key}`, data)
};

module.exports = {
  userAPI,
  mealAPI,
  giftAPI,
  questionnaireAPI,
  courseAPI,
  clockInAPI,
  signInAPI,
  reportAPI,
  articleAPI,
  adminAPI,
  agentAPI,
  serviceProviderAPI,
  authAPI,
  resolveImageUrl,
  getDefaultGiftImage
};