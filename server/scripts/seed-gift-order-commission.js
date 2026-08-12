// scripts/seed-gift-order-commission.js
// 插入礼品管理、订单管理、分润管理测试数据：各3条
// 运行：node scripts/seed-gift-order-commission.js
require('dotenv').config();
const db = require('../models');

async function main() {
  console.log('开始插入礼品/订单/分润测试数据...\n');

  // 获取管理员
  let adminUser = await db.User.findOne({ where: { role: 'admin' } });
  if (!adminUser) adminUser = await db.User.findOne({ where: { role: 'super_admin' } });
  const adminId = adminUser ? adminUser.id : null;

  // 获取代理商（Commission外键agent_id指向users表，需用关联用户ID）
  let agent = await db.Agent.findOne({ where: { status: 'active' } });
  if (!agent) agent = await db.Agent.findOne();
  const agentId = agent ? agent.id : null;
  // Commission.agent_id 外键实际指向 users.id，需要代理商关联的用户ID
  let agentUserId = agent && agent.user_id ? agent.user_id : null;
  if (!agentUserId && agent) {
    const agentUser = await db.User.findOne({ where: { agent_id: agent.id } });
    agentUserId = agentUser ? agentUser.id : null;
  }
  if (agentId) console.log('✅ 代理商:', agent.name || agent.id, agentId, 'userId:', agentUserId);
  else console.log('⚠️ 未找到代理商');

  // 获取服务商（Commission外键service_provider_id也指向users表）
  let sp = await db.ServiceProvider.findOne({ where: { status: 'active' } });
  if (!sp) sp = await db.ServiceProvider.findOne();
  const spId = sp ? sp.id : null;
  let spUserId = sp && sp.user_id ? sp.user_id : null;
  if (!spUserId && sp) {
    const spUser = await db.User.findOne({ where: { service_provider_id: sp.id } });
    spUserId = spUser ? spUser.id : null;
  }
  if (spId) console.log('✅ 服务商:', sp.name || sp.id, spId, 'userId:', spUserId);

  // 获取测试用户
  let testUser = await db.User.findOne({ where: { nick_name: '测试用户', role: 'user' } });
  if (!testUser) testUser = await db.User.findOne({ where: { role: 'user' } });
  const userId = testUser ? testUser.id : null;
  if (userId) console.log('✅ 测试用户:', testUser.nick_name, userId);

  const now = new Date();
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  const genCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

  // ============================================================
  // 1. Gift 礼品（3条，覆盖 active/inactive/sold_out）
  // ============================================================
  console.log('\n--- 礼品管理 ---');
  const giftData = [
    {
      name: '有机燕麦礼盒（500g×2）',
      description: '精选澳洲有机燕麦，富含膳食纤维，适合日常营养补充，低糖低脂配方',
      image: '/uploads/gifts/oat-gift-box.jpg',
      points: 500,
      cash_price: 0,
      category: 'food',
      stock: 200,
      sold_count: 56,
      status: 'active',
      agent_id: spId,
      start_date: daysAgo(30),
      end_date: null
    },
    {
      name: '健康体检套餐（基础版）',
      description: '合作体检中心提供的基础体检套餐，包含血常规、肝肾功能、心电图等常规检查项目',
      image: '/uploads/gifts/health-checkup.jpg',
      points: 2000,
      cash_price: 9900,
      category: 'service',
      stock: 50,
      sold_count: 12,
      status: 'active',
      agent_id: spId,
      start_date: daysAgo(15),
      end_date: null
    },
    {
      name: '维生素D3补充剂（60粒装）',
      description: '每粒含400IU维生素D3，促进钙吸收，适合室内办公人群',
      image: '/uploads/gifts/vitamin-d3.jpg',
      points: 300,
      cash_price: 0,
      category: 'health',
      stock: 0,
      sold_count: 100,
      status: 'sold_out',
      agent_id: spId,
      start_date: daysAgo(60),
      end_date: daysAgo(5)
    }
  ];

  const giftIds = [];
  for (const d of giftData) {
    const [gift, created] = await db.Gift.findOrCreate({
      where: { name: d.name },
      defaults: d
    });
    giftIds.push(gift.id);
    console.log(created ? `✅ 礼品[${d.status}]: ${d.name} (${d.points}积分)` : `⏭️ 已存在: ${d.name}`);
  }

  // ============================================================
  // 2. GiftExchange 礼品兑换订单（3条，覆盖 pending/completed/cancelled）
  // ============================================================
  console.log('\n--- 订单管理 ---');
  if (!userId || giftIds.length < 2) {
    console.log('⏭️ 跳过：缺少用户或礼品数据');
  } else {
    const exchangeData = [
      {
        user_id: userId,
        gift_id: giftIds[0],
        points: 500,
        cash_paid: 0,
        payment_order_id: null,
        status: 'completed',
        write_off_code: 'WO' + genCode(),
        write_off_date: daysAgo(3),
        agent_id: agentId,
        remark: '已到店核销',
        idempotency_key: 'GE_001_' + Date.now()
      },
      {
        user_id: userId,
        gift_id: giftIds[1],
        points: 2000,
        cash_paid: 9900,
        payment_order_id: 'WX' + Date.now() + genCode(),
        status: 'pending',
        write_off_code: 'WO' + genCode(),
        write_off_date: null,
        agent_id: null,
        remark: null,
        idempotency_key: 'GE_002_' + Date.now()
      },
      {
        user_id: userId,
        gift_id: giftIds[0],
        points: 500,
        cash_paid: 0,
        payment_order_id: null,
        status: 'cancelled',
        write_off_code: 'WO' + genCode(),
        write_off_date: null,
        agent_id: null,
        remark: '用户主动取消兑换',
        idempotency_key: 'GE_003_' + Date.now()
      }
    ];

    for (const d of exchangeData) {
      const existing = await db.GiftExchange.findOne({
        where: { user_id: d.user_id, gift_id: d.gift_id, status: d.status },
        order: [['created_at', 'DESC']]
      });
      if (!existing) {
        await db.GiftExchange.create(d);
        const gift = await db.Gift.findByPk(d.gift_id);
        console.log(`✅ 订单[${d.status}]: ${gift ? gift.name : d.gift_id} (${d.points}积分${d.cash_paid > 0 ? '+¥' + (d.cash_paid / 100) : ''})`);
      } else {
        console.log(`⏭️ 已存在: ${d.status}`);
      }
    }
  }

  // ============================================================
  // 3. Commission 分润（3条，覆盖 pending/settled/cancelled）
  // ============================================================
  console.log('\n--- 分润管理 ---');
  if (!agentUserId || !userId) {
    console.log('⏭️ 跳过：缺少代理商用户或测试用户数据');
  } else {
    const commissionData = [
      {
        agent_id: agentUserId,
        service_provider_id: spUserId,
        user_id: userId,
        source: 'gift_exchange',
        amount: 25.00,
        rate: 0.1000,
        base_amount: 250.00,
        reference_id: null,
        period: '2026-07',
        status: 'pending',
        settled_at: null,
        settled_by: null,
        remark: '有机燕麦礼盒兑换分润（10%）'
      },
      {
        agent_id: agentUserId,
        service_provider_id: spUserId,
        user_id: userId,
        source: 'write_off',
        amount: 15.00,
        rate: 0.0500,
        base_amount: 300.00,
        reference_id: null,
        period: '2026-06',
        status: 'settled',
        settled_at: daysAgo(15),
        settled_by: adminId,
        remark: '6月积分核销分润（5%），已结算'
      },
      {
        agent_id: agentUserId,
        service_provider_id: spUserId,
        user_id: userId,
        source: 'member_service',
        amount: 50.00,
        rate: 0.1500,
        base_amount: 333.33,
        reference_id: null,
        period: '2026-06',
        status: 'cancelled',
        settled_at: null,
        settled_by: null,
        remark: '会员服务分润（15%），因退款已取消'
      }
    ];

    for (const d of commissionData) {
      const existing = await db.Commission.findOne({
        where: {
          agent_id: d.agent_id,
          user_id: d.user_id,
          source: d.source,
          period: d.period,
          amount: d.amount,
          status: d.status
        }
      });
      if (!existing) {
        await db.Commission.create(d);
        const sourceLabels = { gift_exchange: '礼品兑换', write_off: '积分核销', member_service: '会员服务', other: '其他' };
        const statusLabels = { pending: '待结算', settled: '已结算', cancelled: '已取消' };
        console.log(`✅ 分润[${statusLabels[d.status]}]: ${sourceLabels[d.source]} ¥${d.amount} (${d.period})`);
      } else {
        console.log(`⏭️ 已存在: ${d.source}/${d.status}`);
      }
    }
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log('\n========== 礼品/订单/分润数据汇总 ==========');
  console.log('Gift 礼品:');
  for (const s of ['active', 'inactive', 'sold_out']) {
    const count = await db.Gift.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('GiftExchange 订单:');
  for (const s of ['pending', 'completed', 'cancelled', 'refunded']) {
    const count = await db.GiftExchange.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('Commission 分润:');
  for (const s of ['pending', 'settled', 'cancelled']) {
    const count = await db.Commission.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入礼品/订单/分润数据失败:', err);
  process.exit(1);
});
