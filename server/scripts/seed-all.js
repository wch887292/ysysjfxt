// scripts/seed-all.js - 全量种子数据（礼品订单、资讯、违禁词库、分润、积分、用户）
//
// 使用方式：node server/scripts/seed-all.js
// 每个模块创建 3 条虚拟数据，幂等（按唯一标识 findOrCreate）
require('dotenv').config();
const db = require('../models');

// ============================================================
// 1. 用户（3 条）
// ============================================================
const SEED_USERS = [
  {
    openid: 'SEED_USER_001',
    nick_name: '张三',
    phone: '13800001001',
    gender: 'male',
    age: 35,
    height: 175,
    weight: 72,
    identity_type: 'member',
    is_member: true,
    points: 860,
    total_points: 1200,
    status: 'active',
    share_code: 'USR001'
  },
  {
    openid: 'SEED_USER_002',
    nick_name: '李四',
    phone: '13800001002',
    gender: 'female',
    age: 28,
    height: 162,
    weight: 55,
    identity_type: 'user',
    is_member: false,
    points: 320,
    total_points: 500,
    status: 'active',
    share_code: 'USR002'
  },
  {
    openid: 'SEED_USER_003',
    nick_name: '王五',
    phone: '13800001003',
    gender: 'male',
    age: 42,
    height: 170,
    weight: 80,
    identity_type: 'member',
    is_member: true,
    points: 1500,
    total_points: 2300,
    status: 'active',
    share_code: 'USR003'
  }
];

// ============================================================
// 2. 资讯（3 条）
// ============================================================
const SEED_ARTICLES = [
  {
    title: '夏季健康饮食指南：清淡为主，营养均衡',
    summary: '炎炎夏日，如何吃得健康又清爽？本文为您介绍夏季饮食的三大原则和五款推荐食谱，帮助您在高温天气保持活力。',
    content: `## 夏季健康饮食三大原则

### 1. 清淡为主，少油少盐
夏季气温高，人体消化功能相对减弱，饮食应以清淡为主。建议每日烹调用油不超过25克，食盐不超过5克。

### 2. 多吃蔬果，补充水分
夏季出汗多，需要及时补充水分和电解质。建议每天摄入300-500克蔬菜和200-350克水果。

### 3. 适当补充蛋白质
高温环境下蛋白质分解加速，应适当增加优质蛋白的摄入，如鱼、蛋、豆制品等。

## 推荐食谱

**凉拌黄瓜**：清热解暑，开胃消食
**番茄蛋汤**：营养丰富，易于消化
**绿豆粥**：消暑解毒，补充能量
**蒸鱼**：高蛋白低脂肪，适合夏季
**水果沙拉**：维生素丰富，清凉爽口

> 温馨提示：夏季饮食切忌贪凉，过冷食物会刺激肠胃，影响消化功能。`,
    cover_image: '/static/images/articles/summer-diet.jpg',
    category: 'health_tips',
    status: 'published',
    published_at: new Date(),
    view_count: 128,
    sort_order: 10
  },
  {
    title: '健康饮食积分系统全新升级，更多福利等你来拿！',
    summary: '本次升级新增了课程学习积分、签到奖励翻倍等功能，快来了解详情，开启你的健康积分之旅！',
    content: `## 升级亮点

### 1. 课程学习积分上线
完成课程学习即可获得积分奖励，学习越多，积分越多！

### 2. 签到奖励翻倍
连续签到7天，第7天积分翻倍！坚持打卡，收获满满。

### 3. 礼品商城上新
新增多款健康礼品，包括健康体检套餐、营养咨询服务等，更多好礼等你兑换。

## 如何参与
1. 每日打卡上传餐食，获取基础积分
2. 完成健康评估问卷，获取额外积分
3. 参加课程学习，获取学习积分
4. 邀请好友注册，获取拉新奖励

> 开始你的健康积分之旅吧！`,
    cover_image: '/static/images/articles/upgrade.jpg',
    category: 'activity',
    status: 'published',
    published_at: new Date(),
    view_count: 256,
    sort_order: 20
  },
  {
    title: '关于用户隐私保护政策更新的公告',
    summary: '为更好地保护用户隐私，我们对隐私保护政策进行了更新，主要涉及数据收集范围、使用目的和用户权利等方面。',
    content: `## 尊敬的用户

为更好地保护您的个人信息安全，根据《个人信息保护法》等相关法律法规，我们对隐私保护政策进行了更新，主要变更如下：

### 变更内容

**1. 数据收集范围**
明确了收集个人信息的类型和目的，确保最小必要原则。

**2. 数据使用目的**
细化了个人信息的使用场景，确保目的明确、正当。

**3. 用户权利**
- 您有权查阅、复制您的个人信息
- 您有权更正、删除您的个人信息
- 您有权撤回授权同意
- 您有权申请数据导出

**4. 数据安全措施**
采用AES-256加密存储敏感信息，HTTPS传输加密，确保数据安全。

### 生效时间
本政策更新自发布之日起生效。

如有任何疑问，请联系客服。`,
    cover_image: '/static/images/articles/privacy.jpg',
    category: 'announcement',
    status: 'published',
    published_at: new Date(),
    view_count: 89,
    sort_order: 5
  }
];

// ============================================================
// 3. 违禁词库（3 条）
// ============================================================
const SEED_FORBIDDEN_WORDS = [
  {
    pattern: '确诊',
    message: '禁止使用"确诊"等医疗诊断用语',
    category: 'diagnosis',
    status: 'active',
    note: '医疗合规红线：系统不能替代医生进行诊断'
  },
  {
    pattern: '治愈.{0,5}(?:病|症|炎|癌|瘤)',
    message: '禁止承诺治愈疾病',
    category: 'promise',
    status: 'active',
    note: '医疗合规红线：不能承诺治疗效果'
  },
  {
    pattern: '服用.{0,5}(?:药|片|胶囊|颗粒|口服液)',
    message: '禁止推荐或暗示使用药物',
    category: 'treatment',
    status: 'active',
    note: '医疗合规红线：不能推荐用药方案'
  }
];

// ============================================================
// 4. 分润（3 条）
// ============================================================
const SEED_COMMISSIONS = [
  {
    period: '2026-07',
    source: 'gift_exchange',
    amount: 25.00,
    rate: 0.1000,
    base_amount: 250.00,
    status: 'pending',
    remark: '礼品兑换分润'
  },
  {
    period: '2026-07',
    source: 'write_off',
    amount: 15.00,
    rate: 0.0500,
    base_amount: 300.00,
    status: 'settled',
    remark: '积分核销分润',
    settled_at: new Date()
  },
  {
    period: '2026-06',
    source: 'member_service',
    amount: 50.00,
    rate: 0.1000,
    base_amount: 500.00,
    status: 'settled',
    remark: '会员服务分润',
    settled_at: new Date()
  }
];

// ============================================================
// 5. 积分记录（3 条）
// ============================================================
const SEED_POINTS_HISTORY = [
  {
    type: 'earn',
    points: 50,
    source: 'sign_in',
    description: '每日签到奖励',
    balance_after: 910
  },
  {
    type: 'earn',
    points: 30,
    source: 'clock_in_image',
    description: '图片打卡奖励',
    balance_after: 940
  },
  {
    type: 'spend',
    points: -200,
    source: 'gift_exchange',
    description: '兑换礼品：新鲜水果礼盒',
    balance_after: 740
  }
];

// ============================================================
// 6. 礼品订单（3 条）
// ============================================================
const SEED_GIFT_EXCHANGES = [
  {
    points: 200,
    cash_paid: 0,
    status: 'completed',
    write_off_code: 'WO20260701A',
    remark: '种子数据：兑换新鲜水果礼盒'
  },
  {
    points: 100,
    cash_paid: 0,
    status: 'pending',
    write_off_code: 'WO20260715B',
    remark: '种子数据：兑换10元健康优惠券'
  },
  {
    points: 500,
    cash_paid: 0,
    status: 'completed',
    write_off_code: 'WO20260720C',
    remark: '种子数据：兑换健康体检套餐'
  }
];

// ============================================================
// 执行种子数据插入
// ============================================================
async function seed() {
  try {
    console.log('🌱 开始种子数据初始化...\n');

    // 1. 用户
    console.log('--- 用户 ---');
    const users = [];
    for (const u of SEED_USERS) {
      const [user, created] = await db.User.findOrCreate({
        where: { openid: u.openid },
        defaults: u
      });
      users.push(user);
      console.log(created ? `✅ 创建用户: ${u.nick_name}` : `⏭️ 已存在: ${u.nick_name}`);
    }

    // 2. 资讯
    console.log('\n--- 资讯 ---');
    for (const a of SEED_ARTICLES) {
      const [article, created] = await db.Article.findOrCreate({
        where: { title: a.title },
        defaults: a
      });
      console.log(created ? `✅ 创建资讯: ${a.title.substring(0, 20)}...` : `⏭️ 已存在: ${a.title.substring(0, 20)}...`);
    }

    // 3. 违禁词
    console.log('\n--- 违禁词库 ---');
    for (const fw of SEED_FORBIDDEN_WORDS) {
      const [word, created] = await db.ForbiddenWord.findOrCreate({
        where: { pattern: fw.pattern, category: fw.category },
        defaults: fw
      });
      console.log(created ? `✅ 创建违禁词: ${fw.pattern}` : `⏭️ 已存在: ${fw.pattern}`);
    }

    // 4. 分润（需要 agent_id 和 user_id）
    console.log('\n--- 分润 ---');
    const agents = await db.User.findAll({ where: { role: 'agent' }, limit: 1 });
    const agentId = agents.length > 0 ? agents[0].id : users[0].id;
    for (const c of SEED_COMMISSIONS) {
      const [commission, created] = await db.Commission.findOrCreate({
        where: { period: c.period, source: c.source, amount: c.amount },
        defaults: {
          ...c,
          agent_id: agentId,
          user_id: users[0].id
        }
      });
      console.log(created ? `✅ 创建分润: ${c.period} ${c.source} ¥${c.amount}` : `⏭️ 已存在: ${c.period} ${c.source}`);
    }

    // 5. 积分记录
    console.log('\n--- 积分记录 ---');
    for (const ph of SEED_POINTS_HISTORY) {
      const [record, created] = await db.PointsHistory.findOrCreate({
        where: {
          user_id: users[0].id,
          type: ph.type,
          points: ph.points,
          source: ph.source
        },
        defaults: {
          ...ph,
          user_id: users[0].id
        }
      });
      console.log(created ? `✅ 创建积分记录: ${ph.type} ${ph.points} (${ph.source})` : `⏭️ 已存在: ${ph.type} ${ph.points} (${ph.source})`);
    }

    // 6. 礼品订单（需要 gift_id 和 user_id）
    console.log('\n--- 礼品订单 ---');
    const gifts = await db.Gift.findAll({ limit: 3 });
    if (gifts.length > 0) {
      for (let i = 0; i < SEED_GIFT_EXCHANGES.length; i++) {
        const ge = SEED_GIFT_EXCHANGES[i];
        const gift = gifts[i % gifts.length];
        const idempotencyKey = `SEED_${ge.write_off_code}`;
        const [exchange, created] = await db.GiftExchange.findOrCreate({
          where: { idempotency_key: idempotencyKey },
          defaults: {
            ...ge,
            user_id: users[i % users.length].id,
            gift_id: gift.id,
            idempotency_key: idempotencyKey
          }
        });
        console.log(created ? `✅ 创建订单: ${ge.write_off_code} (${ge.status})` : `⏭️ 已存在: ${ge.write_off_code}`);
      }
    } else {
      console.log('⚠️ 礼品表为空，请先运行 seed-gifts.js');
    }

    console.log('\n✅ 种子数据初始化完成');
    process.exit(0);
  } catch (err) {
    console.error('❌ 种子数据初始化失败:', err);
    process.exit(1);
  }
}

seed();
