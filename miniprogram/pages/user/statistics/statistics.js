// pages/user/statistics/statistics.js - 数据统计
const { userAPI, clockInAPI } = require('../../../utils/api');

Page({
  data: {
    points: 0,
    totalPoints: 0,
    ranking: 0,
    todayPoints: 0,
    records: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadSummary();
    this.loadRecords();
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.setData({ page: 1, records: [], hasMore: true, loading: false });
      this.loadSummary();
      this.loadRecords();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, records: [], hasMore: true });
    this.loadSummary();
    this.loadRecords(() => wx.stopPullDownRefresh());
  },

  loadSummary() {
    userAPI.getPoints().then(res => {
      this.setData({
        points: res.data.points || 0,
        totalPoints: res.data.totalPoints || 0,
        ranking: res.data.ranking || 0
      });
    }).catch(() => {});

    userAPI.getDashboard().then(res => {
      this.setData({ todayPoints: res.data.todayPoints || 0 });
    }).catch(() => {});
  },

  loadRecords(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    clockInAPI.getHistory({ page: this.data.page, pageSize: 10 }).then(res => {
      const mealTypeMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      const newRecords = (res.data.records || []).map(r => ({
        id: r.id,
        date: r.clock_in_date,
        mealType: mealTypeMap[r.meal_type] || '餐食',
        type: r.clock_in_type === 'icon' ? '图标打卡' : '拍照打卡',
        points: r.points_earned
      }));
      this.setData({
        records: this.data.records.concat(newRecords),
        hasMore: res.data.hasMore,
        loading: false
      });
      if (typeof cb === 'function') cb();
    }).catch(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadRecords();
    }
  },

  goClockIn() {
    wx.switchTab({
      url: '/pages/user/upload/upload'
    });
  }
});
