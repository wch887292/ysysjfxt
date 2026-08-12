// pages/service-provider/home/home.js
const { serviceProviderAPI } = require('../../../utils/api');

Page({
  data: {
    statistics: {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0
    },
    recentInactive: []
  },

  onLoad() {
    // P0修复：客户端角色验证，非服务商/管理员拒绝进入
    if (!this._checkServiceProviderRole()) return;
    const app = getApp();
    app.onLoginReady((err) => {
      if (err) return;
      if (!this._checkServiceProviderRole()) return;
      this.loadStatistics();
      this.loadRecentInactive();
    });
  },

  // onShow 刷新统计数据，避免返回后显示陈旧数据
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      if (!this._checkServiceProviderRole()) return;
      this.loadStatistics();
      this.loadRecentInactive();
    }
  },

  /**
   * 客户端角色验证：仅 service_provider/admin 角色可进入服务商后台
   */
  _checkServiceProviderRole() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role;
    if (role !== 'service_provider' && role !== 'admin') {
      wx.showModal({
        title: '无权限',
        content: '仅服务商可访问此页面',
        showCancel: false,
        success: () => { wx.switchTab({ url: '/pages/user/home/home' }); }
      });
      return false;
    }
    return true;
  },

  loadStatistics() {
    serviceProviderAPI.getStatistics().then(res => {
      if (res.data) {
        this.setData({ statistics: res.data });
      }
    }).catch(() => {});
  },

  loadRecentInactive() {
    serviceProviderAPI.getInactiveUsers({ days: 3, pageSize: 5 }).then(res => {
      const users = (res.data && res.data.users) || [];
      this.setData({ recentInactive: users });
    }).catch(() => {});
  },

  navigateToUsers() {
    wx.navigateTo({
      url: '/pages/service-provider/users/users',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToReports() {
    wx.navigateTo({
      url: '/pages/service-provider/reports/reports',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToReceptions() {
    wx.navigateTo({
      url: '/pages/service-provider/receptions/receptions',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToProfile() {
    wx.navigateTo({
      url: '/pages/service-provider/profile/profile',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToAlerts() {
    wx.navigateTo({
      url: '/pages/service-provider/alerts/alerts',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  }
});
