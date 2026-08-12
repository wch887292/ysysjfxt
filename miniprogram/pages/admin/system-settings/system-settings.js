// pages/admin/system-settings/system-settings.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    loading: false,
    categories: ['wechat', 'ai', 'content_security', 'oss', 'course', 'system'],
    categoryLabels: {
      wechat: '微信小程序配置',
      ai: 'AI 大模型配置',
      content_security: '内容安全配置',
      oss: 'OSS 存储配置',
      course: '学习课程配置',
      system: '系统安全配置'
    },
    currentCategory: 'wechat',
    settings: {},
    // 编辑状态
    editingKey: null,
    editingValue: '',
    editingLabel: '',
    editingSensitive: false,
    showEditModal: false,
    saving: false
  },

  onLoad() {
    // 客户端角色验证
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role;
    if (role !== 'admin') {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => { wx.switchTab({ url: '/pages/user/home/home' }); }
      });
      return;
    }
    app.onLoginReady((err) => {
      if (err) return;
      this.loadSettings();
    });
  },

  onShow() {
    const app = getApp();
    if (app.globalData.loginReady === 'ready') {
      this.loadSettings();
    }
  },

  async loadSettings() {
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getSystemSettings({ category: this.data.currentCategory });
      if (res.data && res.data.settings) {
        this.setData({ settings: res.data.settings });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 切换分类
  onCategoryChange(e) {
    const currentCategory = e.currentTarget.dataset.category;
    this.setData({ currentCategory }, () => {
      this.loadSettings();
    });
  },

  // 点击编辑配置项
  onEditItem(e) {
    const { key, label, sensitive, type } = e.currentTarget.dataset;
    this.setData({
      editingKey: key,
      editingLabel: label,
      editingSensitive: sensitive,
      editingType: type,
      editingValue: '',
      showEditModal: true
    });
  },

  // 输入新值
  onValueInput(e) {
    this.setData({ editingValue: e.detail.value });
  },

  // 取消编辑
  onCancelEdit() {
    this.setData({ showEditModal: false, editingKey: null, editingValue: '' });
  },

  // 确认保存
  async onConfirmSave() {
    const { editingKey, editingValue, editingLabel, editingSensitive } = this.data;

    if (!editingValue && editingValue !== 0) {
      wx.showToast({ title: '请输入新值', icon: 'none' });
      return;
    }

    // 二次确认
    const confirmContent = editingSensitive
      ? `确定要修改「${editingLabel}」吗？输入的新值将加密存储。\n\n此操作不可撤销，请确认无误。`
      : `确定要修改「${editingLabel}」为「${editingValue}」吗？`;

    wx.showModal({
      title: '确认修改',
      content: confirmContent,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ saving: true });
        try {
          await adminAPI.updateSystemSetting(editingKey, {
            value: editingValue,
            confirm: true
          });
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.setData({ showEditModal: false, editingKey: null, editingValue: '' });
          // 刷新当前分类数据
          this.loadSettings();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
        } finally {
          this.setData({ saving: false });
        }
      }
    });
  },

  // 清除配置（回退到环境变量）
  onClearItem(e) {
    const { key, label } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认清除',
      content: `确定要清除「${label}」的数据库配置吗？\n清除后将回退到环境变量。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await adminAPI.updateSystemSetting(key, { value: '', confirm: true });
          wx.showToast({ title: '已清除', icon: 'success' });
          this.loadSettings();
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  }
});
