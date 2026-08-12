// scripts/migrate-fix-column-types.js
// 用途：修复列类型不匹配问题（仅扩展长度/类型，不收缩，避免数据截断）
// 运行：node scripts/migrate-fix-column-types.js
//
// 背景：User.phone 模型定义为 STRING(500)（存储 AES 加密后的手机号），
// 但数据库中仍是旧的 VARCHAR(20)（明文长度），导致 "Data too long" 错误。
// 此脚本检测模型与数据库的列类型差异，仅执行扩展操作（如 VARCHAR(20) → VARCHAR(500)）。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

// 显式声明的类型修复（表 -> 列 -> 目标类型）
// 仅列出已知需要扩展的列，避免误改其他列
const FORCED_FIXES = [
  { table: 'users', column: 'phone', sqlType: 'VARCHAR(500)', comment: 'AES加密存储的手机号' },
  { table: 'users', column: 'phone_masked', sqlType: 'VARCHAR(20)', comment: '脱敏显示的手机号' },
  { table: 'users', column: 'password', sqlType: 'VARCHAR(100)', comment: 'Web后台登录密码（bcrypt hash）' }
];

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 列类型修复迁移 ==========');
  console.log('（仅扩展类型，不收缩，避免数据截断）\n');

  const queryInterface = db.sequelize.getQueryInterface();
  let fixed = 0;

  for (const fix of FORCED_FIXES) {
    const { table, column, sqlType, comment } = fix;

    // 检查表是否存在
    let tableDesc;
    try {
      tableDesc = await queryInterface.describeTable(table);
    } catch (err) {
      console.log(`  ⚠️ [${table}] 表不存在，跳过`);
      continue;
    }

    if (!tableDesc[column]) {
      console.log(`  ⚠️ [${table}.${column}] 列不存在，跳过（请先运行 migrate-sync-columns.js）`);
      continue;
    }

    const currentType = tableDesc[column].type;
    console.log(`  [${table}.${column}] 当前类型: ${currentType}`);

    // 解析当前类型的长度（如 varchar(20) → 20）
    const currentLenMatch = currentType.match(/(\d+)/);
    const targetLenMatch = sqlType.match(/(\d+)/);

    if (currentLenMatch && targetLenMatch) {
      const currentLen = parseInt(currentLenMatch[1]);
      const targetLen = parseInt(targetLenMatch[1]);
      if (currentLen >= targetLen) {
        console.log(`  ✓ [${table}.${column}] 当前长度 ${currentLen} >= 目标 ${targetLen}，无需修改`);
        continue;
      }
    }

    // 执行 ALTER 修改列类型
    const alterSql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${sqlType} NULL COMMENT '${comment}'`;
    try {
      await db.sequelize.query(alterSql);
      console.log(`  ✅ [${table}.${column}] 已修改为 ${sqlType}`);
      fixed++;
    } catch (err) {
      console.error(`  ❌ [${table}.${column}] 修改失败: ${err.message}`);
    }
  }

  console.log(`\n========== 修复完成 ==========`);
  console.log(`共修复 ${fixed} 个列类型。`);
  if (fixed > 0) {
    console.log('\n现在可以重新运行 node scripts/init-web-admin.js 初始化管理员账号。');
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error('列类型修复失败:', err);
  console.error('修复失败:', err.message);
  process.exit(1);
});
