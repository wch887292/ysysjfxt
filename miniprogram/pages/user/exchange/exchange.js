// pages/user/exchange/exchange.js
const { giftAPI, userAPI, resolveImageUrl, getDefaultGiftImage } = require('../../../utils/api');

Page({
  data: {
    points: 0,
    gifts: [],
    filteredGifts: [],
    currentCategory: 'all',
    loading: false,
    exchanging: false,  // 防双击锁
    defaultGiftImage: ''
  },

  onLoad() {
    this._alive = true;
    const app = getApp();
    this.setData({
      defaultGiftImage: getDefaultGiftImage()
    });

    app.onLoginReady(() => {
      if (!this._alive) return;
      this.loadPoints();
      this.loadGifts();
    });
  },

  onShow() {
    if (!this._alive) return;
    if (getApp().globalData.loginReady === 'ready') {
      this.loadPoints();
    }
  },

  onUnload() {
    this._alive = false;
  },

  onPullDownRefresh() {
    if (!this._alive) return;
    Promise.all([this.loadPoints(), this.loadGifts()]).finally(() => {
      if (this._alive) wx.stopPullDownRefresh();
    });
  },

  async loadPoints() {
    if (!this._alive) return;
    try {
      const res = await userAPI.getPoints();
      if (!this._alive) return;
      this.setData({ points: (res.data && res.data.points) || 0 });
      this.applyFilter();
    } catch (err) {
      // request.js 已弹错误提示
    }
  },

  async loadGifts() {
    if (!this._alive) return;
    this.setData({ loading: true });
    try {
      const res = await giftAPI.getList();
      if (!this._alive) return;
      const gifts = (res.data && res.data.gifts || []).map(g => ({
        ...g,
        image: resolveImageUrl(g.image)
      }));
      this.setData({ gifts }, () => this.applyFilter());
    } catch (err) {
      // request.js 已弹错误提示
    } finally {
      if (this._alive) this.setData({ loading: false });
    }
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCategory: cat }, () => this.applyFilter());
  },

  applyFilter() {
    const { gifts, currentCategory } = this.data;
    const filtered = currentCategory === 'all'
      ? gifts
      : gifts.filter(g => g.category === currentCategory);
    this.setData({ filteredGifts: filtered });
  },

  navigateToHistory() {
    wx.navigateTo({ url: '/pages/user/exchange/history' });
  },

  onImageError(e) {
    // 图片加载失败时切换到默认图
    const id = e.currentTarget.dataset.id;
    const defaultUrl = this.data.defaultGiftImage;
    const gifts = this.data.gifts.map(g => {
      if (g.id === id) g.image = defaultUrl;
      return g;
    });
    this.setData({ gifts }, () => this.applyFilter());
  },

  exchangeGift(e) {
    const giftId = e.currentTarget.dataset.id;
    const gift = this.data.gifts.find(g => g.id === giftId);

    if (!gift) return;

    // 防双击锁：兑换进行中时直接忽略后续点击
    if (this.data.exchanging) return;

    if (this.data.points < gift.points) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }

    if (gift.stock === 0) {
      wx.showToast({ title: '礼品已兑完', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: '确定要兑换 ' + gift.name + ' 吗？消耗 ' + gift.points + ' 积分',
      confirmText: '确认兑换',
      success: (res) => {
        if (res.confirm) {
          this.doExchange(giftId);
        }
      }
    });
  },

  doExchange(giftId) {
    // 防双击锁
    this.setData({ exchanging: true });

    wx.showLoading({ title: '兑换中...', mask: true });

    // 使用统一 API 工具：giftAPI.exchange 会自动生成稳定幂等键（5分钟时间窗口）
    // 即使双击或网络重试，后端也会按幂等键返回首次结果，避免双扣/超卖
    giftAPI.exchange(giftId).then((res) => {
      if (res.success) {
        const ex = res.data.exchange;
        if (res.data.duplicated) {
          // 幂等返回：同一幂等键已兑换过，提示用户不要重复操作
          wx.showToast({ title: '该礼品已兑换过', icon: 'none' });
        } else {
          wx.showModal({
            title: '兑换成功',
            content: '核销码：' + ex.writeOffCode + '\n请到指定地点核销使用',
            showCancel: false,
            confirmText: '我知道了'
          });
        }
        this.loadPoints();
        this.loadGifts();
      } else {
        wx.showToast({
          title: res.message || '兑换失败',
          icon: 'none'
        });
      }
    }).catch((err) => {
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
      this.setData({ exchanging: false });
    });
  }
});
