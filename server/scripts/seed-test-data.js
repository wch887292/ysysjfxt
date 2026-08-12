// scripts/seed-test-data.js
// 插入测试虚拟数据：签到3条、打卡3条、课程3条、邀请3条、评估3条
// 运行：node scripts/seed-test-data.js
require('dotenv').config();
const db = require('../models');

// 使用已有的普通用户，如不存在则创建
const TEST_USER_NICK = '测试用户';
const REFERRER_NICK = '邀请人';

async function main() {
  console.log('开始插入测试数据...\n');

  // 获取或创建测试用户
  let testUser = await db.User.findOne({ where: { nick_name: TEST_USER_NICK, role: 'user' } });
  if (!testUser) {
    testUser = await db.User.create({
      openid: 'TEST_USER_' + Date.now(),
      nick_name: TEST_USER_NICK,
      role: 'user',
      identity_type: 'user',
      status: 'active',
      is_member: true,
      points: 100,
      total_points: 200,
      gender: 'male',
      age: 35,
      height: 172,
      weight: 70
    });
    console.log('✅ 创建测试用户:', testUser.id);
  } else {
    console.log('⏭️ 测试用户已存在:', testUser.id);
  }

  // 获取或创建邀请人
  let referrer = await db.User.findOne({ where: { nick_name: REFERRER_NICK, role: 'user' } });
  if (!referrer) {
    referrer = await db.User.create({
      openid: 'REFERRER_' + Date.now(),
      nick_name: REFERRER_NICK,
      role: 'user',
      identity_type: 'user',
      status: 'active',
      points: 50,
      total_points: 150,
      share_code: 'SHARE' + Date.now().toString(36).toUpperCase()
    });
    console.log('✅ 创建邀请人:', referrer.id);
  } else {
    console.log('⏭️ 邀请人已存在:', referrer.id);
  }

  const userId = testUser.id;
  const referrerId = referrer.id;
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };

  // ============================================================
  // 1. 签到记录（3条）
  // ============================================================
  console.log('\n--- 签到记录 ---');
  const signInData = [
    { user_id: userId, sign_in_date: daysAgo(2), points_earned: 5, consecutive_days: 1 },
    { user_id: userId, sign_in_date: daysAgo(1), points_earned: 5, consecutive_days: 2 },
    { user_id: userId, sign_in_date: fmt(today), points_earned: 10, consecutive_days: 3 },
  ];
  for (const d of signInData) {
    const [r, created] = await db.SignInRecord.findOrCreate({
      where: { user_id: d.user_id, sign_in_date: d.sign_in_date },
      defaults: d
    });
    console.log(created ? `✅ 签到: ${d.sign_in_date} +${d.points_earned}分` : `⏭️ 已存在: ${d.sign_in_date}`);
  }

  // ============================================================
  // 2. 打卡记录（3条）
  // ============================================================
  console.log('\n--- 打卡记录 ---');
  const clockInData = [
    {
      user_id: userId, meal_type: 'breakfast', clock_in_type: 'icon',
      food_icons: ['rice', 'egg', 'milk'], follow_plan: true,
      points_earned: 10, clock_in_date: daysAgo(1),
      ai_food_type: '早餐', ai_health_score: 82,
      ai_description: '营养均衡的早餐，包含碳水化合物、蛋白质和钙质'
    },
    {
      user_id: userId, meal_type: 'lunch', clock_in_type: 'icon',
      food_icons: ['rice', 'chicken', 'vegetable'], follow_plan: true,
      points_earned: 10, clock_in_date: daysAgo(1),
      ai_food_type: '午餐', ai_health_score: 78,
      ai_description: '荤素搭配合理，蛋白质和膳食纤维摄入充足'
    },
    {
      user_id: userId, meal_type: 'dinner', clock_in_type: 'image',
      image_url: '/uploads/test-dinner.jpg', image_verified: true,
      follow_plan: false, points_earned: 5, clock_in_date: fmt(today),
      ai_food_type: '晚餐', ai_health_score: 65,
      ai_description: '晚餐偏油腻，建议减少油炸食品摄入，增加蔬菜比例'
    },
  ];
  for (const d of clockInData) {
    const [r, created] = await db.ClockInRecord.findOrCreate({
      where: { user_id: d.user_id, clock_in_date: d.clock_in_date, meal_type: d.meal_type },
      defaults: d
    });
    console.log(created ? `✅ 打卡: ${d.clock_in_date} ${d.meal_type} +${d.points_earned}分` : `⏭️ 已存在: ${d.clock_in_date} ${d.meal_type}`);
  }

  // ============================================================
  // 3. 课程学习记录（3条）
  // ============================================================
  console.log('\n--- 课程学习记录 ---');
  const courseData = [
    {
      user_id: userId, course_id: 'course_nutrition_101', course_name: '基础营养学',
      progress: 100, points_earned: 20, study_date: daysAgo(3)
    },
    {
      user_id: userId, course_id: 'course_healthy_eating', course_name: '健康饮食指南',
      progress: 60, points_earned: 10, study_date: daysAgo(1)
    },
    {
      user_id: userId, course_id: 'course_weight_mgmt', course_name: '体重管理入门',
      progress: 30, points_earned: 0, study_date: fmt(today)
    },
  ];
  for (const d of courseData) {
    const [r, created] = await db.CourseRecord.findOrCreate({
      where: { user_id: d.user_id, course_id: d.course_id, study_date: d.study_date },
      defaults: d
    });
    console.log(created ? `✅ 课程: ${d.course_name} 进度${d.progress}%` : `⏭️ 已存在: ${d.course_name}`);
  }

  // ============================================================
  // 4. 邀请/拉新记录（3条被邀请用户）
  // ============================================================
  console.log('\n--- 邀请/拉新记录 ---');
  const inviteNames = ['被邀请人A', '被邀请人B', '被邀请人C'];
  for (let i = 0; i < inviteNames.length; i++) {
    let invitedUser = await db.User.findOne({ where: { nick_name: inviteNames[i] } });
    if (!invitedUser) {
      invitedUser = await db.User.create({
        openid: 'INVITED_' + Date.now() + '_' + i,
        nick_name: inviteNames[i],
        role: 'user',
        identity_type: 'user',
        status: 'active',
        points: 0,
        total_points: 0,
        referrer_id: referrerId,
        bound_share_code: referrer.share_code
      });
      console.log(`✅ 邀请: ${inviteNames[i]} (推荐人: ${REFERRER_NICK})`);
    } else {
      console.log(`⏭️ 已存在: ${inviteNames[i]}`);
    }
  }

  // ============================================================
  // 5. 评估记录（问卷+报告，各3条）
  // ============================================================
  console.log('\n--- 评估记录 ---');

  // 问卷
  const questionnaireData = [
    {
      user_id: userId, completed: true, risk_score: 25, risk_level: 'low',
      declaration_acknowledged: true,
      recommendations: JSON.stringify({
        diet: '增加蔬菜和水果摄入，减少高油高盐食物',
        exercise: '建议每日步行30分钟以上',
        sleep: '保持规律作息，建议23点前入睡'
      })
    },
    {
      user_id: userId, completed: true, risk_score: 55, risk_level: 'medium',
      declaration_acknowledged: true,
      recommendations: JSON.stringify({
        diet: '控制碳水化合物摄入，增加优质蛋白',
        exercise: '建议每周3-4次有氧运动，每次30分钟',
        sleep: '避免睡前使用电子设备，建议22:30前入睡'
      })
    },
    {
      user_id: userId, completed: true, risk_score: 80, risk_level: 'high',
      declaration_acknowledged: true,
      recommendations: JSON.stringify({
        diet: '严格控制糖分和脂肪摄入，建议咨询专业营养师',
        exercise: '建议在医生指导下进行适量运动',
        sleep: '存在睡眠障碍风险，建议就医评估'
      })
    },
  ];

  for (const d of questionnaireData) {
    const existing = await db.Questionnaire.findOne({
      where: { user_id: d.user_id, risk_level: d.risk_level, completed: true },
      order: [['created_at', 'DESC']]
    });
    if (!existing) {
      const q = await db.Questionnaire.create(d);
      console.log(`✅ 问卷: risk_level=${d.risk_level} score=${d.risk_score}`);
    } else {
      console.log(`⏭️ 问卷已存在: risk_level=${d.risk_level}`);
    }
  }

  // 报告
  const reportData = [
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '健康风险评估报告',
      content: JSON.stringify({
        summary: '根据您的问卷数据，我们发现了一些需要关注的健康风险因素。',
        findings: ['BMI偏高，建议控制体重', '饮食结构不够均衡', '运动量不足'],
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。所有健康决策应咨询专业医师。'
      }),
      risk_score: 55, risk_level: 'medium',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: false, review_status: 'approved'
    },
    {
      user_id: userId, report_type: '7day_plan',
      title: '7天饮食调理方案',
      content: JSON.stringify({
        summary: '基于您的健康评估结果，为您制定了7天饮食调理方案。',
        daily_plans: [
          { day: 1, breakfast: '全麦面包+鸡蛋+牛奶', lunch: '糙米饭+清蒸鱼+西兰花', dinner: '杂粮粥+凉拌菜' },
          { day: 2, breakfast: '燕麦粥+坚果', lunch: '鸡胸肉沙拉', dinner: '紫薯+蔬菜汤' },
          { day: 3, breakfast: '豆浆+全麦馒头', lunch: '牛肉面+蔬菜', dinner: '玉米+清炒时蔬' }
        ],
        disclaimer: '本方案为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。所有健康决策应咨询专业医师。'
      }),
      risk_score: 45, risk_level: 'medium',
      visible_to_guest: false, ai_model: 'DeepSeek-V3',
      flagged: false, review_status: 'approved'
    },
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '高风险健康预警报告',
      content: JSON.stringify({
        summary: '您的健康评估显示存在多项高风险因素，建议尽快到店进行专业咨询。',
        findings: ['血压风险偏高', '睡眠质量严重不足', '饮食习惯需大幅改善'],
        crisis_hook: '建议您尽快到就近的服务中心，由专业营养师进行一对一健康评估和指导。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。所有健康决策应咨询专业医师。'
      }),
      risk_score: 85, risk_level: 'high',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'pending'
    },
  ];

  for (const d of reportData) {
    const existing = await db.Report.findOne({
      where: { user_id: d.user_id, report_type: d.report_type, title: d.title }
    });
    if (!existing) {
      const r = await db.Report.create(d);
      console.log(`✅ 报告: ${d.title} (${d.report_type})`);
    } else {
      console.log(`⏭️ 报告已存在: ${d.title}`);
    }
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log('\n========== 数据汇总 ==========');
  console.log('签到记录:', await db.SignInRecord.count({ where: { user_id: userId } }));
  console.log('打卡记录:', await db.ClockInRecord.count({ where: { user_id: userId } }));
  console.log('课程记录:', await db.CourseRecord.count({ where: { user_id: userId } }));
  console.log('被邀请用户:', await db.User.count({ where: { referrer_id: referrerId } }));
  console.log('问卷记录:', await db.Questionnaire.count({ where: { user_id: userId } }));
  console.log('报告记录:', await db.Report.count({ where: { user_id: userId } }));
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入测试数据失败:', err);
  process.exit(1);
});
