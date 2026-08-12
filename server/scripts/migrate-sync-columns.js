// scripts/migrate-sync-columns.js
// 用途：安全地同步所有模型字段到数据库（仅添加缺失列，不修改/删除已有列）
// 运行：node scripts/migrate-sync-columns.js
//
// 背景：User 模型新增了 password/visibility_settings 等字段，Report 模型新增了
// flagged/validation_errors/review_status 等字段，但现有数据库未自动同步。
// 此脚本逐表检测缺失列并安全添加，不影响已有数据。

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');
const { Sequelize } = db;

// Sequelize 类型到 SQL DDL 的映射
function typeToSql(attribute) {
  const type = attribute.type;
  const key = type.key;

  switch (key) {
    case 'STRING':
      return `VARCHAR(${type.options.length || 255})`;
    case 'TEXT':
      return 'TEXT';
    case 'INTEGER':
      return 'INT';
    case 'BIGINT':
      return 'BIGINT';
    case 'FLOAT':
      return 'FLOAT';
    case 'DOUBLE':
      return 'DOUBLE';
    case 'DECIMAL':
      return `DECIMAL(${type.options.precision || 10}, ${type.options.scale || 2})`;
    case 'BOOLEAN':
      return 'TINYINT(1)';
    case 'DATE':
    case 'DATETIME':
      return 'DATETIME';
    case 'UUID':
      return 'CHAR(36) BINARY';
    case 'JSON':
      return 'JSON';
    case 'ENUM':
      const values = type.options.values.map(v => `'${v}'`).join(', ');
      return `ENUM(${values})`;
    default:
      return 'TEXT';
  }
}

// 构建列定义的完整 SQL（含默认值、注释）
function columnDefSql(attribute, dialect) {
  let sql = typeToSql(attribute);

  // 允许 NULL
  if (attribute.allowNull === false) {
    sql += ' NOT NULL';
  } else {
    sql += ' NULL';
  }

  // 默认值
  if (attribute.defaultValue !== undefined && attribute.defaultValue !== null) {
    const def = attribute.defaultValue;
    if (typeof def === 'function') {
      // 如 DataTypes.UUIDV4
      const fnName = def.name || '';
      if (fnName === 'uuidv4' || String(def) === 'UUIDV4') {
        sql += ' DEFAULT (UUID())';
      }
    } else if (typeof def === 'boolean') {
      sql += ` DEFAULT ${def ? 1 : 0}`;
    } else if (typeof def === 'number') {
      sql += ` DEFAULT ${def}`;
    } else if (typeof def === 'string') {
      sql += ` DEFAULT '${def.replace(/'/g, "''")}'`;
    } else if (def instanceof Date) {
      sql += ` DEFAULT '${def.toISOString().slice(0, 19).replace('T', ' ')}'`;
    }
  }

  // 注释
  if (attribute.comment) {
    sql += ` COMMENT '${attribute.comment.replace(/'/g, "''")}'`;
  }

  return sql;
}

async function syncTable(modelName) {
  const model = db[modelName];
  if (!model || !model.tableName) return { added: 0, skipped: 0 };

  const tableName = model.tableName;
  const queryInterface = db.sequelize.getQueryInterface();

  // 获取数据库实际列
  let tableDesc;
  try {
    tableDesc = await queryInterface.describeTable(tableName);
  } catch (err) {
    // 表不存在，用 queryInterface.createTable 创建（含全部列，不含索引）
    console.log(`  📦 [${tableName}] 表不存在，正在创建...`);
    try {
      const attributes = model.rawAttributes;
      // 过滤掉虚拟字段
      const realAttrs = {};
      for (const [k, v] of Object.entries(attributes)) {
        if (v.type && v.type.key === 'VIRTUAL') continue;
        realAttrs[k] = v;
      }
      await queryInterface.createTable(tableName, realAttrs, {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      });
      console.log(`  ✅ [${tableName}] 表已创建（含 ${Object.keys(realAttrs).length} 列）`);
      return { added: Object.keys(realAttrs).length, skipped: 0 };
    } catch (createErr) {
      console.error(`  ❌ [${tableName}] 创建表失败: ${createErr.message}`);
      return { added: 0, skipped: 0 };
    }
  }

  // 获取模型定义的属性
  const rawAttributes = model.rawAttributes;
  let added = 0;
  let skipped = 0;

  for (const [columnName, attribute] of Object.entries(rawAttributes)) {
    // 跳过虚拟字段
    if (attribute.type && attribute.type.key === 'VIRTUAL') continue;

    if (tableDesc[columnName]) {
      skipped++;
      continue;
    }

    // 列缺失，添加
    const colDef = columnDefSql(attribute);
    const alterSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${colDef}`;

    try {
      await db.sequelize.query(alterSql);
      console.log(`  ✅ [${tableName}] 添加列: ${columnName} (${typeToSql(attribute)})`);
      added++;
    } catch (err) {
      console.error(`  ❌ [${tableName}] 添加列 ${columnName} 失败: ${err.message}`);
    }
  }

  return { added, skipped };
}

async function main() {
  await db.sequelize.authenticate();
  console.log('\n========== 数据库列同步迁移 ==========');
  console.log('（仅添加缺失列，不修改/删除已有列，不创建索引）\n');

  // 不调用 sequelize.sync()，因为它会尝试创建索引（索引引用的列可能还不存在导致失败）
  // 直接逐表检测并添加缺失列

  // 收集所有模型名称（排除 sequelize 内置的）
  const modelNames = Object.keys(db).filter(k =>
    k !== 'sequelize' && k !== 'Sequelize' &&
    db[k] && db[k].tableName && typeof db[k].rawAttributes === 'object'
  );

  let totalAdded = 0;
  for (const modelName of modelNames) {
    const result = await syncTable(modelName);
    if (result.added > 0 || result.tableMissing) {
      // 已在上面打印
    } else if (result.skipped > 0) {
      console.log(`✓ [${db[modelName].tableName}] 所有列已存在（${result.skipped} 列）`);
    }
    totalAdded += result.added || 0;
  }

  // 迁移列后再补建索引（忽略已存在的索引错误）
  console.log('\n--- 补建缺失索引 ---');
  for (const modelName of modelNames) {
    const model = db[modelName];
    if (!model.options || !model.options.indexes) continue;
    for (const idx of model.options.indexes) {
      const fields = idx.fields || [];
      const indexName = idx.name || `${model.tableName}_${fields.join('_')}`;
      const cols = fields.map(f => `\`${f}\``).join(', ');
      try {
        await db.sequelize.query(`CREATE INDEX \`${indexName}\` ON \`${model.tableName}\` (${cols})`);
        console.log(`  ✅ [${model.tableName}] 创建索引: ${indexName} (${cols})`);
      } catch (err) {
        // 索引已存在或字段不存在，静默跳过
        if (!/Duplicate key name|already exists/i.test(err.message)) {
          // 其他错误也跳过，不阻塞迁移
        }
      }
    }
  }

  console.log(`\n========== 迁移完成 ==========`);
  console.log(`共添加 ${totalAdded} 个缺失列。`);
  if (totalAdded > 0) {
    console.log('\n现在可以运行 node scripts/init-web-admin.js 初始化管理员账号。');
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error('迁移失败:', err);
  console.error('迁移失败:', err.message);
  process.exit(1);
});
