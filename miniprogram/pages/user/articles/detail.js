// pages/user/articles/detail.js
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
    article: null,
    loading: true,
    defaultCover: resolveImageUrl('/static/images/articles/default-cover.jpg')
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.articleId = id;
    const app = getApp();
    app.onLoginReady((err) => {
      if (err) return;
      this.loadDetail();
    });
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res = await articleAPI.getDetail(this.articleId);
      const article = res.data && res.data.article;
      if (!article) {
        wx.showToast({ title: '资讯不存在', icon: 'none' });
        return;
      }
      article.cover_image = resolveImageUrl(article.cover_image || article.coverImage);
      article.categoryLabel = CATEGORY_MAP[article.category] || article.category;
      article.publishedAt = (article.published_at || article.publishedAt || '').substring(0, 10);

      // 简易 Markdown 转 WXML（支持标题、段落、加粗、列表）
      article.contentHtml = this._simpleMarkdown(article.content || '');

      this.setData({ article, loading: false });
    } catch (err) {
      console.error('加载资讯详情失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 简易 Markdown 转 HTML（用于 rich-text 组件渲染）
   * 支持：## 标题、**加粗**、- 列表、段落换行
   */
  _simpleMarkdown(md) {
    if (!md) return '';
    let html = md
      // 标题
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 加粗
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 无序列表
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      // 段落换行
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    // 包裹 <li> 为 <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    // 去除连续 <ul> 标签
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return '<p>' + html + '</p>';
  },

  onShareAppMessage() {
    const article = this.data.article;
    if (!article) return {};
    return {
      title: article.title,
      path: `/pages/user/articles/detail?id=${this.articleId}`
    };
  },

  onImageError() {
    const article = this.data.article;
    if (article) {
      article.cover_image = this.data.defaultCover;
      this.setData({ article });
    }
  }
});
