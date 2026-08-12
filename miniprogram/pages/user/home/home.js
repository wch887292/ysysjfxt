// pages/user/home/home.js
const { userAPI, resolveImageUrl } = require('../../../utils/api');
const { hasAgreedPrivacy } = require('../../../utils/privacy.js');

Page({
  data: {
    userInfo: {},
    points: 0,
    userLevel: 0,
    ranking: 0,
    todayPoints: 0,
    recentMeals: [],
    isLogged: false,
    // 隐私协议弹窗状态
    showPrivacyPopup: false
  },

  // 页面存活标志位：防止异步回调在页面销毁后操作UI（routeDone webviewId not found 根因修复）
  _alive: true,

  onLoad() {
    this._alive = true;
    const app = getApp();
    const token = wx.getStorageSync('token');

    // 检查隐私协议状态
    if (!hasAgreedPrivacy()) {
      this.setData({ showPrivacyPopup: true });
      // 同时通知 app.js
      app.globalData.showPrivacyPopup = true;
    }

    if (!token) {
      this.setData({ isLogged: false });
      return;
    }

    // 有 token 先乐观展示为已登录，等 validateToken 结果后再确认/回退
    this.setData({ isLogged: true });

    app.onLoginReady((err) => {
      if (!this._alive) return; // 页面已销毁，不再更新UI
      if (err) {
        this.setData({ isLogged: false });
        return;
      }
      this.loadUserInfo();
      this.loadDashboardData();
    });
  },

  onUnload() {
    this._alive = false;
  },

  // 用户点击登录按钮
  doLogin() {
    if (!this._alive) return;
    const app = getApp();
    wx.showLoading({ title: '登录中...' });

    let timeoutFired = false;
    const timeoutTimer = setTimeout(() => {
      timeoutFired = true;
      wx.hideLoading();
      if (this._alive) {
        wx.showToast({ title: '登录超时，请重试', icon: 'none' });
      }
    }, 10000);

    // 顺序很关键：必须先 login() 再 onLoginReady()。
    // login() 内部会把 loginReady 重置为 'pending'，
    // 这样紧接着注册的回调才会进入等待队列，而不是命中残留的 'failed' 状态被立即回调。
    // wx.login 的结果最早也要到下一个事件循环才返回，
    // 因此在同一同步块内先发起登录、后注册回调不会漏掉通知。
    app.login();

    app.onLoginReady((err) => {
      if (timeoutFired || !this._alive) return;
      clearTimeout(timeoutTimer);
      wx.hideLoading();
      if (err) {
        this.setData({ isLogged: false });
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        return;
      }
      this.setData({ isLogged: true });
      this.loadUserInfo();
      this.loadDashboardData();
    });
  },

  onShow() {
    if (!this._alive) return;
    const app = getApp();
    if (app.globalData.loginReady === 'ready') {
      this.setData({ isLogged: true });
      this.loadUserInfo();
      this.loadDashboardData();
    } else if (app.globalData.loginReady === 'failed') {
      this.setData({ isLogged: false });
    }
  },

  loadUserInfo() {
    if (!this._alive) return;
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      const points = (userInfo.points != null ? userInfo.points : 0) || 0;
      this.setData({ userInfo, points, userLevel: Math.floor(points / 100) });
    }
  },

  async loadDashboardData() {
    if (!this._alive) return;
    try {
      const res = await userAPI.getDashboard();
      if (!this._alive) return;
      const { points, ranking, todayPoints, recentMeals } = res.data;
      const meals = (recentMeals || []).map(m => ({
        ...m,
        imageUrl: resolveImageUrl(m.imageUrl || m.image_url)
      }));
      this.setData({
        points,
        userLevel: Math.floor((points || 0) / 100),
        ranking,
        todayPoints,
        recentMeals: meals
      });
    } catch (err) {
      console.error('加载数据失败', err);
    }
  },

  navigateToUpload() {
    wx.switchTab({
      url: '/pages/user/upload/upload'
    });
  },

  // 跳转到打卡记录/统计页（查看最近上传的完整列表）
  navigateToStatistics() {
    wx.navigateTo({
      url: '/pages/user/statistics/statistics',
      fail: (err) => {
        console.error('跳转打卡记录页失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  navigateToPoints() {
    wx.switchTab({
      url: '/pages/user/points/points'
    });
  },

  navigateToExchange() {
    wx.navigateTo({
      url: '/pages/user/exchange/exchange',
      fail: (err) => {
        console.error('跳转礼品兑换页失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 健康评估
  navigateToQuestionnaire() {
    wx.navigateTo({
      url: '/pages/user/questionnaire/questionnaire',
      fail: (err) => {
        console.error('跳转健康评估失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 课程学习
  navigateToCourse() {
    wx.navigateTo({
      url: '/pages/user/course/list',
      fail: (err) => {
        console.error('跳转课程学习失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 报告查看（危机钩子报告）
  navigateToCrisisReport() {
    wx.navigateTo({
      url: '/pages/user/report/crisis-hook',
      fail: (err) => {
        console.error('跳转报告查看失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 拉新拓客
  navigateToReferral() {
    wx.navigateTo({
      url: '/pages/user/referral/referral',
      fail: (err) => {
        console.error('跳转拉新拓客失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 资讯阅读
  navigateToArticles() {
    wx.navigateTo({
      url: '/pages/user/articles/articles',
      fail: (err) => {
        console.error('跳转资讯页失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 隐私协议同意回调
  onPrivacyAgree() {
    this.setData({ showPrivacyPopup: false });
    const app = getApp();
    // 通知 app.js 用户已同意隐私协议
    if (app.onPrivacyAgreed) {
      app.onPrivacyAgreed();
    }
  },

  onShareAppMessage() {
    const userInfo = (getApp().globalData.userInfo) || wx.getStorageSync('userInfo') || {};
    const path = userInfo.id
      ? '/pages/user/home/home?referrerId=' + userInfo.id
      : '/pages/user/home/home';
    return {
      title: '健康饮食积分 - 记录每一餐，积累健康财富',
      path
    };
  }
});