// pages/service-provider/users/users.js
const { serviceProviderAPI } = require('../../../utils/api');

Page({
  data: {
    users: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    searchKeyword: '',
    activeTab: 'all',
    tabs: [
      { label: '全部', value: 'all' },
      { label: '未活跃', value: 'inactive' }
    ]
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadUsers();
    });
  },

  // onShow 刷新数据，避免返回后显示陈旧用户列表
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

    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize
    };

    if (this.data.activeTab === 'inactive') {
      params.days = 3;
      serviceProviderAPI.getInactiveUsers(params).then(res => {
        const newUsers = (res.data && res.data.users) || [];
        this.setData({
          users: this.data.users.concat(newUsers),
          hasMore: !!(res.data && res.data.hasMore)
        });
      }).catch(() => {
        // 原为空 catch，请求失败时页面无任何反馈，用户只会看到空列表
        wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
      }).finally(() => {
        this.setData({ loading: false });
      });
    } else {
      params.keyword = this.data.searchKeyword;
      serviceProviderAPI.getUsers(params).then(res => {
        const newUsers = (res.data && res.data.users) || [];
        this.setData({
          users: this.data.users.concat(newUsers),
          hasMore: !!(res.data && res.data.hasMore)
        });
      }).catch(() => {
        // 原为空 catch，请求失败时页面无任何反馈，用户只会看到空列表
        wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
      }).finally(() => {
        this.setData({ loading: false });
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;
    this.setData({
      activeTab: tab,
      users: [],
      page: 1,
      hasMore: true
    });
    this.loadUsers();
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
    wx.navigateTo({
      url: `/pages/service-provider/reports/reports?userId=${userId}`,
      fail: () => {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
