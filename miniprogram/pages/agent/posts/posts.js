// pages/agent/posts/posts.js - 代理商信息发布
const { agentAPI } = require('../../../utils/api');

const STATUS_MAP = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回'
};

Page({
  data: {
    posts: [],
    loading: false,
    statusFilter: 'pending_review',
    page: 1,
    hasMore: true,
    showForm: false,
    formData: {
      title: '',
      content: '',
      companyName: ''
    },
    submitting: false,
    statusTabs: [
      { label: '待审核', value: 'pending_review' },
      { label: '已通过', value: 'approved' },
      { label: '已驳回', value: 'rejected' }
    ],
    statusMap: STATUS_MAP
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadPosts();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshPosts();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, posts: [], hasMore: true });
    this.loadPosts(() => wx.stopPullDownRefresh());
  },

  refreshPosts() {
    this.setData({ page: 1, posts: [], hasMore: true });
    this.loadPosts();
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.statusFilter) return;
    this.setData({
      statusFilter: status,
      page: 1,
      posts: [],
      hasMore: true
    });
    this.loadPosts();
  },

  loadPosts(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    agentAPI.getPosts({
      status: this.data.statusFilter,
      page: this.data.page,
      pageSize: 20
    }).then(res => {
      const newPosts = (res.data && res.data.posts) || [];
      this.setData({
        posts: this.data.posts.concat(newPosts),
        hasMore: res.data ? res.data.hasMore : false
      });
    }).catch(() => {}).finally(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadPosts();
    }
  },

  toggleForm() {
    this.setData({ showForm: !this.data.showForm });
  },

  onTitleInput(e) {
    this.setData({ 'formData.title': e.detail.value });
  },

  onContentInput(e) {
    this.setData({ 'formData.content': e.detail.value });
  },

  onCompanyInput(e) {
    this.setData({ 'formData.companyName': e.detail.value });
  },

  validate() {
    const { title, content } = this.data.formData;
    if (!title || !title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return false;
    }
    if (title.length > 100) {
      wx.showToast({ title: '标题不超过100字', icon: 'none' });
      return false;
    }
    if (!content || !content.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return false;
    }
    if (content.length > 5000) {
      wx.showToast({ title: '内容不超过5000字', icon: 'none' });
      return false;
    }
    return true;
  },

  submitPost() {
    if (this.data.submitting) return;       // 防双击
    if (!this.validate()) return;

    // 规格12.2 适老化：重要操作二次确认
    wx.showModal({
      title: '确认发布',
      content: '确认要发布该信息吗？发布后将进入审核流程。',
      confirmText: '确认发布',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return;
        this._doPublish();
      }
    });
  },

  _doPublish() {
    this.setData({ submitting: true });
    const { title, content, companyName } = this.data.formData;
    const payload = {
      title: title.trim(),
      content: content.trim(),
      companyName: companyName ? companyName.trim() : ''
    };

    agentAPI.publishPost(payload).then(() => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.setData({
        showForm: false,
        formData: { title: '', content: '', companyName: '' }
      });
      // 发布后切到待审核并刷新
      this.setData({
        statusFilter: 'pending_review',
        page: 1,
        posts: [],
        hasMore: true
      });
      this.loadPosts();
    }).catch(() => {}).finally(() => {
      this.setData({ submitting: false });
    });
  }
});
