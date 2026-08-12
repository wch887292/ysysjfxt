// pages/admin/config/config.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    configs: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showEditModal: false,
    editTarget: null,
    editValue: '',
    editDescription: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadConfigs();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshConfigs();
    }
  },

  onPullDownRefresh() {
    this.refreshConfigs();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadConfigs();
    }
  },

  refreshConfigs() {
    this.setData({ configs: [], page: 1, hasMore: true });
    this.loadConfigs();
  },

  async loadConfigs() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getConfig({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.configs) || [];
      this.setData({
        configs: this.data.configs.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 编辑配置
  onEditConfig(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditModal: true,
      editTarget: item.key,
      editValue: item.value,
      editDescription: item.description || ''
    });
  },

  onValueInput(e) {
    this.setData({ editValue: e.detail.value });
  },

  async onSaveConfig() {
    try {
      await adminAPI.updateConfig(this.data.editTarget, { value: this.data.editValue });
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ showEditModal: false });
      this.refreshConfigs();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onCancelEdit() {
    this.setData({ showEditModal: false });
  },

  // 重置配置（需二次确认）
  onResetConfig(e) {
    const key = e.currentTarget.dataset.key;
    wx.showModal({
      title: '确认重置',
      content: '确定要将该配置项恢复为默认值吗？',
      confirmColor: '#F44336',
      success: (res) => {
        if (res.confirm) {
          this.doResetConfig(key);
        }
      }
    });
  },

  async doResetConfig(key) {
    try {
      await adminAPI.resetConfig(key);
      wx.showToast({ title: '重置成功', icon: 'success' });
      this.refreshConfigs();
    } catch (err) {
      wx.showToast({ title: '重置失败', icon: 'none' });
    }
  }
});
