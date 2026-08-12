// models/ReportFeedback.js - 报告用户反馈（AI 第5层闭环）
//
// 方案5.1 第5层【优化】：人工审核 + 用户反馈 + Prompt 迭代
// 本表存储用户对生成报告的反馈，供后台复核参考，驱动 Prompt 迭代。
module.exports = (sequelize, DataTypes) => {
  const ReportFeedback = sequelize.define('ReportFeedback', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    report_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '关联的报告ID'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '提交反馈的用户ID'
    },
    feedback_type: {
      type: DataTypes.ENUM('like', 'dislike', 'issue'),
      allowNull: false,
      comment: '反馈类型：点赞/踩/问题报告'
    },
    issue_category: {
      type: DataTypes.ENUM('medical_redline', 'inaccurate', 'not_personalized', 'unclear', 'other'),
      allowNull: true,
      comment: '问题分类：医疗越界/数据不准确/不够个性化/表述不清/其他'
    },
    content: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '反馈内容（问题描述）'
    },
    // 便于后台筛选和统计
    handled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否已被后台处理'
    }
  }, {
    tableName: 'report_feedbacks',
    indexes: [
      // 一个用户对一份报告只能提交一次反馈（防止刷反馈）
      { name: 'report_feedbacks_report_id_user_id', fields: ['report_id', 'user_id'], unique: true },
      { name: 'report_feedbacks_feedback_type', fields: ['feedback_type'] },
      { name: 'report_feedbacks_handled', fields: ['handled'] }
    ]
  });

  return ReportFeedback;
};
