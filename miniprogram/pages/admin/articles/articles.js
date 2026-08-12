// pages/admin/articles/articles.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    articles: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showCreateModal: false,
    showEditModal: false,
    newArticle: { title: '', content: '' },
    editTarget: null,
    editTitle: '',
    editContent: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadArticles();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshArticles();
    }
  },

  onPullDownRefresh() {
    this.refreshArticles();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadArticles();
    }
  },

  refreshArticles() {
    this.setData({ articles: [], page: 1, hasMore: true });
    this.loadArticles();
  },

  async loadArticles() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getArticles({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.articles) || [];
      this.setData({
        articles: this.data.articles.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 创建文章
  onShowCreate() {
    this.setData({ showCreateModal: true, newArticle: { title: '', content: '' } });
  },

  onCreateInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newArticle.${field}`]: e.detail.value });
  },

  async onCreateArticle() {
    const { title, content } = this.data.newArticle;
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    try {
      const idempotencyKey = 'ART_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.createArticle({ title, content, idempotencyKey });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreateModal: false });
      this.refreshArticles();
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  onCancelCreate() {
    this.setData({ showCreateModal: false });
  },

  // 编辑文章
  onEditArticle(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditModal: true,
      editTarget: item.id,
      editTitle: item.title,
      editContent: item.content || ''
    });
  },

  onEditTitleInput(e) {
    this.setData({ editTitle: e.detail.value });
  },

  onEditContentInput(e) {
    this.setData({ editContent: e.detail.value });
  },

  async onConfirmEdit() {
    try {
      await adminAPI.updateArticle(this.data.editTarget, {
        title: this.data.editTitle,
        content: this.data.editContent
      });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ showEditModal: false });
      this.refreshArticles();
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  onCancelEdit() {
    this.setData({ showEditModal: false });
  },

  // 发布文章
  onPublishArticle(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认发布',
      content: '确定要发布该文章吗？',
      success: (res) => {
        if (res.confirm) {
          this.doPublish(id);
        }
      }
    });
  },

  async doPublish(id) {
    try {
      await adminAPI.publishArticle(id, {});
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.refreshArticles();
    } catch (err) {
      wx.showToast({ title: '发布失败', icon: 'none' });
    }
  },

  // 删除文章（需二次确认）
  onDeleteArticle(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除文章"${title}"吗？此操作不可恢复。`,
      confirmColor: '#F44336',
      success: (res) => {
        if (res.confirm) {
          this.doDelete(id);
        }
      }
    });
  },

  async doDelete(id) {
    try {
      await adminAPI.deleteArticle(id);
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.refreshArticles();
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});
