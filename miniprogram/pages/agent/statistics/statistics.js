// pages/agent/statistics/statistics.js
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    loading: true,
    statistics: {
      totalUsers: 0,
      activeUsers: 0,
      totalPoints: 0,
      todayUploads: 0
    },
    activeRate: '0%'
  },

  onLoad() {
    this.loadStatistics();
  },

  // P1修复：onShow 刷新统计数据，避免返回后显示陈旧数据
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadStatistics();
    }
  },

  onPullDownRefresh() {
    this.loadStatistics(() => wx.stopPullDownRefresh());
  },

  loadStatistics(cb) {
    this.setData({ loading: true });
    agentAPI.getStatistics().then(res => {
      const s = res.data || {};
      const total = s.totalUsers || 0;
      const active = s.activeUsers || 0;
      const rate = total > 0 ? Math.round((active / total) * 100) + '%' : '0%';
      this.setData({
        statistics: s,
        activeRate: rate,
        loading: false
      });
      if (typeof cb === 'function') cb();
    }).catch(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  }
});
