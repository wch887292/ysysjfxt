// pages/admin/posts-review/posts-review.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    posts: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    statusFilter: 'all', // all / pending / approved / rejected
    showRejectModal: false,
    rejectPostId: null,
    rejectReason: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadPosts();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshPosts();
    }
  },

  onPullDownRefresh() {
    this.refreshPosts();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadPosts();
    }
  },

  // 筛选切换
  onFilterTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.statusFilter) return;
    this.setData({ statusFilter: status, posts: [], page: 1, hasMore: true });
    this.loadPosts();
  },

  refreshPosts() {
    this.setData({ posts: [], page: 1, hasMore: true });
    this.loadPosts();
  },

  async loadPosts() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const params = { page: this.data.page, pageSize: this.data.pageSize };
      if (this.data.statusFilter !== 'all') {
        params.status = this.data.statusFilter;
      }
      const res = await adminAPI.getPosts(params);
      const list = (res.data && res.data.posts) || [];
      this.setData({
        posts: this.data.posts.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 审核通过
  onApprove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认通过',
      content: '确定要通过该内容审核吗？',
      success: (res) => {
        if (res.confirm) {
          this.doReview(id, 'approved', '');
        }
      }
    });
  },

  // 打开拒绝弹窗
  onShowReject(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showRejectModal: true, rejectPostId: id, rejectReason: '' });
  },

  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  onCancelReject() {
    this.setData({ showRejectModal: false, rejectPostId: null, rejectReason: '' });
  },

  async onConfirmReject() {
    if (!this.data.rejectReason.trim()) {
      wx.showToast({ title: '请填写拒绝原因', icon: 'none' });
      return;
    }
    await this.doReview(this.data.rejectPostId, 'rejected', this.data.rejectReason.trim());
    this.setData({ showRejectModal: false, rejectPostId: null, rejectReason: '' });
  },

  async doReview(id, status, rejectReason) {
    try {
      const data = { status };
      if (status === 'rejected' && rejectReason) {
        data.rejectReason = rejectReason;
      }
      await adminAPI.reviewPost(id, data);
      wx.showToast({ title: status === 'approved' ? '已通过' : '已拒绝', icon: 'success' });
      this.refreshPosts();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
