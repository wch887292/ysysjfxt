// models/PromptVersion.js - Prompt 版本管理（AI 第5层闭环）
//
// 方案5.1 第5层【优化】：人工审核 + 用户反馈 + Prompt 迭代
// 本表存储 System Prompt 的版本历史，支持激活/回滚/A-B测试，驱动持续优化。
//
// prompt_key 约定（与 reportGenerator.js 内的 buildXxxPrompt 对应）：
//   - crisis_hook_system   危机钩子报告的 System Prompt
//   - crisis_hook_user     危机钩子报告的 User Prompt 模板
//   - 7day_plan_system     7天调理方案的 System Prompt
//   - 7day_plan_user       7天调理方案的 User Prompt 模板
module.exports = (sequelize, DataTypes) => {
  const PromptVersion = sequelize.define('PromptVersion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    prompt_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Prompt 键，如 crisis_hook_system'
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '版本号（同一 prompt_key 下递增）'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Prompt 内容'
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'archived', 'ab_testing'),
      allowNull: false,
      defaultValue: 'draft',
      comment: '状态：草稿/激活/归档/A-B测试中'
    },
    change_log: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '本次迭代变更说明'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '创建人（admin user id）'
    },
    activated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '激活人（admin user id）'
    },
    activated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '激活时间'
    },
    // 简化的效果统计（定期由后台任务刷新，便于横向对比）
    stats: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '效果统计 { generations, flagged_count, avg_feedback_score }'
    }
  }, {
    tableName: 'prompt_versions',
    indexes: [
      { name: 'prompt_versions_prompt_key', fields: ['prompt_key'] },
      { name: 'prompt_versions_status', fields: ['status'] },
      // 同一 prompt_key 同时只能有一个 active 版本（应用层保证，DB 兜底）
      { name: 'prompt_versions_prompt_key_status', fields: ['prompt_key', 'status'] }
    ]
  });

  return PromptVersion;
};
