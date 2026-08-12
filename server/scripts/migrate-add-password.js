// scripts/migrate-add-password.js
// 用途：为 users 表添加 password 列（Web后台登录密码，bcrypt hash）
// 运行：node scripts/migrate-add-password.js
//
// 说明：User 模型已新增 password 字段，但现有数据库未自动同步。
// 此脚本幂等：若列已存在则跳过，不存在则 ALTER TABLE 添加。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 迁移：users 表添加 password 列 ==========\n');

  const queryInterface = db.sequelize.getQueryInterface();

  // 检查列是否已存在
  const tableDesc = await queryInterface.describeTable('users');
  if (tableDesc.password) {
    console.log('✅ 列 password 已存在，无需迁移。');
    console.log(`   类型: ${tableDesc.password.type}，可空: ${tableDesc.password.allowNull}`);
    process.exit(0);
  }

  // 添加 password 列
  console.log('正在添加 password 列...');
  await queryInterface.addColumn('users', 'password', {
    type: db.Sequelize.STRING(100),
    allowNull: true,
    comment: 'Web后台登录密码（bcrypt hash，仅 admin/agent/service_provider 角色使用）'
  });

  console.log('✅ 迁移完成：users.password 列已添加。');
  console.log('   现在可以运行 node scripts/init-web-admin.js 初始化管理员账号。');
  process.exit(0);
}

main().catch((err) => {
  logger.error('迁移失败:', err);
  console.error('迁移失败:', err.message);
  process.exit(1);
});
