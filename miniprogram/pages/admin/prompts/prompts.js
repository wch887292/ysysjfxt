// pages/admin/prompts/prompts.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    prompts: [],
    page: 1,
    pageSize: 50,
    hasMore: true,
    loading: false,
    showCreateModal: false,
    showDetailModal: false,
    currentPrompt: null,
    newPrompt: { promptKey: 'crisis_hook_system', content: '', changeLog: '' }
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadPrompts();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshPrompts();
    }
  },

  onPullDownRefresh() {
    this.refreshPrompts();
    wx.stopPullDownRefresh();
  },

  refreshPrompts() {
    this.setData({ prompts: [], page: 1, hasMore: true });
    this.loadPrompts();
  },

  async loadPrompts() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getPrompts({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.prompts) || [];
      this.setData({
        prompts: this.data.prompts.concat(list),
        hasMore: list.length >= this.data.pageSize
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
      const prompt = this.data.prompts.find(p => p.id === id);
      this.setData({ showDetailModal: true, currentPrompt: prompt });
    } catch (err) {
      wx.showToast({ title: '获取详情失败', icon: 'none' });
    }
  },

  onCloseDetail() {
    this.setData({ showDetailModal: false, currentPrompt: null });
  },

  // 创建 Prompt
  onShowCreate() {
    this.setData({ showCreateModal: true, newPrompt: { promptKey: 'crisis_hook_system', content: '', changeLog: '' } });
  },

  onKeyChange(e) {
    this.setData({ 'newPrompt.promptKey': e.detail.value });
  },

  onContentInput(e) {
    this.setData({ 'newPrompt.content': e.detail.value });
  },

  onChangeLogInput(e) {
    this.setData({ 'newPrompt.changeLog': e.detail.value });
  },

  async onCreatePrompt() {
    const { promptKey, content, changeLog } = this.data.newPrompt;
    if (!content || content.length < 10) {
      wx.showToast({ title: '内容至少10字符', icon: 'none' });
      return;
    }
    try {
      await adminAPI.createPrompt({ promptKey, content, changeLog });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreateModal: false });
      this.refreshPrompts();
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  onCancelCreate() {
    this.setData({ showCreateModal: false });
  },

  // 激活 Prompt（需二次确认）
  onActivate(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认激活',
      content: '激活后将替换当前生效的同类型Prompt，确定要激活吗？',
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          this.doActivate(id);
        }
      }
    });
  },

  async doActivate(id) {
    try {
      wx.showLoading({ title: '激活中...' });
      await adminAPI.activatePrompt(id);
      wx.hideLoading();
      wx.showToast({ title: '激活成功', icon: 'success' });
      this.refreshPrompts();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '激活失败', icon: 'none' });
    }
  },

  statusText(status) {
    const map = { draft: '草稿', active: '已激活', archived: '已归档' };
    return map[status] || status;
  }
});
