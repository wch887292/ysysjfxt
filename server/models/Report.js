// models/Report.js - 健康报告（危机钩子报告 + 7天调理方案）
module.exports = (sequelize, DataTypes) => {
  const Report = sequelize.define('Report', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '用户ID'
    },
    report_type: {
      type: DataTypes.ENUM('crisis_hook', '7day_plan'),
      allowNull: false,
      comment: '报告类型：危机钩子报告/7天调理方案'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '报告标题'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '报告内容'
    },
    risk_score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '风险评分'
    },
    risk_level: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true,
      comment: '风险等级'
    },
    visible_to_guest: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '是否对游客可见'
    },
    ai_model: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '使用的AI模型'
    },
    ai_params: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'AI调用参数'
    },
    generate_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '生成时间'
    },
    // AI 第5层闭环字段（从 ai_params.flagged 提取为独立列，便于索引查询）
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否命中医疗红线（第4层验证未通过）'
    },
    validation_errors: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '第4层验证命中的违规规则列表'
    },
    review_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'rewritten'),
      allowNull: true,
      defaultValue: null,
      comment: '后台复核状态：待复核/通过/拒绝/已重写（仅 flagged=true 时进入复核流程）'
    },
    review_remark: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '复核备注'
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '复核人（admin user id）'
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '复核时间'
    }
  }, {
    tableName: 'reports',
    indexes: [
      { name: 'reports_user_id', fields: ['user_id'] },
      { name: 'reports_report_type', fields: ['report_type'] },
      { name: 'reports_generate_date', fields: ['generate_date'] },
      { name: 'reports_visible_to_guest', fields: ['visible_to_guest'] },
      // AI 第5层闭环：后台常按 flagged + review_status 筛选待复核报告
      { name: 'reports_flagged', fields: ['flagged'] },
      { name: 'reports_review_status', fields: ['review_status'] }
    ]
  });

  return Report;
};
