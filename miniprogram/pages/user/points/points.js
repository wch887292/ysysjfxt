// pages/user/points/points.js
const { userAPI } = require('../../../utils/api');

Page({
  data: {
    points: 0,
    pointsHistory: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    honorLevel: '',
    honorLevelName: '',
    badges: []
  },

  onLoad() {
    this._alive = true;
    const app = getApp();
    app.onLoginReady(() => {
      if (!this._alive) return;
      this.loadHonorInfo();
      this.loadPoints();
      this.loadPointsHistory();
    });
  },

  onShow() {
    if (!this._alive) return;
    if (getApp().globalData.loginReady === 'ready') {
      this.setData({ page: 1, pointsHistory: [] });
      this.loadPoints();
      this.loadPointsHistory();
    }
  },

  onUnload() {
    this._alive = false;
  },

  loadHonorInfo() {
    if (!this._alive) return;
    const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const honorLevelMap = {
      newcomer: '健康新人',
      expert: '健康达人',
      star: '健康之星',
      ambassador: '健康大使',
      messenger: '健康使者'
    };
    this.setData({
      honorLevel: userInfo.honorLevel || userInfo.honor_level || 'newcomer',
      honorLevelName: honorLevelMap[userInfo.honorLevel || userInfo.honor_level] || '健康新人',
      badges: userInfo.badges || []
    });
  },

  async loadPoints() {
    if (!this._alive) return;
    try {
      const res = await userAPI.getPoints();
      if (!this._alive) return;
      this.setData({ points: (res.data && res.data.points) || 0 });
    } catch (err) {
      // request.js 已弹错误提示
    }
  },

  async loadPointsHistory() {
    if (!this._alive) return;
    try {
      const res = await userAPI.getPointsHistory({
        page: this.data.page,
        pageSize: this.data.pageSize
      });
      if (!this._alive) return;
      const history = this.data.pointsHistory.concat(res.data.history || []);
      this.setData({
        pointsHistory: history,
        hasMore: res.data.hasMore
      });
    } catch (err) {
      // request.js 已弹错误提示
    }
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadPointsHistory();
    }
  },

  goClockIn() {
    wx.switchTab({
      url: '/pages/user/upload/upload'
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
