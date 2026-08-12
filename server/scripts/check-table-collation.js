// scripts/check-table-collation.js
'use strict';
require('dotenv').config();
const db = require('../models');

(async () => {
  await db.sequelize.authenticate();
  // 检查 users 表的 id 列完整定义（含字符集）
  const [r1] = await db.sequelize.query("SHOW FULL COLUMNS FROM users WHERE Field='id'");
  console.log('users.id:', JSON.stringify(r1, null, 2));
  // 检查表默认字符集
  const [r2] = await db.sequelize.query("SHOW TABLE STATUS WHERE Name='users'");
  console.log('users table collation:', r2[0] && r2[0].Collation);
  const [r3] = await db.sequelize.query("SHOW TABLE STATUS WHERE Name='reports'");
  console.log('reports table collation:', r3[0] && r3[0].Collation);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
