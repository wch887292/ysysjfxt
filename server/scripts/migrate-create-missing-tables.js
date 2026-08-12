// scripts/migrate-create-missing-tables.js
// 用途：创建因外键类型不兼容而创建失败的表（report_feedbacks/articles/commissions）
// 运行：node scripts/migrate-create-missing-tables.js
//
// 问题：数据库 users.id / reports.id 是 varchar(36)，但 Sequelize 模型用 CHAR(36) BINARY，
// 外键约束要求类型完全一致，导致 CREATE TABLE 失败。
// 方案：直接用 SQL 创建表，外键列使用 varchar(36) 与被引用列一致。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

const DDL_STATEMENTS = [
  // report_feedbacks：报告反馈表
  `CREATE TABLE IF NOT EXISTS \`report_feedbacks\` (
    \`id\` varchar(36) NOT NULL,
    \`report_id\` varchar(36) NOT NULL COMMENT '关联的报告ID',
    \`user_id\` varchar(36) NOT NULL COMMENT '提交反馈的用户ID',
    \`feedback_type\` ENUM('like', 'dislike', 'issue') NOT NULL COMMENT '反馈类型：点赞/踩/问题报告',
    \`issue_category\` ENUM('medical_redline', 'inaccurate', 'not_personalized', 'unclear', 'other') DEFAULT NULL COMMENT '问题分类',
    \`content\` VARCHAR(500) DEFAULT NULL COMMENT '反馈内容（问题描述）',
    \`handled\` TINYINT(1) DEFAULT 0 COMMENT '是否已被后台处理',
    \`created_at\` DATETIME NOT NULL,
    \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`report_feedbacks_report_id\` (\`report_id\`),
    KEY \`report_feedbacks_user_id\` (\`user_id\`),
    CONSTRAINT \`report_feedbacks_ibfk_1\` FOREIGN KEY (\`report_id\`) REFERENCES \`reports\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`report_feedbacks_ibfk_2\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // articles：资讯表
  `CREATE TABLE IF NOT EXISTS \`articles\` (
    \`id\` varchar(36) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL COMMENT '标题',
    \`content\` TEXT NOT NULL COMMENT '正文内容',
    \`summary\` VARCHAR(500) DEFAULT NULL COMMENT '摘要',
    \`cover_image\` VARCHAR(500) DEFAULT NULL COMMENT '封面图URL',
    \`category\` ENUM('news', 'health_tips', 'activity', 'announcement', 'other') DEFAULT 'other' COMMENT '分类',
    \`sort_order\` INT DEFAULT 0 COMMENT '排序权重',
    \`status\` ENUM('draft', 'published', 'offline') DEFAULT 'draft' COMMENT '状态',
    \`author_id\` varchar(36) DEFAULT NULL COMMENT '作者（管理员）ID',
    \`published_at\` DATETIME DEFAULT NULL COMMENT '发布时间',
    \`created_at\` DATETIME NOT NULL,
    \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`articles_status\` (\`status\`),
    KEY \`articles_category\` (\`category\`),
    KEY \`articles_author_id\` (\`author_id\`),
    CONSTRAINT \`articles_ibfk_1\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // commissions：分润记录表
  `CREATE TABLE IF NOT EXISTS \`commissions\` (
    \`id\` varchar(36) NOT NULL,
    \`agent_id\` varchar(36) NOT NULL COMMENT '代理商ID',
    \`user_id\` varchar(36) DEFAULT NULL COMMENT '关联用户ID',
    \`source\` ENUM('gift_exchange', 'write_off', 'member_service', 'other') NOT NULL COMMENT '分润来源',
    \`amount\` DECIMAL(10,2) NOT NULL COMMENT '分润金额',
    \`status\` ENUM('pending', 'settled', 'cancelled') DEFAULT 'pending' COMMENT '结算状态',
    \`period\` VARCHAR(7) NOT NULL COMMENT '结算周期 YYYY-MM',
    \`remark\` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    \`settled_at\` DATETIME DEFAULT NULL COMMENT '结算时间',
    \`created_at\` DATETIME NOT NULL,
    \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`commissions_agent_id\` (\`agent_id\`),
    KEY \`commissions_status\` (\`status\`),
    KEY \`commissions_period\` (\`period\`),
    CONSTRAINT \`commissions_ibfk_1\` FOREIGN KEY (\`agent_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 创建缺失的表 ==========\n');

  for (const ddl of DDL_STATEMENTS) {
    const match = ddl.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/);
    const tableName = match ? match[1] : 'unknown';
    try {
      await db.sequelize.query(ddl);
      console.log(`  ✅ 表 ${tableName} 创建成功（或已存在）`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ✓ 表 ${tableName} 已存在`);
      } else {
        console.error(`  ❌ 表 ${tableName} 创建失败: ${err.message}`);
      }
    }
  }

  console.log('\n========== 完成 ==========');
  console.log('现在可以启动后端服务：node app.js');
  process.exit(0);
}

main().catch((err) => {
  logger.error('创建表失败:', err);
  console.error('失败:', err.message);
  process.exit(1);
});
