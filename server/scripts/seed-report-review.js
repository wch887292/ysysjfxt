// scripts/seed-report-review.js
// 插入报告复核测试数据：待复核3条、已通过3条、已驳回3条、已重写3条
// 运行：node scripts/seed-report-review.js
require('dotenv').config();
const db = require('../models');

const TEST_USER_NICK = '复核测试用户';
const TEST_ADMIN_NICK = '复核测试管理员';

async function main() {
  console.log('开始插入报告复核测试数据...\n');

  // 获取或创建测试用户
  let testUser = await db.User.findOne({ where: { nick_name: TEST_USER_NICK } });
  if (!testUser) {
    testUser = await db.User.create({
      openid: 'REVIEW_TEST_' + Date.now(),
      nick_name: TEST_USER_NICK,
      role: 'user',
      identity_type: 'user',
      status: 'active',
      is_member: true,
      points: 50,
      total_points: 100,
      gender: 'female',
      age: 28,
      height: 163,
      weight: 55
    });
    console.log('✅ 创建测试用户:', testUser.id);
  } else {
    console.log('⏭️ 测试用户已存在:', testUser.id);
  }

  // 获取已有的管理员用户（用于 reviewed_by），如无则用测试用户代替
  let adminUser = await db.User.findOne({ where: { role: 'admin' } });
  if (!adminUser) {
    adminUser = await db.User.findOne({ where: { role: 'super_admin' } });
  }
  if (!adminUser) {
    adminUser = testUser; // 没有管理员则用测试用户本身
    console.log('⚠️ 未找到管理员，使用测试用户作为复核人');
  } else {
    console.log('✅ 找到管理员:', adminUser.id, adminUser.nick_name);
  }

  const userId = testUser.id;
  const adminId = adminUser.id;
  const now = new Date();
  const hoursAgo = (h) => { const d = new Date(now); d.setHours(d.getHours() - h); return d; };
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };

  // ============================================================
  // 1. 待复核（pending）- 3条
  // ============================================================
  console.log('\n--- 待复核报告 ---');
  const pendingReports = [
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '高风险心血管预警报告',
      content: JSON.stringify({
        summary: '检测到多项心血管高风险指标，建议尽快就医检查。',
        findings: ['血压持续偏高', '心率异常波动', '家族遗传史风险'],
        crisis_hook: '建议您立即前往附近医院心内科进行专业检查。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 88, risk_level: 'high',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'pending',
      validation_errors: JSON.stringify([{ rule: 'no_diagnosis', matched: '确诊高血压' }])
    },
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '代谢综合征风险预警',
      content: JSON.stringify({
        summary: '综合评估显示存在代谢综合征风险，需关注血糖、血脂等指标。',
        findings: ['空腹血糖偏高', '腰围超标', '甘油三酯偏高'],
        crisis_hook: '建议到服务中心由专业营养师进行一对一代谢评估。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 75, risk_level: 'high',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'pending',
      validation_errors: JSON.stringify([{ rule: 'no_treatment_advice', matched: '建议服用降糖药' }])
    },
    {
      user_id: userId, report_type: '7day_plan',
      title: '高血糖人群7天饮食方案',
      content: JSON.stringify({
        summary: '针对血糖偏高的情况，制定了低GI饮食方案。',
        daily_plans: [
          { day: 1, breakfast: '燕麦粥+坚果', lunch: '糙米饭+清蒸鱼+西兰花', dinner: '杂粮粥+凉拌菜' },
          { day: 2, breakfast: '全麦面包+鸡蛋', lunch: '鸡胸肉沙拉', dinner: '紫薯+蔬菜汤' },
          { day: 3, breakfast: '豆浆+全麦馒头', lunch: '牛肉面+蔬菜', dinner: '玉米+清炒时蔬' }
        ],
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 68, risk_level: 'high',
      visible_to_guest: false, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'pending',
      validation_errors: JSON.stringify([{ rule: 'no_drug_reference', matched: '配合二甲双胍使用' }])
    }
  ];

  for (const d of pendingReports) {
    const [r, created] = await db.Report.findOrCreate({
      where: { user_id: d.user_id, title: d.title, report_type: d.report_type },
      defaults: d
    });
    if (!created && r.review_status !== 'pending') {
      await r.update({ review_status: 'pending', flagged: true, validation_errors: d.validation_errors });
    }
    console.log(created ? `✅ 待复核: ${d.title}` : `⏭️ 已存在: ${d.title}`);
  }

  // ============================================================
  // 2. 已通过（approved）- 3条
  // ============================================================
  console.log('\n--- 已通过报告 ---');
  const approvedReports = [
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '营养失衡风险评估报告',
      content: JSON.stringify({
        summary: '日常饮食结构不够均衡，部分营养素摄入不足。',
        findings: ['蛋白质摄入不足', '膳食纤维缺乏', '维生素D偏低'],
        crisis_hook: '建议到店进行详细的营养评估，获取个性化饮食指导。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 45, risk_level: 'medium',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'approved',
      review_remark: '报告内容合规，建议部分表述准确，予以通过',
      reviewed_by: adminId, reviewed_at: daysAgo(2)
    },
    {
      user_id: userId, report_type: '7day_plan',
      title: '亚健康人群7天调理方案',
      content: JSON.stringify({
        summary: '基于您的亚健康状态评估，制定了综合调理方案。',
        daily_plans: [
          { day: 1, breakfast: '小米粥+鸡蛋+蔬菜包', lunch: '米饭+清蒸鲈鱼+炒菠菜', dinner: '杂粮粥+凉拌木耳' },
          { day: 2, breakfast: '牛奶+全麦面包+水果', lunch: '鸡胸肉+糙米饭+西兰花', dinner: '蔬菜汤+红薯' },
          { day: 3, breakfast: '豆浆+燕麦+坚果', lunch: '牛肉+土豆+青菜', dinner: '小米粥+清炒豆角' }
        ],
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 40, risk_level: 'medium',
      visible_to_guest: false, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'approved',
      review_remark: '饮食方案合理，未涉及医疗建议，审核通过',
      reviewed_by: adminId, reviewed_at: daysAgo(1)
    },
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '睡眠质量改善预警报告',
      content: JSON.stringify({
        summary: '睡眠评估显示质量偏低，存在改善空间。',
        findings: ['入睡时间偏晚', '睡眠时长不足', '睡眠规律性差'],
        crisis_hook: '建议到店咨询，了解改善睡眠的专业方案。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 35, risk_level: 'medium',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'approved',
      review_remark: '内容合规，建议措辞恰当，通过审核',
      reviewed_by: adminId, reviewed_at: hoursAgo(6)
    }
  ];

  for (const d of approvedReports) {
    const [r, created] = await db.Report.findOrCreate({
      where: { user_id: d.user_id, title: d.title, report_type: d.report_type },
      defaults: d
    });
    if (!created && r.review_status !== 'approved') {
      await r.update({
        review_status: 'approved', flagged: true,
        review_remark: d.review_remark, reviewed_by: d.reviewed_by, reviewed_at: d.reviewed_at
      });
    }
    console.log(created ? `✅ 已通过: ${d.title}` : `⏭️ 已存在: ${d.title}`);
  }

  // ============================================================
  // 3. 已驳回（rejected）- 3条
  // ============================================================
  console.log('\n--- 已驳回报告 ---');
  const rejectedReports = [
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '糖尿病风险预警报告',
      content: JSON.stringify({
        summary: '血糖指标异常，存在糖尿病前期风险。',
        findings: ['空腹血糖偏高', '糖化血红蛋白偏高', '多饮多尿症状'],
        crisis_hook: '建议尽快到内分泌科就诊，进行糖耐量试验。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 82, risk_level: 'high',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rejected',
      validation_errors: JSON.stringify([
        { rule: 'no_diagnosis', matched: '糖尿病前期' },
        { rule: 'no_medical_advice', matched: '到内分泌科就诊' }
      ]),
      review_remark: '涉及疾病诊断和就医建议，超出服务范围，需重写',
      reviewed_by: adminId, reviewed_at: daysAgo(3)
    },
    {
      user_id: userId, report_type: '7day_plan',
      title: '高血压人群7天控压方案',
      content: JSON.stringify({
        summary: '针对高血压情况制定的饮食调理方案。',
        daily_plans: [
          { day: 1, breakfast: '低钠粥+全麦面包', lunch: '清蒸鱼+蔬菜+糙米饭', dinner: '蔬菜汤+杂粮饼' },
          { day: 2, breakfast: '脱脂牛奶+燕麦', lunch: '鸡胸肉+蔬菜沙拉', dinner: '红薯+清炒菜心' },
          { day: 3, breakfast: '豆浆+全麦馒头', lunch: '清蒸虾+西兰花+米饭', dinner: '冬瓜汤+杂粮饭' }
        ],
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 78, risk_level: 'high',
      visible_to_guest: false, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rejected',
      validation_errors: JSON.stringify([
        { rule: 'no_drug_reference', matched: '配合降压药服用' }
      ]),
      review_remark: '方案中提及药物配合使用，违反合规要求，驳回重写',
      reviewed_by: adminId, reviewed_at: daysAgo(2)
    },
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '肝脏健康风险报告',
      content: JSON.stringify({
        summary: '肝功能相关指标异常，需关注肝脏健康。',
        findings: ['转氨酶偏高', '脂肪肝倾向', '饮酒习惯风险'],
        crisis_hook: '建议到消化内科做进一步肝功能检查，排除肝脏疾病。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 72, risk_level: 'high',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rejected',
      validation_errors: JSON.stringify([
        { rule: 'no_medical_advice', matched: '做进一步肝功能检查' },
        { rule: 'no_diagnosis', matched: '排除肝脏疾病' }
      ]),
      review_remark: '包含明确就医建议和疾病排查指引，超出服务范围',
      reviewed_by: adminId, reviewed_at: daysAgo(1)
    }
  ];

  for (const d of rejectedReports) {
    const [r, created] = await db.Report.findOrCreate({
      where: { user_id: d.user_id, title: d.title, report_type: d.report_type },
      defaults: d
    });
    if (!created && r.review_status !== 'rejected') {
      await r.update({
        review_status: 'rejected', flagged: true,
        validation_errors: d.validation_errors,
        review_remark: d.review_remark, reviewed_by: d.reviewed_by, reviewed_at: d.reviewed_at
      });
    }
    console.log(created ? `✅ 已驳回: ${d.title}` : `⏭️ 已存在: ${d.title}`);
  }

  // ============================================================
  // 4. 已重写（rewritten）- 3条
  // ============================================================
  console.log('\n--- 已重写报告 ---');
  const rewrittenReports = [
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '饮食结构优化预警报告（重写版）',
      content: JSON.stringify({
        summary: '饮食评估显示结构不够均衡，建议调整饮食习惯。',
        findings: ['碳水化合物摄入偏高', '蔬菜水果摄入不足', '饮水习惯需改善'],
        crisis_hook: '建议到服务中心咨询营养师，获取个性化饮食改善方案。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 50, risk_level: 'medium',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rewritten',
      validation_errors: null,
      review_remark: '已重写，移除疾病诊断用语，改为生活方式建议，审核通过',
      reviewed_by: adminId, reviewed_at: hoursAgo(12)
    },
    {
      user_id: userId, report_type: '7day_plan',
      title: '体重管理7天饮食方案（重写版）',
      content: JSON.stringify({
        summary: '基于体重管理目标，制定了均衡饮食方案。',
        daily_plans: [
          { day: 1, breakfast: '燕麦粥+蓝莓+坚果', lunch: '糙米饭+清蒸鸡胸+西兰花', dinner: '蔬菜汤+全麦面包' },
          { day: 2, breakfast: '希腊酸奶+水果+燕麦', lunch: '三文鱼沙拉+全麦面包', dinner: '番茄蛋花汤+杂粮饭' },
          { day: 3, breakfast: '全麦吐司+牛油果+鸡蛋', lunch: '牛肉蔬菜卷+水果', dinner: '蘑菇汤+红薯' }
        ],
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 42, risk_level: 'medium',
      visible_to_guest: false, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rewritten',
      validation_errors: null,
      review_remark: '已重写移除药物建议，纯饮食方案合规，通过',
      reviewed_by: adminId, reviewed_at: hoursAgo(8)
    },
    {
      user_id: userId, report_type: 'crisis_hook',
      title: '肠胃调理建议报告（重写版）',
      content: JSON.stringify({
        summary: '饮食规律性和食物选择方面存在改善空间。',
        findings: ['进餐时间不规律', '辛辣刺激食物偏多', '膳食纤维摄入不足'],
        crisis_hook: '建议到店咨询营养师，制定规律的饮食调理计划。',
        disclaimer: '本报告为饮食与生活方式建议工具，不能替代任何医疗诊断、治疗及医嘱。'
      }),
      risk_score: 38, risk_level: 'low',
      visible_to_guest: true, ai_model: 'DeepSeek-V3',
      flagged: true, review_status: 'rewritten',
      validation_errors: null,
      review_remark: '重写后措辞合规，已移除所有医疗诊断表述',
      reviewed_by: adminId, reviewed_at: hoursAgo(3)
    }
  ];

  for (const d of rewrittenReports) {
    const [r, created] = await db.Report.findOrCreate({
      where: { user_id: d.user_id, title: d.title, report_type: d.report_type },
      defaults: d
    });
    if (!created && r.review_status !== 'rewritten') {
      await r.update({
        review_status: 'rewritten', flagged: true,
        validation_errors: d.validation_errors,
        review_remark: d.review_remark, reviewed_by: d.reviewed_by, reviewed_at: d.reviewed_at
      });
    }
    console.log(created ? `✅ 已重写: ${d.title}` : `⏭️ 已存在: ${d.title}`);
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log('\n========== 报告复核数据汇总 ==========');
  const statuses = ['pending', 'approved', 'rejected', 'rewritten'];
  const statusLabels = { pending: '待复核', approved: '已通过', rejected: '已驳回', rewritten: '已重写' };
  for (const s of statuses) {
    const count = await db.Report.count({ where: { review_status: s } });
    console.log(`${statusLabels[s]}(${s}): ${count} 条`);
  }
  console.log(`总计: ${await db.Report.count({ where: { user_id: userId } })} 条（测试用户）`);
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入报告复核数据失败:', err);
  process.exit(1);
});
