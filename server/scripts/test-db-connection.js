// scripts/test-db-connection.js - 数据库连接与表结构验证
require('dotenv').config();
const { Sequelize } = require('sequelize');

(async () => {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'diet_points_system';

  console.log('尝试连接 MySQL 服务器...');
  console.log(`  Host: ${host}:${port}`);
  console.log(`  User: ${user}`);
  console.log(`  Target Database: ${dbName}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || '(未设置)'}`);

  // 第一步：不指定数据库连接，验证账号与服务器
  const rootSequelize = new Sequelize('', user, password, {
    host, port, dialect: 'mysql', logging: false
  });

  try {
    await rootSequelize.authenticate();
    console.log('\n[1/4] MySQL 服务器连接: OK');
  } catch (err) {
    console.error('\n[1/4] MySQL 服务器连接失败:', err.message);
    process.exit(1);
  }

  // 第二步：MySQL 版本
  try {
    const [versionRes] = await rootSequelize.query('SELECT VERSION() as v');
    console.log(`[2/4] MySQL 版本: ${versionRes[0].v}`);
  } catch (err) {
    console.error('[2/4] 获取版本失败:', err.message);
  }

  // 第三步：检查/创建目标数据库
  try {
    const [dbs] = await rootSequelize.query(`SHOW DATABASES LIKE '${dbName}'`);
    if (dbs.length === 0) {
      console.log(`[3/4] 数据库 ${dbName} 不存在，正在创建...`);
      await rootSequelize.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
      console.log('  数据库创建: OK');
    } else {
      console.log(`[3/4] 数据库 ${dbName} 存在: OK`);
    }
  } catch (err) {
    console.error('[3/4] 数据库检查/创建失败:', err.message);
    await rootSequelize.close();
    process.exit(1);
  }

  await rootSequelize.close();

  // 第四步：使用业务连接（models/index.js）测试模型加载与表结构
  const db = require('../models');
  try {
    await db.sequelize.authenticate();
    const [tables] = await db.sequelize.query('SHOW TABLES');
    console.log(`[4/4] 业务模型加载: OK (现有表 ${tables.length} 张)`);
    if (tables.length > 0) {
      console.log('  表清单:');
      tables.forEach(t => {
        const name = Object.values(t)[0];
        console.log(`    - ${name}`);
      });
    } else {
      console.log('  提示: 数据库为空，请运行 npm run init-db 初始化表结构');
    }
    console.log('\n连接验证全部通过');
    await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[4/4] 业务连接失败:', err.message);
    if (err.original) {
      console.error('原始错误:', err.original.message);
    }
    process.exit(1);
  }
})();

