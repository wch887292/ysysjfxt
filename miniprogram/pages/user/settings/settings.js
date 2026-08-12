// pages/user/settings/settings.js - 设置
const { userAPI } = require('../../../utils/api');

Page({
  data: {
    userInfo: {},
    nickName: '',
    phone: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      this.setData({
        userInfo,
        nickName: userInfo.nickName || ''
      });
    });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  saveSettings() {
    const { nickName, phone } = this.data;

    if (!nickName || nickName.trim().length === 0) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    const data = { nickName: nickName.trim() };
    if (phone) data.phone = phone;

    wx.showLoading({ title: '保存中...' });
    userAPI.updateInfo(data).then(() => {
      wx.hideLoading();
      // 同步本地缓存
      const app = getApp();
      const userInfo = { ...this.data.userInfo, nickName: nickName.trim() };
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);

      wx.showToast({ title: '保存成功', icon: 'success' });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除本地缓存吗？清除后需要重新登录。',
      confirmText: '确定清除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '已清除', icon: 'success' });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/user/home/home' });
          }, 1500);
        }
      }
    });
  }
});
