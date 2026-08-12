// scripts/check-id-types.js
'use strict';
require('dotenv').config();
const db = require('../models');

(async () => {
  await db.sequelize.authenticate();
  const [r1] = await db.sequelize.query("SHOW COLUMNS FROM users WHERE Field='id'");
  const [r2] = await db.sequelize.query("SHOW COLUMNS FROM reports WHERE Field='id'");
  console.log('users.id:', JSON.stringify(r1, null, 2));
  console.log('reports.id:', JSON.stringify(r2, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
