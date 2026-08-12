// pages/agent/convert-member/convert-member.js - 会员转化
const { agentAPI, resolveImageUrl } = require('../../../utils/api');

Page({
  data: {
    userId: '',
    userInfo: null,
    loading: true,
    converting: false,
    converted: false,
    defaultAvatar: resolveImageUrl('/static/images/default-avatar.jpg')
  },

  onLoad(options) {
    const userId = options.userId || '';
    if (!userId) {
      wx.showToast({ title: '缺少用户参数', icon: 'none' });
      return;
    }
    this.setData({ userId });
    const app = getApp();
    app.onLoginReady(() => {
      this.loadUserInfo();
    });
  },

  onShow() {
    if (this.data.userId && getApp().globalData.loginReady === 'ready') {
      this.loadUserInfo();
    }
  },

  loadUserInfo() {
    this.setData({ loading: true });
    agentAPI.getUsers({ userId: this.data.userId }).then(res => {
      const user = res.data.user || res.data || null;
      // 处理头像路径
      if (user) {
        user.avatar_url = resolveImageUrl(user.avatar_url);
      }
      this.setData({ userInfo: user, loading: false });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载用户信息失败', icon: 'none' });
    });
  },

  handleConvert() {
    if (this.data.converting) return;
    if (this.data.converted) {
      wx.showToast({ title: '该用户已转化为会员', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认转化',
      content: '确定要将该用户转化为会员吗？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          this.doConvert();
        }
      }
    });
  },

  doConvert() {
    this.setData({ converting: true });
    agentAPI.convertToMember(this.data.userId, {}).then(() => {
      this.setData({ converting: false, converted: true });
      wx.showToast({ title: '转化成功', icon: 'success' });
    }).catch(() => {
      this.setData({ converting: false });
      wx.showToast({ title: '转化失败，请重试', icon: 'none' });
    });
  }
});
