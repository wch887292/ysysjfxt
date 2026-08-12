// pages/admin/dashboard/dashboard.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    statistics: {
      totalUsers: 0,
      totalAgents: 0,
      totalPointsIssued: 0,
      totalPointsUsed: 0,
      totalMeals: 0,
      activeUsersToday: 0,
      activeUsersWeek: 0,
      activeUsersMonth: 0
    },
    chartData: null,
    loading: true
  },

  onLoad() {
    // P0修复：客户端角色验证，非管理员直接拒绝进入
    if (!this._checkAdminRole()) return;
    const app = getApp();
    app.onLoginReady((err) => {
      if (err) {
        this.setData({ loading: false });
        return;
      }
      if (!this._checkAdminRole()) return;
      this.loadStatistics();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      if (!this._checkAdminRole()) return;
      this.loadStatistics();
    }
  },

  /**
   * 客户端角色验证：仅 admin 角色可进入管理后台
   * 服务端已有 adminOnly 中间件兜底，此处为第一道防线，避免非管理员看到后台UI
   */
  _checkAdminRole() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role;
    if (role !== 'admin') {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => {
          wx.switchTab({ url: '/pages/user/home/home' });
        }
      });
      return false;
    }
    return true;
  },

  async loadStatistics() {
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getStatistics();
      if (res.data) {
        this.setData({ statistics: res.data });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 导航方法
  navigateToAccounts() {
    wx.navigateTo({ url: '/pages/admin/accounts/accounts' });
  },

  navigateToUsers() {
    wx.navigateTo({ url: '/pages/admin/users/users' });
  },

  navigateToConfig() {
    wx.navigateTo({ url: '/pages/admin/config/config' });
  },

  navigateToForbiddenWords() {
    wx.navigateTo({ url: '/pages/admin/forbidden-words/forbidden-words' });
  },

  navigateToReports() {
    wx.navigateTo({ url: '/pages/admin/reports/reports' });
  },

  navigateToArticles() {
    wx.navigateTo({ url: '/pages/admin/articles/articles' });
  },

  navigateToGifts() {
    wx.navigateTo({ url: '/pages/admin/gifts/gifts' });
  },

  navigateToOrders() {
    wx.navigateTo({ url: '/pages/admin/orders/orders' });
  },

  navigateToPoints() {
    wx.navigateTo({ url: '/pages/admin/points/points' });
  },

  navigateToCommissions() {
    wx.navigateTo({ url: '/pages/admin/commissions/commissions' });
  },

  navigateToWriteOffs() {
    wx.navigateTo({ url: '/pages/admin/write-offs/write-offs' });
  },

  navigateToPrompts() {
    wx.navigateTo({ url: '/pages/admin/prompts/prompts' });
  },

  navigateToPostsReview() {
    wx.navigateTo({ url: '/pages/admin/posts-review/posts-review' });
  },

  navigateToSystemSettings() {
    wx.navigateTo({ url: '/pages/admin/system-settings/system-settings' });
  }
});
