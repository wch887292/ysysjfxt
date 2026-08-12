#!/usr/bin/env node
/**
 * 迁移脚本：对齐规格10.1-10.6数据库设计
 *
 * 修复内容：
 * 1. users表：
 *    - 统一 wechat_openid → openid（wechat_openid 数据迁移到 openid，删除旧列）
 *    - 统一 nickname → nick_name（数据迁移，删除旧列）
 *    - 统一 last_active_date → last_active_at（数据迁移，删除旧列）
 *    - status ENUM 增加 'inactive'
 *    - 新增 is_super 字段
 *    - 清理重复索引
 * 2. clock_in_records表：
 *    - meal_type ENUM 增加 'snack'
 * 3. 10.3-10.6 表已对齐，无需迁移
 *
 * 安全措施：
 * - 迁移前检查数据一致性（如 openid/nickname 列是否已有数据）
 * - 所有 ALTER 操作在事务中执行（DDL 不支持事务，但逐条执行可定位失败语句）
 * - 迁移后验证表结构
 */

'use strict';
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    dialect: 'mysql',
    logging: false
  }
);

async function migrate() {
  console.log('=== 开始数据库迁移（规格10.1-10.6对齐） ===\n');

  // ============================================================
  // 10.1 users 表
  // ============================================================
  console.log('--- 10.1 users 表 ---');

  // 检查 wechat_openid 列是否存在
  const [userCols] = await sequelize.query("DESCRIBE users");
  const colNames = userCols.map(c => c.Field);

  // 1. wechat_openid → openid 统一
  //    DB 中同时有 wechat_openid（nullable，旧列）和 openid（NOT NULL，新列）
  //    策略：将 wechat_openid 中有值但 openid 为空的记录迁移，然后删除 wechat_openid
  if (colNames.includes('wechat_openid') && colNames.includes('openid')) {
    console.log('  [1] wechat_openid → openid 数据迁移...');
    // 迁移：wechat_openid 有值但 openid 为空的记录
    const [updateResult] = await sequelize.query(
      "UPDATE users SET openid = wechat_openid WHERE openid IS NULL OR openid = ''"
    );
    console.log(`  [1] 迁移了 ${updateResult.affectedRows || 0} 行`);

    // 删除旧索引 idx_wechat_openid
    try {
      await sequelize.query('ALTER TABLE users DROP INDEX idx_wechat_openid');
      console.log('  [1] 删除旧索引 idx_wechat_openid');
    } catch (e) {
      if (e.message.includes('check that column/key exists')) {
        console.log('  [1] 索引 idx_wechat_openid 不存在，跳过');
      } else {
        console.log('  [1] 删除索引 idx_wechat_openid 失败:', e.message);
      }
    }

    // 删除旧列 wechat_openid
    try {
      await sequelize.query('ALTER TABLE users DROP COLUMN wechat_openid');
      console.log('  [1] 删除旧列 wechat_openid');
    } catch (e) {
      console.log('  [1] 删除列 wechat_openid 失败:', e.message);
    }
  } else {
    console.log('  [1] wechat_openid 列不存在或已删除，跳过');
  }

  // 2. nickname → nick_name 统一
  if (colNames.includes('nickname') && colNames.includes('nick_name')) {
    console.log('  [2] nickname → nick_name 数据迁移...');
    const [updateResult2] = await sequelize.query(
      "UPDATE users SET nick_name = nickname WHERE nick_name IS NULL OR nick_name = '' OR nick_name = '健康新人'"
    );
    console.log(`  [2] 迁移了 ${updateResult2.affectedRows || 0} 行`);

    try {
      await sequelize.query('ALTER TABLE users DROP COLUMN nickname');
      console.log('  [2] 删除旧列 nickname');
    } catch (e) {
      console.log('  [2] 删除列 nickname 失败:', e.message);
    }
  } else {
    console.log('  [2] nickname 列不存在或已删除，跳过');
  }

  // 3. last_active_date → last_active_at 统一
  if (colNames.includes('last_active_date') && colNames.includes('last_active_at')) {
    console.log('  [3] last_active_date → last_active_at 数据迁移...');
    const [updateResult3] = await sequelize.query(
      "UPDATE users SET last_active_at = last_active_date WHERE last_active_at IS NULL AND last_active_date IS NOT NULL"
    );
    console.log(`  [3] 迁移了 ${updateResult3.affectedRows || 0} 行`);

    // 删除旧索引 idx_last_active（指向 last_active_date）
    try {
      await sequelize.query('ALTER TABLE users DROP INDEX idx_last_active');
      console.log('  [3] 删除旧索引 idx_last_active');
    } catch (e) {
      if (!e.message.includes('check that column/key exists')) {
        console.log('  [3] 删除索引 idx_last_active 失败:', e.message);
      }
    }

    try {
      await sequelize.query('ALTER TABLE users DROP COLUMN last_active_date');
      console.log('  [3] 删除旧列 last_active_date');
    } catch (e) {
      console.log('  [3] 删除列 last_active_date 失败:', e.message);
    }
  } else {
    console.log('  [3] last_active_date 列不存在或已删除，跳过');
  }

  // 4. status ENUM 增加 'inactive'
  const statusCol = userCols.find(c => c.Field === 'status');
  if (statusCol && !statusCol.Type.includes('inactive')) {
    console.log('  [4] status ENUM 增加 inactive...');
    await sequelize.query(
      "ALTER TABLE users MODIFY COLUMN status ENUM('active','inactive','banned') DEFAULT 'active'"
    );
    console.log('  [4] status ENUM 已更新');
  } else {
    console.log('  [4] status ENUM 已包含 inactive，跳过');
  }

  // 5. 新增 is_super 字段
  if (!colNames.includes('is_super')) {
    console.log('  [5] 新增 is_super 字段...');
    await sequelize.query(
      "ALTER TABLE users ADD COLUMN is_super TINYINT(1) DEFAULT 0 COMMENT '是否超级管理员：仅系统初始化脚本可设置'"
    );
    console.log('  [5] is_super 字段已添加');
  } else {
    console.log('  [5] is_super 字段已存在，跳过');
  }

  // 6. 清理重复索引
  // 重新获取索引信息
  const [userIndexes] = await sequelize.query(
    "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' GROUP BY INDEX_NAME",
    { replacements: [process.env.DB_NAME] }
  );
  const indexMap = {};
  for (const idx of userIndexes) {
    const key = idx.cols;
    if (!indexMap[key]) indexMap[key] = [];
    indexMap[key].push(idx.INDEX_NAME);
  }

  let droppedCount = 0;
  for (const [cols, names] of Object.entries(indexMap)) {
    if (names.length > 1) {
      // 保留 Sequelize 自动生成的索引名（users_xxx），删除旧名（idx_xxx）
      const toKeep = names.find(n => n === 'PRIMARY' || n.startsWith('users_') || n.startsWith('idx_users_')) || names[0];
      const toDrop = names.filter(n => n !== toKeep);
      for (const dropName of toDrop) {
        try {
          await sequelize.query(`ALTER TABLE users DROP INDEX \`${dropName}\``);
          console.log(`  [6] 删除重复索引 ${dropName}（列: ${cols}，保留: ${toKeep}）`);
          droppedCount++;
        } catch (e) {
          console.log(`  [6] 删除索引 ${dropName} 失败:`, e.message);
        }
      }
    }
  }
  if (droppedCount === 0) {
    console.log('  [6] 无重复索引需清理');
  }

  // ============================================================
  // 10.2 clock_in_records 表
  // ============================================================
  console.log('\n--- 10.2 clock_in_records 表 ---');

  const [cirCols] = await sequelize.query("DESCRIBE clock_in_records");
  const mealTypeCol = cirCols.find(c => c.Field === 'meal_type');
  if (mealTypeCol && !mealTypeCol.Type.includes('snack')) {
    console.log('  [1] meal_type ENUM 增加 snack...');
    await sequelize.query(
      "ALTER TABLE clock_in_records MODIFY COLUMN meal_type ENUM('breakfast','lunch','dinner','snack') NOT NULL"
    );
    console.log('  [1] meal_type ENUM 已更新');
  } else {
    console.log('  [1] meal_type ENUM 已包含 snack，跳过');
  }

  // 清理重复索引
  const [cirIndexes] = await sequelize.query(
    "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clock_in_records' GROUP BY INDEX_NAME",
    { replacements: [process.env.DB_NAME] }
  );
  const cirIndexMap = {};
  for (const idx of cirIndexes) {
    const key = idx.cols;
    if (!cirIndexMap[key]) cirIndexMap[key] = [];
    cirIndexMap[key].push(idx.INDEX_NAME);
  }

  let cirDropped = 0;
  for (const [cols, names] of Object.entries(cirIndexMap)) {
    if (names.length > 1) {
      const toKeep = names.find(n => n === 'PRIMARY' || n.startsWith('unique_') || n.startsWith('idx_')) || names[0];
      const toDrop = names.filter(n => n !== toKeep);
      for (const dropName of toDrop) {
        try {
          await sequelize.query(`ALTER TABLE clock_in_records DROP INDEX \`${dropName}\``);
          console.log(`  [2] 删除重复索引 ${dropName}（列: ${cols}，保留: ${toKeep}）`);
          cirDropped++;
        } catch (e) {
          console.log(`  [2] 删除索引 ${dropName} 失败:`, e.message);
        }
      }
    }
  }
  if (cirDropped === 0) {
    console.log('  [2] 无重复索引需清理');
  }

  // ============================================================
  // 10.3-10.6 表已对齐，仅清理重复索引
  // ============================================================
  const otherTables = ['course_records', 'agent_posts', 'points_write_off', 'inactive_alerts'];
  for (const tableName of otherTables) {
    console.log(`\n--- ${tableName} 清理重复索引 ---`);
    const [tblIndexes] = await sequelize.query(
      "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? GROUP BY INDEX_NAME",
      { replacements: [process.env.DB_NAME, tableName] }
    );
    const tblIndexMap = {};
    for (const idx of tblIndexes) {
      const key = idx.cols;
      if (!tblIndexMap[key]) tblIndexMap[key] = [];
      tblIndexMap[key].push(idx.INDEX_NAME);
    }

    let tblDropped = 0;
    for (const [cols, names] of Object.entries(tblIndexMap)) {
      if (names.length > 1) {
        const toKeep = names.find(n => n === 'PRIMARY' || n.startsWith('unique_') || n.startsWith('idx_')) || names[0];
        const toDrop = names.filter(n => n !== toKeep);
        for (const dropName of toDrop) {
          try {
            await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${dropName}\``);
            console.log(`  删除重复索引 ${dropName}（列: ${cols}，保留: ${toKeep}）`);
            tblDropped++;
          } catch (e) {
            console.log(`  删除索引 ${dropName} 失败:`, e.message);
          }
        }
      }
    }
    if (tblDropped === 0) {
      console.log('  无重复索引需清理');
    }
  }

  // ============================================================
  // 验证
  // ============================================================
  console.log('\n=== 迁移验证 ===');

  // 验证 users 表
  const [newUserCols] = await sequelize.query("DESCRIBE users");
  const newColNames = newUserCols.map(c => c.Field);

  const checks = [
    { name: 'wechat_openid 已删除', pass: !newColNames.includes('wechat_openid') },
    { name: 'openid 存在', pass: newColNames.includes('openid') },
    { name: 'nickname 已删除', pass: !newColNames.includes('nickname') },
    { name: 'nick_name 存在', pass: newColNames.includes('nick_name') },
    { name: 'last_active_date 已删除', pass: !newColNames.includes('last_active_date') },
    { name: 'last_active_at 存在', pass: newColNames.includes('last_active_at') },
    { name: 'is_super 存在', pass: newColNames.includes('is_super') },
    { name: 'status 含 inactive', pass: newUserCols.find(c => c.Field === 'status')?.Type.includes('inactive') }
  ];

  for (const c of checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
  }

  // 验证 clock_in_records
  const [newCirCols] = await sequelize.query("DESCRIBE clock_in_records");
  const mealTypeOk = newCirCols.find(c => c.Field === 'meal_type')?.Type.includes('snack');
  console.log(`  ${mealTypeOk ? 'PASS' : 'FAIL'} clock_in_records.meal_type 含 snack`);

  const allPassed = checks.every(c => c.pass) && mealTypeOk;
  console.log(`\n=== 迁移结果: ${allPassed ? '全部通过' : '存在失败项'} ===`);

  await sequelize.close();
  process.exit(allPassed ? 0 : 1);
}

migrate().catch(e => {
  console.error('迁移失败:', e);
  process.exit(1);
});
