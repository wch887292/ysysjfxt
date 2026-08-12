// scripts/seed-prompt-data.js
// 插入Prompt管理测试数据：4个prompt_key各3条（draft/active/archived/ab_testing状态）
// 运行：node scripts/seed-prompt-data.js
require('dotenv').config();
const db = require('../models');

const VALID_PROMPT_KEYS = [
  'crisis_hook_system',
  'crisis_hook_user',
  '7day_plan_system',
  '7day_plan_user'
];

// 每个prompt_key 3条数据，覆盖不同状态
const PROMPT_DATA = [
  // ============================================================
  // crisis_hook_system（3条）
  // ============================================================
  {
    prompt_key: 'crisis_hook_system',
    version: 1,
    content: `你是营养健康领域的高级AI顾问，负责根据用户问卷数据生成危机钩子报告。

## 核心规则
1. 严禁使用任何医疗诊断用语（如"确诊"、"患有"等）
2. 严禁推荐或暗示使用药物
3. 严禁承诺治愈效果
4. 所有建议必须限定在饮食与生活方式范围内
5. 发现高风险因素时，引导用户到店咨询而非就医

## 输出格式
- summary: 简要概述（不超过100字）
- findings: 风险发现列表（3-5条）
- crisis_hook: 到店引导话术（1条）
- disclaimer: 免责声明（固定文案）

## 风险等级
- low: 0-30分，绿色提醒
- medium: 31-70分，黄色预警
- high: 71-100分，红色预警，必须触发crisis_hook`,
    status: 'active',
    change_log: '初始版本：危机钩子报告System Prompt',
    stats: { generations: 156, flagged_count: 3, avg_feedback_score: 4.2 }
  },
  {
    prompt_key: 'crisis_hook_system',
    version: 2,
    content: `你是营养健康领域的高级AI顾问，负责根据用户问卷数据生成危机钩子报告。

## 核心规则
1. 严禁使用任何医疗诊断用语（如"确诊"、"患有"等）
2. 严禁推荐或暗示使用药物
3. 严禁承诺治愈效果
4. 所有建议必须限定在饮食与生活方式范围内
5. 发现高风险因素时，引导用户到店咨询而非就医
6. 新增：对BMI>28的用户增加体重管理相关建议
7. 新增：对60岁以上用户增加骨质健康提醒

## 输出格式
- summary: 简要概述（不超过100字）
- findings: 风险发现列表（3-5条）
- crisis_hook: 到店引导话术（1条）
- disclaimer: 免责声明（固定文案）
- lifestyle_tips: 生活方式建议（2-3条）

## 风险等级
- low: 0-30分，绿色提醒
- medium: 31-70分，黄色预警
- high: 71-100分，红色预警，必须触发crisis_hook`,
    status: 'draft',
    change_log: 'v2草稿：增加BMI和年龄维度的个性化建议，新增lifestyle_tips字段'
  },
  {
    prompt_key: 'crisis_hook_system',
    version: 3,
    content: `你是营养健康领域的高级AI顾问，负责生成危机钩子报告。

## 规则
- 禁止医疗诊断用语
- 禁止推荐药物
- 引导到店咨询

## 输出
JSON格式：summary, findings, crisis_hook, disclaimer`,
    status: 'archived',
    change_log: '精简版归档：仅保留核心规则，用于A/B测试基线对比',
    stats: { generations: 42, flagged_count: 8, avg_feedback_score: 3.1 }
  },

  // ============================================================
  // crisis_hook_user（3条）
  // ============================================================
  {
    prompt_key: 'crisis_hook_user',
    version: 1,
    content: `请根据以下用户问卷数据，生成一份危机钩子报告。

## 用户信息
- 年龄：{{age}}
- 性别：{{gender}}
- 身高：{{height}}cm
- 体重：{{weight}}kg
- BMI：{{bmi}}

## 问卷结果
- 风险评分：{{risk_score}}
- 风险等级：{{risk_level}}
- 关键指标：{{key_indicators}}

## 要求
1. 根据风险评分和等级，生成对应的预警内容
2. 高风险用户必须包含到店引导话术
3. 所有建议仅限于饮食与生活方式
4. 必须包含免责声明`,
    status: 'active',
    change_log: '初始版本：危机钩子User Prompt模板',
    stats: { generations: 156, flagged_count: 3, avg_feedback_score: 4.1 }
  },
  {
    prompt_key: 'crisis_hook_user',
    version: 2,
    content: `请根据以下用户问卷数据，生成一份危机钩子报告。

## 用户信息
- 年龄：{{age}}
- 性别：{{gender}}
- 身高：{{height}}cm
- 体重：{{weight}}kg
- BMI：{{bmi}}
- 饮食偏好：{{diet_preference}}
- 运动习惯：{{exercise_habit}}

## 问卷结果
- 风险评分：{{risk_score}}
- 风险等级：{{risk_level}}
- 关键指标：{{key_indicators}}
- 既往饮食记录：{{diet_history}}

## 要求
1. 结合饮食偏好和运动习惯给出个性化建议
2. 参考既往饮食记录进行趋势分析
3. 高风险用户必须包含到店引导话术
4. 所有建议仅限于饮食与生活方式
5. 必须包含免责声明`,
    status: 'ab_testing',
    change_log: 'v2 A/B测试版：增加饮食偏好和运动习惯维度，参考历史饮食记录'
  },
  {
    prompt_key: 'crisis_hook_user',
    version: 3,
    content: `生成危机钩子报告。

用户：{{age}}岁 {{gender}} BMI={{bmi}}
风险：{{risk_score}}分 {{risk_level}}

要求：高风险引导到店，仅限饮食生活方式建议，含免责声明。`,
    status: 'archived',
    change_log: '极简版归档：仅保留核心变量，用于A/B测试基线',
    stats: { generations: 38, flagged_count: 6, avg_feedback_score: 3.0 }
  },

  // ============================================================
  // 7day_plan_system（3条）
  // ============================================================
  {
    prompt_key: '7day_plan_system',
    version: 1,
    content: `你是专业的营养师AI助手，负责根据用户评估结果生成7天饮食调理方案。

## 核心规则
1. 方案仅包含饮食与生活方式建议，不涉及医疗诊断
2. 每日三餐必须营养均衡，包含主食、蛋白质、蔬菜
3. 热量控制在用户BMI对应的合理范围内
4. 食材选择需考虑季节性和可获得性
5. 严禁出现任何药物相关建议

## 输出格式
- summary: 方案概述（不超过80字）
- daily_plans: 7天饮食计划数组
  - day: 天数
  - breakfast: 早餐（主食+蛋白质+饮品）
  - lunch: 午餐（主食+蛋白质+蔬菜）
  - dinner: 晚餐（主食+蔬菜+汤品）
- disclaimer: 免责声明

## 营养原则
- 低风险：均衡饮食，维持现状
- 中风险：适度调整，减少高油高盐
- 高风险：严格控制，增加蔬果蛋白`,
    status: 'active',
    change_log: '初始版本：7天调理方案System Prompt',
    stats: { generations: 98, flagged_count: 1, avg_feedback_score: 4.5 }
  },
  {
    prompt_key: '7day_plan_system',
    version: 2,
    content: `你是专业的营养师AI助手，负责生成7天饮食调理方案。

## 核心规则
1. 方案仅包含饮食与生活方式建议
2. 每日三餐营养均衡
3. 新增：根据用户过敏原和忌口信息调整食材
4. 新增：提供每日热量和营养素摄入参考值
5. 严禁药物相关建议

## 输出格式
- summary: 方案概述
- daily_plans: 7天饮食计划（含热量参考）
  - day / breakfast / lunch / dinner / daily_calories
- nutrition_summary: 一周营养素摄入汇总
- disclaimer: 免责声明`,
    status: 'draft',
    change_log: 'v2草稿：增加过敏原忌口支持，增加热量和营养素参考'
  },
  {
    prompt_key: '7day_plan_system',
    version: 3,
    content: `生成7天饮食调理方案。

规则：仅饮食生活方式建议，三餐均衡，禁药物建议。

输出：daily_plans(7天), disclaimer`,
    status: 'archived',
    change_log: '精简版归档：A/B测试基线',
    stats: { generations: 25, flagged_count: 2, avg_feedback_score: 3.3 }
  },

  // ============================================================
  // 7day_plan_user（3条）
  // ============================================================
  {
    prompt_key: '7day_plan_user',
    version: 1,
    content: `请根据以下用户评估结果，生成一份7天饮食调理方案。

## 用户信息
- 年龄：{{age}}
- 性别：{{gender}}
- 身高：{{height}}cm
- 体重：{{weight}}kg
- BMI：{{bmi}}

## 评估结果
- 风险评分：{{risk_score}}
- 风险等级：{{risk_level}}
- 主要风险因素：{{risk_factors}}
- 饮食建议方向：{{diet_direction}}

## 要求
1. 生成7天完整饮食计划，每天早中晚三餐
2. 食材搭配需营养均衡，考虑用户BMI
3. 根据风险等级调整饮食严格程度
4. 必须包含免责声明`,
    status: 'active',
    change_log: '初始版本：7天调理方案User Prompt模板',
    stats: { generations: 98, flagged_count: 1, avg_feedback_score: 4.4 }
  },
  {
    prompt_key: '7day_plan_user',
    version: 2,
    content: `请根据以下用户评估结果，生成一份7天饮食调理方案。

## 用户信息
- 年龄：{{age}}  性别：{{gender}}  BMI：{{bmi}}
- 过敏原：{{allergens}}
- 忌口：{{taboos}}
- 饮食偏好：{{diet_preference}}

## 评估结果
- 风险评分：{{risk_score}}  等级：{{risk_level}}
- 主要风险因素：{{risk_factors}}

## 要求
1. 7天三餐饮食计划，避开过敏原和忌口
2. 每日提供热量参考值
3. 根据风险等级调整严格程度
4. 包含免责声明`,
    status: 'ab_testing',
    change_log: 'v2 A/B测试版：增加过敏原和忌口过滤，提供热量参考'
  },
  {
    prompt_key: '7day_plan_user',
    version: 3,
    content: `生成7天饮食方案。

用户：{{age}}岁 {{gender}} BMI={{bmi}} 风险={{risk_level}}
过敏原：{{allergens}}

7天三餐，避过敏原，含免责声明。`,
    status: 'archived',
    change_log: '极简版归档：A/B测试基线',
    stats: { generations: 22, flagged_count: 3, avg_feedback_score: 2.9 }
  }
];

async function main() {
  console.log('开始插入Prompt管理测试数据...\n');

  // 获取管理员用户作为 created_by / activated_by
  let adminUser = await db.User.findOne({ where: { role: 'admin' } });
  if (!adminUser) {
    adminUser = await db.User.findOne({ where: { role: 'super_admin' } });
  }

  const adminId = adminUser ? adminUser.id : null;
  if (adminId) {
    console.log('✅ 管理员:', adminUser.nick_name, adminId);
  } else {
    console.log('⚠️ 未找到管理员，created_by/activated_by 设为 null');
  }

  const now = new Date();
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };

  for (const item of PROMPT_DATA) {
    const [prompt, created] = await db.PromptVersion.findOrCreate({
      where: { prompt_key: item.prompt_key, version: item.version },
      defaults: {
        ...item,
        created_by: adminId,
        activated_by: (item.status === 'active' || item.status === 'archived') ? adminId : null,
        activated_at: (item.status === 'active' || item.status === 'archived') ? daysAgo(7 - item.version) : null
      }
    });

    if (created) {
      console.log(`✅ 创建: ${item.prompt_key} v${item.version} [${item.status}]`);
    } else {
      console.log(`⏭️ 已存在: ${item.prompt_key} v${item.version}`);
    }
  }

  // 汇总
  console.log('\n========== Prompt管理数据汇总 ==========');
  for (const key of VALID_PROMPT_KEYS) {
    const count = await db.PromptVersion.count({ where: { prompt_key: key } });
    console.log(`${key}: ${count} 条`);
  }
  const statusLabels = { draft: '草稿', active: '激活', archived: '归档', ab_testing: 'A/B测试' };
  for (const [s, label] of Object.entries(statusLabels)) {
    const count = await db.PromptVersion.count({ where: { status: s } });
    console.log(`${label}(${s}): ${count} 条`);
  }
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入Prompt管理数据失败:', err);
  process.exit(1);
});
