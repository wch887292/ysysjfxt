// pages/admin/points/points.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    history: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showAdjustModal: false,
    adjustUserId: '',
    adjustAmount: '',
    adjustReason: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadHistory();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshHistory();
    }
  },

  onPullDownRefresh() {
    this.refreshHistory();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadHistory();
    }
  },

  refreshHistory() {
    this.setData({ history: [], page: 1, hasMore: true });
    this.loadHistory();
  },

  async loadHistory() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getPointsHistory({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.history) || [];
      this.setData({
        history: this.data.history.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 积分调整
  onShowAdjust() {
    this.setData({ showAdjustModal: true, adjustUserId: '', adjustAmount: '', adjustReason: '' });
  },

  onAdjustUserIdInput(e) {
    this.setData({ adjustUserId: e.detail.value });
  },

  onAdjustAmountInput(e) {
    this.setData({ adjustAmount: e.detail.value });
  },

  onAdjustReasonInput(e) {
    this.setData({ adjustReason: e.detail.value });
  },

  onConfirmAdjust() {
    const { adjustUserId, adjustAmount, adjustReason } = this.data;
    if (!adjustUserId || !adjustAmount) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      wx.showToast({ title: '请输入有效积分数量', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认积分调整',
      content: `确定要为用户${adjustUserId}${amount > 0 ? '增加' : '扣除'}${Math.abs(amount)}积分吗？`,
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          this.doAdjust(adjustUserId, amount, adjustReason);
        }
      }
    });
  },

  async doAdjust(userId, amount, reason) {
    try {
      const idempotencyKey = 'ADJ_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.adjustPoints({ userId, points: amount, reason, confirm: true, idempotencyKey });
      wx.showToast({ title: '调整成功', icon: 'success' });
      this.setData({ showAdjustModal: false });
      this.refreshHistory();
    } catch (err) {
      wx.showToast({ title: '调整失败', icon: 'none' });
    }
  },

  onCancelAdjust() {
    this.setData({ showAdjustModal: false });
  }
});
