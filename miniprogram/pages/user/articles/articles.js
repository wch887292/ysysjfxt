// pages/user/articles/articles.js
const { articleAPI, resolveImageUrl } = require('../../../utils/api');

const CATEGORY_MAP = {
  news: '资讯',
  health_tips: '健康科普',
  activity: '活动',
  announcement: '公告',
  other: '其他'
};

Page({
  data: {
    articles: [],
    loading: false,
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    currentCategory: '',
    categoryLabels: CATEGORY_MAP,
    categories: ['', 'news', 'health_tips', 'activity', 'announcement'],
    defaultCover: resolveImageUrl('/static/images/articles/default-cover.jpg')
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady((err) => {
      if (err) return;
      this.loadArticles();
    });
  },

  onShow() {
    const app = getApp();
    if (app.globalData.loginReady === 'ready') {
      this.loadArticles();
    }
  },

  async loadArticles(append = false) {
    if (this.data.loading) return;
    if (append && !this.data.hasMore) return;

    const page = append ? this.data.page + 1 : 1;
    this.setData({ loading: true });

    try {
      const params = { page, pageSize: this.data.pageSize };
      if (this.data.currentCategory) {
        params.category = this.data.currentCategory;
      }

      const res = await articleAPI.getList(params);
      const data = res.data || {};
      const list = (data.articles || []).map(a => ({
        ...a,
        cover_image: resolveImageUrl(a.cover_image || a.coverImage),
        categoryLabel: CATEGORY_MAP[a.category] || a.category,
        publishedAt: (a.published_at || a.publishedAt || '').substring(0, 10)
      }));

      this.setData({
        articles: append ? [...this.data.articles, ...list] : list,
        page,
        total: data.total || 0,
        hasMore: list.length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      console.error('加载资讯失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onCategoryChange(e) {
    const currentCategory = e.currentTarget.dataset.category;
    this.setData({ currentCategory, articles: [], hasMore: true }, () => {
      this.loadArticles();
    });
  },

  onArticleTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/user/articles/detail?id=${id}`,
      fail: (err) => {
        console.error('跳转资讯详情失败:', err);
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  onImageError(e) {
    const id = e.currentTarget.dataset.id;
    const articles = this.data.articles.map(a => {
      if (a.id === id) a.cover_image = this.data.defaultCover;
      return a;
    });
    this.setData({ articles });
  },

  onReachBottom() {
    this.loadArticles(true);
  },

  onPullDownRefresh() {
    this.setData({ articles: [], hasMore: true });
    this.loadArticles().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
