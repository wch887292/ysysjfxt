// pages/user/referral/referral.js - 我的推荐
const { authAPI } = require('../../../utils/api');
const app = getApp();

Page({
  data: {
    stats: { total: 0, completed: 0, rewardPoints: 0 },
    referrals: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    qrContent: '',
    userId: '',
    loading: false
  },

  onLoad() {
    app.onLoginReady(() => {
      this.loadStats();
      this.loadShareCode();
      this.loadReferrals();
    });
  },

  onShow() {
    if (app.globalData.loginReady === 'ready') {
      this.loadStats();
      this.loadReferrals();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, referrals: [], hasMore: true });
    this.loadStats();
    this.loadShareCode();
    this.loadReferrals(() => wx.stopPullDownRefresh());
  },

  loadStats() {
    authAPI.getMyReferralStats().then(res => {
      const d = res.data || {};
      this.setData({
        stats: {
          total: d.total || 0,
          completed: d.completed || 0,
          rewardPoints: d.rewardPoints || 0
        }
      });
    }).catch(() => {});
  },

  loadShareCode() {
    authAPI.getMyShareCode().then(res => {
      const d = res.data || {};
      this.setData({
        userId: d.userId || '',
        qrContent: d.qrContent || ''
      });
    }).catch(() => {});
  },

  loadReferrals(cb) {
    if (this.data.loading) {
      if (typeof cb === 'function') cb();
      return;
    }
    this.setData({ loading: true });

    authAPI.getMyReferrals({ page: this.data.page, pageSize: this.data.pageSize }).then(res => {
      const d = res.data || {};
      const list = (d.referrals || []).map(r => ({
        id: r.id,
        nickName: r.nickName || '匿名用户',
        questionnaireCompleted: !!r.questionnaireCompleted,
        createdAt: r.createdAt
      }));
      this.setData({
        referrals: this.data.referrals.concat(list),
        hasMore: !!d.hasMore,
        loading: false
      });
      if (typeof cb === 'function') cb();
    }).catch(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadReferrals();
    }
  },

  copyShareLink() {
    if (!this.data.qrContent) {
      wx.showToast({ title: '分享链接生成中', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.qrContent,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    const userId = this.data.userId;
    const path = userId
      ? `/pages/user/home/home?referrerId=${userId}`
      : '/pages/user/home/home';
    return {
      title: '健康饮食积分 - 一起记录每一餐，积累健康财富',
      path
    };
  }
});
