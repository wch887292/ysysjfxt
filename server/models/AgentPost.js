// models/AgentPost.js - 代理商发布信息
module.exports = (sequelize, DataTypes) => {
  const AgentPost = sequelize.define('AgentPost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '代理商ID'
    },
    company_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '公司名称'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '标题'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '内容（支持markdown）'
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '图片URL列表'
    },
    status: {
      type: DataTypes.ENUM('pending_review', 'approved', 'rejected'),
      defaultValue: 'pending_review',
      comment: '审核状态'
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '审核人ID'
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '审核时间'
    },
    reject_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '驳回原因'
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '发布时间'
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '幂等键（防重复发布）'
    }
  }, {
    tableName: 'agent_posts',
    indexes: [
      { name: 'agent_posts_agent_id', fields: ['agent_id'] },
      { name: 'agent_posts_status', fields: ['status'] },
      { name: 'agent_posts_published_at', fields: ['published_at'] },
      { name: 'agent_posts_idempotency_key', fields: ['idempotency_key'], unique: true }
    ]
  });

  return AgentPost;
};
