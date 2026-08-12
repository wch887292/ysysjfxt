require('dotenv').config();
const db = require('./models');

(async () => {
  try {
    await db.sequelize.authenticate();
    const gifts = await db.Gift.findAll({
      attributes: ['id', 'name', 'description', 'image', 'points', 'category', 'stock', 'status']
    });
    console.log('=== 礼品列表 ===');
    gifts.forEach(g => {
      console.log(JSON.stringify({
        id: g.id,
        name: g.name,
        image: g.image,
        points: g.points,
        category: g.category,
        stock: g.stock
      }));
    });
    console.log('总计: ' + gifts.length + ' 个礼品');
    process.exit(0);
  } catch (e) {
    console.error('查询失败:', e.message);
    process.exit(1);
  }
})();
