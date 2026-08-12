// pages/admin/commissions/commissions.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    commissions: [],
    summary: null,
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showSettleModal: false,
    settleIds: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadCommissions();
      this.loadSummary();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshCommissions();
    }
  },

  onPullDownRefresh() {
    this.refreshCommissions();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadCommissions();
    }
  },

  refreshCommissions() {
    this.setData({ commissions: [], page: 1, hasMore: true });
    this.loadCommissions();
    this.loadSummary();
  },

  async loadCommissions() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getCommissions({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.commissions) || [];
      this.setData({
        commissions: this.data.commissions.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadSummary() {
    try {
      const res = await adminAPI.getCommissionsSummary();
      if (res.data) {
        this.setData({ summary: res.data });
      }
    } catch (err) {
      // 静默处理
    }
  },

  // 结算分润（需二次确认）
  onShowSettle() {
    this.setData({ showSettleModal: true, settleIds: '' });
  },

  onSettleIdsInput(e) {
    this.setData({ settleIds: e.detail.value });
  },

  onConfirmSettle() {
    const ids = this.data.settleIds.trim();
    if (!ids) {
      wx.showToast({ title: '请输入分润记录ID', icon: 'none' });
      return;
    }
    const idList = ids.split(',').map(s => s.trim()).filter(s => s);
    if (idList.length === 0) {
      wx.showToast({ title: '请输入有效的ID', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认结算',
      content: `确定要结算选中的${idList.length}条分润记录吗？此操作不可撤销。`,
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          this.doSettle(idList);
        }
      }
    });
  },

  async doSettle(ids) {
    try {
      wx.showLoading({ title: '结算中...' });
      const idempotencyKey = 'STL_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.settleCommissions({ commissionIds: ids, idempotencyKey });
      wx.hideLoading();
      wx.showToast({ title: '结算成功', icon: 'success' });
      this.setData({ showSettleModal: false });
      this.refreshCommissions();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '结算失败', icon: 'none' });
    }
  },

  onCancelSettle() {
    this.setData({ showSettleModal: false });
  }
});
