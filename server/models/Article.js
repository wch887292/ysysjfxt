// models/Article.js - 资讯/公告模型（总管理后台发布）
//
// 用于平台资讯、健康科普、活动公告等内容发布。
// admin 可发布/下架，C 端用户在首页/资讯页查看 status=published 的文章。
module.exports = (sequelize, DataTypes) => {
  const Article = sequelize.define('Article', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '标题'
    },
    summary: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '摘要（列表页展示）'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '正文（支持markdown）'
    },
    cover_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '封面图URL'
    },
    category: {
      type: DataTypes.ENUM('news', 'health_tips', 'activity', 'announcement', 'other'),
      defaultValue: 'news',
      comment: '分类：资讯/健康科普/活动/公告/其他'
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'offline'),
      defaultValue: 'draft',
      comment: '状态：草稿/已发布/已下架'
    },
    author_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '作者（admin user id）'
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '发布时间'
    },
    view_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '浏览次数'
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '排序权重（越大越靠前）'
    }
  }, {
    tableName: 'articles',
    indexes: [
      { name: 'articles_status', fields: ['status'] },
      { name: 'articles_category', fields: ['category'] },
      { name: 'articles_published_at', fields: ['published_at'] }
    ]
  });

  return Article;
};
