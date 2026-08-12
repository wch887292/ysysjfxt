// scripts/seed-publish-review.js
// 插入发布审核测试数据：Article 3条、AgentPost 3条、DataExportRequest 3条
// 运行：node scripts/seed-publish-review.js
require('dotenv').config();
const db = require('../models');

async function main() {
  console.log('开始插入发布审核测试数据...\n');

  // 获取管理员
  let adminUser = await db.User.findOne({ where: { role: 'admin' } });
  if (!adminUser) {
    adminUser = await db.User.findOne({ where: { role: 'super_admin' } });
  }
  const adminId = adminUser ? adminUser.id : null;
  if (adminId) {
    console.log('✅ 管理员:', adminUser.nick_name, adminId);
  }

  // 获取代理商
  let agent = await db.Agent.findOne({ where: { status: 'active' } });
  if (!agent) {
    agent = await db.Agent.findOne();
  }
  const agentId = agent ? agent.id : null;
  if (agentId) {
    console.log('✅ 代理商:', agent.name || agent.id, agentId);
  } else {
    console.log('⚠️ 未找到代理商，AgentPost 将无法创建');
  }

  // 获取测试用户
  let testUser = await db.User.findOne({ where: { nick_name: '测试用户', role: 'user' } });
  if (!testUser) {
    testUser = await db.User.findOne({ where: { role: 'user' } });
  }
  const userId = testUser ? testUser.id : null;
  if (userId) {
    console.log('✅ 测试用户:', testUser.nick_name, userId);
  }

  const now = new Date();
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  const hoursAgo = (h) => { const d = new Date(now); d.setHours(d.getHours() - h); return d; };

  // ============================================================
  // 1. Article 资讯/公告（3条，覆盖 draft/published/offline）
  // ============================================================
  console.log('\n--- 资讯/公告 ---');
  const articleData = [
    {
      title: '夏季饮食健康指南：如何科学补水与营养搭配',
      summary: '夏季高温环境下，人体水分和电解质流失加快，本文从饮食角度提供科学补水和营养搭配建议。',
      content: `# 夏季饮食健康指南

## 一、科学补水

夏季人体出汗量增大，不仅需要补充水分，还需注意电解质的平衡。

### 1.1 饮水量建议
- 成人每日建议饮水 2000-2500ml
- 运动后额外补充 500-1000ml
- 少量多次，避免一次性大量饮水

### 1.2 电解质补充
- 可适量饮用淡盐水或运动饮料
- 多吃含钾食物（香蕉、橙子、番茄）
- 避免过量饮用冰镇饮料

## 二、营养搭配原则

### 2.1 清淡为主
- 减少油炸、烧烤类食物
- 增加凉拌、蒸煮类菜肴
- 选择易消化的食材

### 2.2 蛋白质补充
- 优选鱼虾、鸡胸肉等低脂蛋白
- 豆制品是优质植物蛋白来源
- 每日蛋白质摄入不低于体重×0.8g

## 三、夏季推荐食材
- 瓜类：西瓜、黄瓜、冬瓜
- 豆类：绿豆、红豆、毛豆
- 蔬菜：苦瓜、丝瓜、番茄

> 免责声明：本文为饮食与生活方式建议，不能替代专业医疗诊断与治疗。`,
      cover_image: '/uploads/articles/summer-diet-cover.jpg',
      category: 'health_tips',
      status: 'published',
      author_id: adminId,
      published_at: daysAgo(5),
      view_count: 328,
      sort_order: 100
    },
    {
      title: '平台服务升级公告：新增AI营养师一对一咨询功能',
      summary: '为提升用户服务体验，平台新增AI营养师一对一咨询功能，会员用户可免费体验。',
      content: `# 平台服务升级公告

尊敬的用户：

为持续提升您的健康管理体验，我们于近日完成了以下服务升级：

## 新增功能

### AI营养师一对一咨询
- 基于您的健康评估数据，提供个性化饮食建议
- 支持文字交互，实时获取营养指导
- 会员用户每月可免费使用3次

### 饮食打卡AI评分优化
- 优化了AI对打卡图片的识别准确率
- 新增饮食搭配合理性的评分维度
- 评分结果更加细致和个性化

## 使用方式
1. 登录APP → 首页 → AI营养师
2. 选择咨询类型（饮食建议/营养搭配/体重管理）
3. 开始对话

> 如有任何问题，请联系客服。`,
      cover_image: '/uploads/articles/upgrade-notice.jpg',
      category: 'announcement',
      status: 'draft',
      author_id: adminId,
      published_at: null,
      view_count: 0,
      sort_order: 50
    },
    {
      title: '国庆假期健康饮食挑战赛回顾与获奖名单',
      summary: '国庆7天健康饮食挑战赛圆满结束，恭喜获奖用户！活动期间共收到超5000份打卡记录。',
      content: `# 国庆健康饮食挑战赛回顾

## 活动概况
- 参与人数：2,386人
- 打卡总数：5,127份
- 连续7天完成挑战：1,052人

## 获奖名单

### 一等奖（3名）
- 用户A：连续7天打卡 + AI评分平均90+
- 用户B：连续7天打卡 + AI评分平均88
- 用户C：连续7天打卡 + AI评分平均85

### 二等奖（10名）
连续7天打卡 + AI评分平均80+

### 参与奖
完成5天以上打卡的所有用户

## 积分发放
所有奖项积分将于3个工作日内发放到账。

> 感谢所有参与用户，下次活动敬请期待！`,
      cover_image: '/uploads/articles/challenge-review.jpg',
      category: 'activity',
      status: 'offline',
      author_id: adminId,
      published_at: daysAgo(30),
      view_count: 2156,
      sort_order: 10
    }
  ];

  for (const d of articleData) {
    const [r, created] = await db.Article.findOrCreate({
      where: { title: d.title },
      defaults: d
    });
    console.log(created ? `✅ 资讯[${d.status}]: ${d.title}` : `⏭️ 已存在: ${d.title}`);
  }

  // ============================================================
  // 2. AgentPost 代理商发布（3条，覆盖 pending_review/approved/rejected）
  // ============================================================
  console.log('\n--- 代理商发布 ---');
  if (!agentId) {
    console.log('⏭️ 跳过：未找到代理商');
  } else {
    const agentPostData = [
      {
        agent_id: agentId,
        company_name: agent.name || '健康管理中心',
        title: '春季养生讲座：中医饮食调理与健康管理',
        content: `# 春季养生讲座邀请

亲爱的会员朋友们：

我们将于4月15日举办"春季养生讲座"，特邀资深营养师现场分享中医饮食调理知识。

## 活动详情
- 时间：4月15日 14:00-16:00
- 地点：健康管理中心多功能厅
- 费用：会员免费，非会员98元/人

## 讲座内容
1. 春季饮食调理原则
2. 时令食材推荐与搭配
3. 常见体质的饮食方案
4. 现场互动答疑

## 报名方式
联系您的专属营养师或拨打客服热线报名。

名额有限，先到先得！`,
        images: JSON.stringify(['/uploads/agent/spring-lecture-1.jpg', '/uploads/agent/spring-lecture-2.jpg']),
        status: 'pending_review',
        idempotency_key: 'AP_POST_001_' + Date.now()
      },
      {
        agent_id: agentId,
        company_name: agent.name || '健康管理中心',
        title: '新店开业特惠：首次到店评估享5折优惠',
        content: `# 新店开业特惠

庆祝城南新区新店开业，推出限时优惠活动：

## 优惠内容
- 首次到店健康评估享5折优惠
- 会员推荐新客户到店，双方各获赠200积分
- 开业期间消费满500元赠送营养礼包一份

## 活动时间
即日起至5月31日

## 门店地址
城南新区健康大道88号 健康管理中心2楼

欢迎到店体验！`,
        images: JSON.stringify(['/uploads/agent/new-store.jpg']),
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: daysAgo(3),
        published_at: daysAgo(3),
        idempotency_key: 'AP_POST_002_' + Date.now()
      },
      {
        agent_id: agentId,
        company_name: agent.name || '健康管理中心',
        title: '独家秘方：三高人群必看的10种食疗偏方',
        content: `# 三高人群食疗偏方

以下偏方经过多年验证，效果显著：
1. 芹菜汁降压法...
2. 山楂降脂茶...
3. 苦瓜降糖法...

注意：以上偏方可替代部分药物治疗。`,
        images: null,
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: daysAgo(1),
        reject_reason: '内容涉及"替代药物治疗"等违规表述，违反平台禁止推荐药物和承诺疗效的规定，请修改后重新提交',
        idempotency_key: 'AP_POST_003_' + Date.now()
      }
    ];

    for (const d of agentPostData) {
      const [r, created] = await db.AgentPost.findOrCreate({
        where: { agent_id: d.agent_id, title: d.title },
        defaults: d
      });
      if (!created && r.status !== d.status) {
        await r.update({
          status: d.status,
          reviewed_by: d.reviewed_by,
          reviewed_at: d.reviewed_at,
          reject_reason: d.reject_reason
        });
      }
      console.log(created ? `✅ 代理商发布[${d.status}]: ${d.title}` : `⏭️ 已存在: ${d.title}`);
    }
  }

  // ============================================================
  // 3. DataExportRequest 数据导出/删除申请（3条，覆盖 pending/approved/rejected）
  // ============================================================
  console.log('\n--- 数据导出/删除申请 ---');
  if (!userId) {
    console.log('⏭️ 跳过：未找到测试用户');
  } else {
    const exportData = [
      {
        user_id: userId,
        type: 'export',
        reason: '我需要导出个人健康数据，用于线下就医时提供给医生参考',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        review_note: null
      },
      {
        user_id: userId,
        type: 'export',
        reason: '需要备份我的所有评估报告和饮食打卡记录',
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: daysAgo(2),
        review_note: '申请理由充分，已批准导出。数据包将在24小时内发送至注册邮箱。'
      },
      {
        user_id: userId,
        type: 'deletion',
        reason: '不再使用平台服务，要求删除全部个人数据',
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: daysAgo(1),
        review_note: '账号存在未完成的会员服务合约（有效期至2026-12-31），合约期内暂不支持数据删除。合约到期后可重新申请。'
      }
    ];

    for (const d of exportData) {
      // 避免重复：查找同 user_id + type + reason 的记录
      const existing = await db.DataExportRequest.findOne({
        where: { user_id: d.user_id, type: d.type, reason: d.reason }
      });
      if (!existing) {
        await db.DataExportRequest.create(d);
        console.log(`✅ 数据申请[${d.type}/${d.status}]: ${d.reason.substring(0, 20)}...`);
      } else {
        console.log(`⏭️ 已存在: ${d.type}/${d.status}`);
      }
    }
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log('\n========== 发布审核数据汇总 ==========');
  console.log('Article 资讯/公告:');
  for (const s of ['draft', 'published', 'offline']) {
    const count = await db.Article.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('AgentPost 代理商发布:');
  for (const s of ['pending_review', 'approved', 'rejected']) {
    const count = await db.AgentPost.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('DataExportRequest 数据申请:');
  for (const s of ['pending', 'approved', 'rejected', 'completed']) {
    const count = await db.DataExportRequest.count({ where: { status: s } });
    console.log(`  ${s}: ${count} 条`);
  }
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入发布审核数据失败:', err);
  process.exit(1);
});
