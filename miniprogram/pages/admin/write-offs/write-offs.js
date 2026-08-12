// pages/admin/write-offs/write-offs.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    writeOffs: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    agentId: '',
    userId: '',
    startDate: '',
    endDate: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadWriteOffs();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshWriteOffs();
    }
  },

  onPullDownRefresh() {
    this.refreshWriteOffs();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadWriteOffs();
    }
  },

  refreshWriteOffs() {
    this.setData({ writeOffs: [], page: 1, hasMore: true });
    this.loadWriteOffs();
  },

  async loadWriteOffs() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const params = { page: this.data.page, pageSize: this.data.pageSize };
      if (this.data.agentId) params.agentId = this.data.agentId;
      if (this.data.userId) params.userId = this.data.userId;
      if (this.data.startDate) params.startDate = this.data.startDate;
      if (this.data.endDate) params.endDate = this.data.endDate;

      const res = await adminAPI.getWriteOffs(params);
      const list = (res.data && res.data.writeOffs) || [];
      this.setData({
        writeOffs: this.data.writeOffs.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onAgentIdInput(e) {
    this.setData({ agentId: e.detail.value });
  },

  onUserIdInput(e) {
    this.setData({ userId: e.detail.value });
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  onSearch() {
    this.refreshWriteOffs();
  },

  formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
});
