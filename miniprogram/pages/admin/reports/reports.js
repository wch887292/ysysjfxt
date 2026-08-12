// pages/admin/reports/reports.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    reports: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showDetailModal: false,
    showReviewModal: false,
    currentReport: null,
    reviewAction: '',
    reviewNote: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReports();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshReports();
    }
  },

  onPullDownRefresh() {
    this.refreshReports();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadReports();
    }
  },

  refreshReports() {
    this.setData({ reports: [], page: 1, hasMore: true });
    this.loadReports();
  },

  async loadReports() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getFlaggedReports({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.reports) || [];
      this.setData({
        reports: this.data.reports.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 查看详情
  async onViewDetail(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await adminAPI.getReportReviewDetail(id);
      this.setData({ showDetailModal: true, currentReport: res.data });
    } catch (err) {
      wx.showToast({ title: '获取详情失败', icon: 'none' });
    }
  },

  onCloseDetail() {
    this.setData({ showDetailModal: false, currentReport: null });
  },

  // 审核
  onReview(e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    this.setData({ showReviewModal: true, editTarget: id, reviewAction: action, reviewNote: '' });
  },

  onReviewNoteInput(e) {
    this.setData({ reviewNote: e.detail.value });
  },

  async onConfirmReview() {
    try {
      await adminAPI.reviewReport(this.data.editTarget, {
        action: this.data.reviewAction,
        note: this.data.reviewNote
      });
      wx.showToast({ title: '审核完成', icon: 'success' });
      this.setData({ showReviewModal: false });
      this.refreshReports();
    } catch (err) {
      wx.showToast({ title: '审核失败', icon: 'none' });
    }
  },

  onCancelReview() {
    this.setData({ showReviewModal: false });
  },

  // 重写
  onRewrite(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认重写',
      content: '确定要重新生成该报告吗？',
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          this.doRewrite(id);
        }
      }
    });
  },

  async doRewrite(id) {
    try {
      wx.showLoading({ title: '重写中...' });
      await adminAPI.rewriteReport(id);
      wx.hideLoading();
      wx.showToast({ title: '重写请求已提交', icon: 'success' });
      this.refreshReports();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '重写失败', icon: 'none' });
    }
  }
});
