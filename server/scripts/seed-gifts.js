// scripts/seed-gifts.js - 礼品种子数据
require('dotenv').config();
const db = require('../models');

const SEED_GIFTS = [
  {
    name: '健康体检套餐',
    description: '全面健康体检一次，含血常规、肝功能、心电图等',
    image: '/static/images/gifts/checkup.jpg',
    points: 500,
    cash_price: 0,
    category: 'health',
    stock: 50,
    status: 'active'
  },
  {
    name: '新鲜水果礼盒',
    description: '精选时令水果礼盒，含苹果、橙子、猕猴桃等',
    image: '/static/images/gifts/fruit-box.jpg',
    points: 200,
    cash_price: 0,
    category: 'food',
    stock: 100,
    status: 'active'
  },
  {
    name: '营养咨询服务',
    description: '专业营养师一对一咨询30分钟，定制饮食方案',
    image: '/static/images/gifts/nutrition.jpg',
    points: 300,
    cash_price: 0,
    category: 'service',
    stock: -1,
    status: 'active'
  },
  {
    name: '轻食沙拉套餐',
    description: '低卡健康沙拉套餐一份，多种口味可选',
    image: '/static/images/gifts/salad.jpg',
    points: 150,
    cash_price: 0,
    category: 'food',
    stock: 80,
    status: 'active'
  },
  {
    name: '健身体验券',
    description: '合作健身房单次体验券，含器械使用和教练指导',
    image: '/static/images/gifts/gym.jpg',
    points: 350,
    cash_price: 0,
    category: 'health',
    stock: 30,
    status: 'active'
  },
  {
    name: '10元健康优惠券',
    description: '全场健康食品满50元可用，有效期30天',
    image: '/static/images/gifts/default.png',
    points: 100,
    cash_price: 0,
    category: 'coupon',
    stock: -1,
    status: 'active'
  }
];

async function seed() {
  try {
    for (const gift of SEED_GIFTS) {
      const [created] = await db.Gift.findOrCreate({
        where: { name: gift.name },
        defaults: gift
      });
      console.log(created ? `✅ 创建: ${gift.name}` : `⏭️ 已存在: ${gift.name}`);
    }
    console.log('礼品种子数据初始化完成');
    process.exit(0);
  } catch (err) {
    console.error('初始化失败:', err);
    process.exit(1);
  }
}

seed();
