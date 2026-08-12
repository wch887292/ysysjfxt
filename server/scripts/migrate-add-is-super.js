// scripts/migrate-add-is-super.js
// 用途：为 users 表添加 is_super 字段（超级管理员标识）
// 运行：node scripts/migrate-add-is-super.js

'use strict';
require('dotenv').config();
const { Sequelize } = require('sequelize');

async function main() {
  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false
    }
  );

  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 检查字段是否已存在
    const [results] = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_super'`,
      { replacements: [process.env.DB_NAME] }
    );

    if (results.length > 0) {
      console.log('is_super 字段已存在，无需添加');
    } else {
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN is_super TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否超级管理员：仅系统初始化脚本可设置'`
      );
      console.log('✅ is_super 字段添加成功');
    }

    // 将已有的第一个 admin 账号标记为超级管理员
    const [admins] = await sequelize.query(
      `SELECT id, openid, nick_name, is_super FROM users WHERE role = 'admin' ORDER BY id ASC`
    );

    if (admins.length > 0) {
      const firstAdmin = admins[0];
      if (!firstAdmin.is_super) {
        await sequelize.query(
          `UPDATE users SET is_super = 1 WHERE id = ?`,
          { replacements: [firstAdmin.id] }
        );
        console.log(`✅ 已将首个 admin 账号（id=${firstAdmin.id}, openid=${firstAdmin.openid}, nick_name=${firstAdmin.nick_name}）标记为超级管理员`);
      } else {
        console.log(`超级管理员已设置：id=${firstAdmin.id}, openid=${firstAdmin.openid}`);
      }
    } else {
      console.log('⚠️ 未找到 admin 账号，请运行 node scripts/init-web-admin.js 初始化超级管理员');
    }

    await sequelize.close();
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  }
}

main();
