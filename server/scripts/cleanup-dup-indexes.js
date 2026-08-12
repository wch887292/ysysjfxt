'use strict';
require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD,
  { host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT), dialect: 'mysql', logging: false }
);

async function run() {
  const tables = [
    'users', 'clock_in_records', 'course_records', 'agent_posts', 'points_write_off', 'inactive_alerts',
    'agents', 'commissions', 'articles', 'data_export_requests', 'forbidden_words',
    'gifts', 'gift_exchanges', 'meals', 'system_configs', 'sign_in_records',
    'service_provider_receptions', 'service_providers', 'report_feedbacks',
    'prompt_versions', 'points_history', 'questionnaire_answers', 'reports', 'questionnaires'
  ];

  for (const tableName of tables) {
    const [ix] = await sequelize.query(
      'SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? GROUP BY INDEX_NAME',
      { replacements: [process.env.DB_NAME, tableName] }
    );
    const m = {};
    for (const i of ix) {
      const k = i.cols;
      if (!m[k]) m[k] = [];
      m[k].push(i.INDEX_NAME);
    }

    let dropped = 0;
    for (const [cols, names] of Object.entries(m)) {
      if (names.length > 1) {
        // 保留 Sequelize/模型定义的 tablename_col 格式（两者一致，sync 不会重复创建）
        // 删除任何遗留的 idx_/unique_ 前缀格式
        const keep = names.find(n => n === 'PRIMARY' || !n.startsWith('idx_') && !n.startsWith('unique_')) || names[0];
        const drop = names.filter(n => n !== keep);
        for (const d of drop) {
          try {
            await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${d}\``);
            console.log(`[${tableName}] Dropped ${d} (keep ${keep}, cols: ${cols})`);
            dropped++;
          } catch (e) {
            console.log(`[${tableName}] Drop ${d} failed: ${e.message}`);
          }
        }
      }
    }
    if (dropped === 0) console.log(`[${tableName}] No duplicate indexes`);
  }

  await sequelize.close();
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
