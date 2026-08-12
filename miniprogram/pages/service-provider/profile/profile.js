// pages/service-provider/profile/profile.js
const { serviceProviderAPI } = require('../../../utils/api');

const STATUS_MAP = {
  active: '正常',
  pending: '待审核',
  inactive: '已停用',
  rejected: '已驳回'
};

Page({
  data: {
    provider: null,
    loading: true,
    editing: false,
    formData: {
      name: '',
      phone: '',
      email: '',
      address: ''
    },
    submitting: false,
    statusMap: STATUS_MAP
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadProfile();
    });
  },

  // 登录已就绪时返回页面刷新，避免显示陈旧数据
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadProfile();
    }
  },

  loadProfile() {
    this.setData({ loading: true });
    serviceProviderAPI.getProfile()
      .then((res) => {
        const provider = (res.data && res.data.provider) || null;
        this.setData({
          provider: provider,
          formData: this._buildFormData(provider)
        });
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  _buildFormData(provider) {
    if (!provider) {
      return { name: '', phone: '', email: '', address: '' };
    }
    return {
      name: provider.name || '',
      phone: provider.phone || '',
      email: provider.email || '',
      address: provider.address || ''
    };
  },

  toggleEdit() {
    // 切换编辑模式，并从 provider 重置 formData
    this.setData({
      editing: !this.data.editing,
      formData: this._buildFormData(this.data.provider)
    });
  },

  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ 'formData.phone': e.detail.value });
  },

  onEmailInput(e) {
    this.setData({ 'formData.email': e.detail.value });
  },

  onAddressInput(e) {
    this.setData({ 'formData.address': e.detail.value });
  },

  validate() {
    const { name, phone, email, address } = this.data.formData;
    const nameTrim = (name || '').trim();
    if (!nameTrim) {
      wx.showToast({ title: '请输入网点名称', icon: 'none' });
      return false;
    }
    if (nameTrim.length < 2 || nameTrim.length > 100) {
      wx.showToast({ title: '网点名称2-100字', icon: 'none' });
      return false;
    }
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return false;
      }
    }
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        wx.showToast({ title: '请输入正确的邮箱', icon: 'none' });
        return false;
      }
    }
    if (address && address.length > 200) {
      wx.showToast({ title: '地址不超过200字', icon: 'none' });
      return false;
    }
    return true;
  },

  submitUpdate() {
    if (this.data.submitting) return;       // 防双击
    if (!this.validate()) return;

    wx.showModal({
      title: '确认更新',
      content: '确认更新网点信息？',
      confirmText: '确认更新',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return; // 用户取消
        this._doUpdate();
      }
    });
  },

  _doUpdate() {
    this.setData({ submitting: true });
    const payload = {
      name: this.data.formData.name.trim(),
      phone: this.data.formData.phone.trim(),
      email: this.data.formData.email.trim(),
      address: this.data.formData.address.trim()
    };

    serviceProviderAPI.updateProfile(payload)
      .then((res) => {
        const provider = (res.data && res.data.provider) || res.data || this.data.provider;
        this.setData({
          provider: provider,
          editing: false,
          formData: this._buildFormData(provider)
        });
        wx.showToast({ title: '更新成功', icon: 'success' });
      })
      .catch(() => {
        // request.js 已弹错误提示
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
