'use strict';
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD,
  { host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT), dialect: 'mysql', logging: false }
);

async function run() {
  // Add missing columns to commissions table
  const alterStatements = [
    "ALTER TABLE commissions ADD COLUMN service_provider_id VARCHAR(36) NULL COMMENT '服务商ID'",
    "ALTER TABLE commissions ADD COLUMN rate DECIMAL(5,4) NULL COMMENT '分润比例'",
    "ALTER TABLE commissions ADD COLUMN base_amount DECIMAL(10,2) NULL COMMENT '分润基数'",
    "ALTER TABLE commissions ADD COLUMN reference_id VARCHAR(36) NULL COMMENT '关联业务ID'",
    "ALTER TABLE commissions ADD COLUMN settled_by VARCHAR(36) NULL COMMENT '结算人'"
  ];

  for (const sql of alterStatements) {
    const colName = sql.split('ADD COLUMN ')[1].split(' ')[0];
    try {
      await sequelize.query(sql);
      console.log('Added: ' + colName);
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('Exists: ' + colName);
      } else {
        console.log('Error: ' + colName + ' - ' + e.message);
      }
    }
  }

  // Verify
  const [cols] = await sequelize.query('DESCRIBE commissions');
  console.log('\ncommissions columns:', cols.map(c => c.Field).join(', '));

  await sequelize.close();
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
