// scripts/init-db.js - 数据库初始化脚本
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../models');
const logger = require('../utils/logger');

async function initDatabase() {
  try {
    logger.info('开始初始化数据库...');

    // 同步所有模型（强制重建）
    await db.sequelize.sync({ force: true });
    logger.info('数据库表创建完成');

    // 创建管理员
    const admin = await db.User.create({
      openid: 'admin_system',
      nick_name: '系统管理员',
      role: 'admin',
      status: 'active'
    });
    logger.info(`管理员创建完成: ${admin.id}`);

    // 创建示例服务商
    const serviceProvider = await db.ServiceProvider.create({
      name: '元生健康服务中心',
      status: 'active',
      verified: true
    });
    logger.info(`服务商创建完成: ${serviceProvider.id}`);

    // 创建示例Agent
    const agent = await db.Agent.create({
      user_id: admin.id,
      name: '张营养师',
      service_provider_id: serviceProvider.id,
      status: 'active',
      verified: true
    });
    logger.info(`Agent创建完成: ${agent.id}`);

    // 创建示例礼品
    const gifts = await db.Gift.bulkCreate([
      { name: '健康沙拉券', description: '可兑换一份健康沙拉', points: 50, category: 'food', stock: 100, status: 'active' },
      { name: '营养咨询1次', description: '一对一营养咨询服务', points: 100, category: 'service', stock: 50, status: 'active' },
      { name: '健身房体验券', description: '健身房单次体验券', points: 200, category: 'health', stock: 30, status: 'active' },
      { name: '有机水果礼盒', description: '精选有机水果礼盒', points: 150, category: 'food', stock: 20, status: 'active' },
      { name: '健康体检套餐', description: '基础健康体检套餐', points: 500, category: 'health', stock: 10, status: 'active' }
    ]);
    logger.info(`示例礼品创建完成: ${gifts.length}个`);

    logger.info('数据库初始化完成!');
    process.exit(0);
  } catch (err) {
    logger.error('数据库初始化失败:', err);
    process.exit(1);
  }
}

initDatabase();