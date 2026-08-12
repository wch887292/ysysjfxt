// pages/user/exchange/history.js
const { giftAPI, resolveImageUrl, getDefaultGiftImage } = require('../../../utils/api');

Page({
  data: {
    history: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    defaultGiftImage: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({ defaultGiftImage: getDefaultGiftImage() });
    app.onLoginReady(() => this.loadHistory());
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.setData({ page: 1, history: [], hasMore: true });
      this.loadHistory();
    }
  },

  onPullDownRefresh() {
    this.setData({
      history: [],
      page: 1,
      hasMore: true
    }, () => {
      this.loadHistory().finally(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  loadHistory() {
    if (this.data.loading) return Promise.resolve();

    this.setData({ loading: true });

    return giftAPI.getExchangeHistory({
      page: this.data.page,
      pageSize: this.data.pageSize
    }).then((res) => {
      const data = (res && res.data) || {};
      const list = (data.exchanges || []).map((item) => {
        const rawImage = (item.gift && item.gift.image) || '';
        return {
          ...item,
          statusName: this.getStatusName(item.status),
          statusColor: this.getStatusColor(item.status),
          image: resolveImageUrl(rawImage)
        };
      });
      const history = this.data.history.concat(list);
      this.setData({
        history,
        hasMore: !!data.hasMore
      });
    }).catch(() => {
      // request.js 已统一提示错误
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({
      page: this.data.page + 1
    }, () => {
      this.loadHistory();
    });
  },

  getStatusName(status) {
    const map = {
      pending: '待核销',
      completed: '已核销',
      cancelled: '已取消',
      refunded: '已退款'
    };
    return map[status] || '未知';
  },

  getStatusColor(status) {
    const map = {
      pending: '#FF9800',
      completed: '#4CAF50',
      cancelled: '#999',
      refunded: '#F44336'
    };
    return map[status] || '#999';
  },

  goExchange() {
    wx.navigateTo({
      url: '/pages/user/exchange/exchange',
      fail: () => wx.switchTab({ url: '/pages/user/exchange/exchange' })
    });
  },

  copyWriteOffCode(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '核销码已复制', icon: 'success' });
      }
    });
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const history = this.data.history.slice();
    if (history[index]) {
      history[index] = { ...history[index], image: getDefaultGiftImage() };
      this.setData({ history });
    }
  }
});
