// pages/agent/home/home.js
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    statistics: {
      totalUsers: 0,
      activeUsers: 0,
      totalPoints: 0,
      todayUploads: 0
    },
    recentActivities: []
  },

  onLoad() {
    // P0修复：客户端角色验证，非代理商/管理员拒绝进入
    if (!this._checkAgentRole()) return;
    const app = getApp();
    app.onLoginReady((err) => {
      if (err) return;
      if (!this._checkAgentRole()) return;
      this.loadStatistics();
      this.loadRecentActivities();
    });
  },

  // P1修复：onShow 刷新统计数据，避免返回后显示陈旧数据
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      if (!this._checkAgentRole()) return;
      this.loadStatistics();
      this.loadRecentActivities();
    }
  },

  /**
   * 客户端角色验证：仅 agent/admin 角色可进入代理商后台
   */
  _checkAgentRole() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role;
    if (role !== 'agent' && role !== 'admin') {
      wx.showModal({
        title: '无权限',
        content: '仅代理商可访问此页面',
        showCancel: false,
        success: () => { wx.switchTab({ url: '/pages/user/home/home' }); }
      });
      return false;
    }
    return true;
  },

  loadStatistics() {
    agentAPI.getStatistics().then(res => {
      if (res.data) {
        this.setData({ statistics: res.data });
      }
    }).catch(() => {});
  },

  loadRecentActivities() {
    agentAPI.getActivities().then(res => {
      if (res.data) {
        this.setData({
          recentActivities: res.data.activities
        });
      }
    }).catch(() => {});
  },

  navigateToUsers() {
    wx.navigateTo({
      url: '/pages/agent/users/users',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToReview() {
    wx.navigateTo({
      url: '/pages/agent/review/review',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToStatistics() {
    wx.navigateTo({
      url: '/pages/agent/statistics/statistics',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToWriteOff() {
    wx.navigateTo({
      url: '/pages/agent/write-off/write-off',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToCommissions() {
    wx.navigateTo({
      url: '/pages/agent/commissions/commissions',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToPosts() {
    wx.navigateTo({
      url: '/pages/agent/posts/posts',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToReportEdit() {
    wx.navigateTo({
      url: '/pages/agent/report-edit/report-edit',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToReportDownload() {
    wx.navigateTo({
      url: '/pages/agent/report-download/report-download',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToQrcode() {
    wx.navigateTo({
      url: '/pages/agent/qrcode/qrcode',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToConvertMember() {
    wx.navigateTo({
      url: '/pages/agent/convert-member/convert-member',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  }
});