// scripts/migrate-fix-timestamps.js
// 用途：修复 createdAt/updatedAt 列问题
// 运行：node scripts/migrate-fix-timestamps.js
//
// 背景：migrate-sync-columns.js 误添加了驼峰命名的 createdAt/updatedAt 列，
// 但数据库原有的是蛇形 created_at/updated_at。Sequelize 模型默认 underscored:false，
// 会写入 createdAt/updatedAt 列。这些列被添加为 NOT NULL 无默认值导致插入失败。
//
// 修复方案：
// 1. 将所有表的 createdAt/updatedAt 列改为允许 NULL（或直接删除）
// 2. 优先方案：删除多余的 createdAt/updatedAt 列，让 Sequelize 使用蛇形 created_at/updated_at
//
// 但 Sequelize 模型默认 field 配置如果是 createdAt，会写 createdAt 列。
// 我们检查 models/index.js 的配置，决定是删除列还是保留。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 修复 createdAt/updatedAt 列 ==========\n');

  const queryInterface = db.sequelize.getQueryInterface();

  // 检查 Sequelize 配置：是否使用 underscored
  const sequelizeOptions = db.sequelize.options;
  const isUnderscored = sequelizeOptions.define && sequelizeOptions.define.underscored;
  console.log(`Sequelize underscored 配置: ${isUnderscored}`);
  console.log(`→ Sequelize 会使用 ${isUnderscored ? 'created_at/updated_at（蛇形）' : 'createdAt/updatedAt（驼峰）'} 列名\n`);

  // 收集所有模型表名
  const modelNames = Object.keys(db).filter(k =>
    k !== 'sequelize' && k !== 'Sequelize' &&
    db[k] && db[k].tableName
  );

  let fixed = 0;
  for (const modelName of modelNames) {
    const tableName = db[modelName].tableName;

    let tableDesc;
    try {
      tableDesc = await queryInterface.describeTable(tableName);
    } catch (err) {
      continue;
    }

    // 处理 createdAt/updatedAt 列
    for (const colName of ['createdAt', 'updatedAt']) {
      if (!tableDesc[colName]) continue;

      // 如果 underscored:true，Sequelize 不会用驼峰列名，可以安全删除
      // 如果 underscored:false，Sequelize 会用驼峰列名，需要保留但改为允许 NULL 并设默认值
      if (isUnderscored) {
        // 删除多余的驼峰列（蛇形列已存在）
        try {
          await db.sequelize.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${colName}\``);
          console.log(`  ✅ [${tableName}] 删除多余列: ${colName}`);
          fixed++;
        } catch (err) {
          console.error(`  ❌ [${tableName}] 删除列 ${colName} 失败: ${err.message}`);
        }
      } else {
        // 保留驼峰列，但改为允许 NULL 并设默认值 CURRENT_TIMESTAMP
        try {
          await db.sequelize.query(
            `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${colName}\` DATETIME NULL DEFAULT CURRENT_TIMESTAMP`
          );
          console.log(`  ✅ [${tableName}] 修改列 ${colName} → DATETIME NULL DEFAULT CURRENT_TIMESTAMP`);
          fixed++;
        } catch (err) {
          console.error(`  ❌ [${tableName}] 修改列 ${colName} 失败: ${err.message}`);
        }
      }
    }
  }

  console.log(`\n========== 修复完成 ==========`);
  console.log(`共修复 ${fixed} 个列。`);
  console.log('现在可以重新运行 node scripts/init-web-admin.js 初始化管理员账号。');
  process.exit(0);
}

main().catch((err) => {
  logger.error('修复失败:', err);
  console.error('修复失败:', err.message);
  process.exit(1);
});
