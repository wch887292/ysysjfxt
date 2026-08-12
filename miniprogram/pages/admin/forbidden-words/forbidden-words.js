// pages/admin/forbidden-words/forbidden-words.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    words: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showAddModal: false,
    showEditModal: false,
    newWord: { pattern: '', message: '', category: 'general', note: '' },
    editTarget: null,
    editPattern: '',
    editMessage: '',
    editCategory: '',
    editNote: '',
    editStatus: 'active'
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadWords();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshWords();
    }
  },

  onPullDownRefresh() {
    this.refreshWords();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadWords();
    }
  },

  refreshWords() {
    this.setData({ words: [], page: 1, hasMore: true });
    this.loadWords();
  },

  async loadWords() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getForbiddenWords({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.words) || [];
      this.setData({
        words: this.data.words.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 添加违禁词
  onShowAdd() {
    this.setData({ showAddModal: true, newWord: { pattern: '', message: '', category: 'general', note: '' } });
  },

  onNewWordInput(e) {
    this.setData({ 'newWord.pattern': e.detail.value });
  },

  onNewMessageInput(e) {
    this.setData({ 'newWord.message': e.detail.value });
  },

  onNewCategoryChange(e) {
    this.setData({ 'newWord.category': e.detail.value });
  },

  onNewNoteInput(e) {
    this.setData({ 'newWord.note': e.detail.value });
  },

  async onAddWord() {
    const { pattern, message, category, note } = this.data.newWord;
    if (!pattern) {
      wx.showToast({ title: '请输入正则表达式', icon: 'none' });
      return;
    }
    try {
      const idempotencyKey = 'FW_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.createForbiddenWord({ pattern, message, category, note, idempotencyKey });
      wx.showToast({ title: '添加成功', icon: 'success' });
      this.setData({ showAddModal: false });
      this.refreshWords();
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  onCancelAdd() {
    this.setData({ showAddModal: false });
  },

  // 编辑违禁词
  onEditWord(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditModal: true,
      editTarget: item.id,
      editPattern: item.pattern,
      editMessage: item.message || '',
      editCategory: item.category,
      editNote: item.note || '',
      editStatus: item.status || 'active'
    });
  },

  onEditWordInput(e) {
    this.setData({ editPattern: e.detail.value });
  },

  onEditMessageInput(e) {
    this.setData({ editMessage: e.detail.value });
  },

  onEditCategoryChange(e) {
    this.setData({ editCategory: e.detail.value });
  },

  onEditNoteInput(e) {
    this.setData({ editNote: e.detail.value });
  },

  onEditStatusChange(e) {
    this.setData({ editStatus: e.detail.value });
  },

  async onConfirmEdit() {
    try {
      await adminAPI.updateForbiddenWord(this.data.editTarget, {
        pattern: this.data.editPattern,
        message: this.data.editMessage,
        category: this.data.editCategory,
        note: this.data.editNote,
        status: this.data.editStatus
      });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ showEditModal: false });
      this.refreshWords();
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  onCancelEdit() {
    this.setData({ showEditModal: false });
  },

  // 删除违禁词（需二次确认）
  onDeleteWord(e) {
    const id = e.currentTarget.dataset.id;
    const word = e.currentTarget.dataset.word;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除该规则吗？`,
      confirmColor: '#F44336',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteWord(id);
        }
      }
    });
  },

  async doDeleteWord(id) {
    try {
      await adminAPI.deleteForbiddenWord(id);
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.refreshWords();
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});
