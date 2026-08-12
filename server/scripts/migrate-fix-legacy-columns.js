// scripts/migrate-fix-legacy-columns.js
// 用途：修复历史遗留列问题（如 wechat_openid NOT NULL 无默认值导致插入失败）
// 运行：node scripts/migrate-fix-legacy-columns.js
//
// 背景：数据库 users 表存在旧的 wechat_openid 列（NOT NULL 无默认值），
// 但模型已改用 openid 列。当插入新记录时不填 wechat_openid 会报错。
// 此脚本将 wechat_openid 改为允许 NULL，并设置默认值，避免阻塞插入。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 修复历史遗留列 ==========\n');

  const queryInterface = db.sequelize.getQueryInterface();

  // 检查 users 表是否存在 wechat_openid 列
  const usersDesc = await queryInterface.describeTable('users');

  if (usersDesc.wechat_openid) {
    console.log(`  [users.wechat_openid] 当前: ${usersDesc.wechat_openid.type}, nullable: ${usersDesc.wechat_openid.allowNull}`);
    console.log(`  → 修改为允许 NULL，避免插入新记录时报错`);
    try {
      // 修改为允许 NULL，保留原有数据
      await db.sequelize.query(
        "ALTER TABLE `users` MODIFY COLUMN `wechat_openid` VARCHAR(64) NULL DEFAULT NULL"
      );
      console.log(`  ✅ [users.wechat_openid] 已修改为 VARCHAR(64) NULL DEFAULT NULL`);
    } catch (err) {
      console.error(`  ❌ [users.wechat_openid] 修改失败: ${err.message}`);
    }
  } else {
    console.log(`  ✓ [users.wechat_openid] 列不存在，无需修复`);
  }

  // 检查其他可能有 NOT NULL 无默认值的历史列
  const notNullNoDefaultCols = [];
  for (const [colName, colDef] of Object.entries(usersDesc)) {
    if (colDef.allowNull === false && colDef.defaultValue === null && colDef.defaultValue === undefined) {
      // 排除主键和有自动生成的字段
      if (!['id', 'created_at', 'updated_at', 'openid'].includes(colName)) {
        notNullNoDefaultCols.push(colName);
      }
    }
  }

  if (notNullNoDefaultCols.length > 0) {
    console.log(`\n  发现其他 NOT NULL 无默认值的列: ${notNullNoDefaultCols.join(', ')}`);
    console.log(`  → 逐个修改为允许 NULL`);
    for (const colName of notNullNoDefaultCols) {
      const colDef = usersDesc[colName];
      const typeMatch = colDef.type.match(/^(\w+)(\((\d+)\))?/);
      const baseType = typeMatch ? typeMatch[1] : 'VARCHAR';
      const length = typeMatch && typeMatch[3] ? typeMatch[3] : 255;
      const fullType = `${baseType}(${length})`;
      try {
        await db.sequelize.query(
          `ALTER TABLE \`users\` MODIFY COLUMN \`${colName}\` ${fullType} NULL DEFAULT NULL`
        );
        console.log(`  ✅ [users.${colName}] 已修改为 ${fullType} NULL DEFAULT NULL`);
      } catch (err) {
        console.error(`  ❌ [users.${colName}] 修改失败: ${err.message}`);
      }
    }
  }

  console.log(`\n========== 修复完成 ==========`);
  console.log('现在可以重新运行 node scripts/init-web-admin.js 初始化管理员账号。');
  process.exit(0);
}

main().catch((err) => {
  logger.error('修复失败:', err);
  console.error('修复失败:', err.message);
  process.exit(1);
});
