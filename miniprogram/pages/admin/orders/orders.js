// pages/admin/orders/orders.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    orders: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    searchKeyword: '',
    showRefundModal: false,
    refundOrderId: '',
    refundReason: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadOrders();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshOrders();
    }
  },

  onPullDownRefresh() {
    this.refreshOrders();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders();
    }
  },

  refreshOrders() {
    this.setData({ orders: [], page: 1, hasMore: true });
    this.loadOrders();
  },

  async loadOrders() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getOrders({ page: this.data.page, pageSize: this.data.pageSize, keyword: this.data.searchKeyword });
      const list = (res.data && res.data.orders) || [];
      this.setData({
        orders: this.data.orders.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.refreshOrders();
  },

  // 退款
  onRefund(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showRefundModal: true, refundOrderId: id, refundReason: '' });
  },

  onRefundReasonInput(e) {
    this.setData({ refundReason: e.detail.value });
  },

  onConfirmRefund() {
    const { refundOrderId, refundReason } = this.data;
    if (!refundReason.trim()) {
      wx.showToast({ title: '请输入退款原因', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认退款',
      content: `确定要进行退款吗？此操作不可撤销。`,
      confirmColor: '#F44336',
      success: (res) => {
        if (res.confirm) {
          this.doRefund(refundOrderId, refundReason);
        }
      }
    });
  },

  onCancelRefund() {
    this.setData({ showRefundModal: false });
  },

  async doRefund(id, reason) {
    try {
      wx.showLoading({ title: '退款中...' });
      const idempotencyKey = 'REFUND_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.refundOrder(id, { reason, idempotencyKey });
      wx.hideLoading();
      wx.showToast({ title: '退款成功', icon: 'success' });
      this.setData({ showRefundModal: false });
      this.refreshOrders();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '退款失败', icon: 'none' });
    }
  }
});
