// pages/agent/users/users.js
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    users: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    searchKeyword: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadUsers();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧用户列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshUsers();
    }
  },

  refreshUsers() {
    this.setData({ users: [], page: 1, hasMore: true });
    this.loadUsers();
  },

  loadUsers() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    agentAPI.getUsers({
      page: this.data.page,
      pageSize: this.data.pageSize,
      keyword: this.data.searchKeyword
    }).then(res => {
      const newUsers = (res.data && res.data.users) || [];
      this.setData({
        users: this.data.users.concat(newUsers),
        hasMore: res.data.hasMore
      });
    }).catch(() => {}).finally(() => {
      this.setData({ loading: false });
    });
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  onSearch() {
    this.refreshUsers();
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadUsers();
    }
  },

  viewUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    // 注：原 user-detail 页面未注册，改为跳转积分核销页并带入 userId
    wx.navigateTo({
      url: `/pages/agent/write-off/write-off?userId=${userId}`,
      fail: () => {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});