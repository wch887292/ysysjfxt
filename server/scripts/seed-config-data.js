// scripts/seed-config-data.js
// 插入系统配置虚拟数据：签到3条、打卡3条、课程3条、邀请3条、评估3条
// 运行：node scripts/seed-config-data.js
require('dotenv').config();
const db = require('../models');

// 配置数据定义：每个分类3条
const CONFIG_DATA = [
  // ============================================================
  // 签到配置（3条）
  // ============================================================
  {
    config_key: 'sign_in.base_points',
    config_value: '5',
    value_type: 'number',
    category: 'sign_in',
    description: '每日签到基础积分'
  },
  {
    config_key: 'sign_in.milestones',
    config_value: JSON.stringify({ 7: 10, 30: 30, 100: 100 }),
    value_type: 'json',
    category: 'sign_in',
    description: '连续签到里程碑奖励（天数:积分）'
  },
  {
    config_key: 'sign_in.consecutive_bonus',
    config_value: '3',
    value_type: 'number',
    category: 'sign_in',
    description: '连续签到3天及以上每日额外奖励积分'
  },

  // ============================================================
  // 打卡配置（3条）
  // ============================================================
  {
    config_key: 'clock_in.daily_limit',
    config_value: '3',
    value_type: 'number',
    category: 'clock_in',
    description: '每日打卡次数上限'
  },
  {
    config_key: 'clock_in.points_icon',
    config_value: '10',
    value_type: 'number',
    category: 'clock_in',
    description: '图标打卡基础积分'
  },
  {
    config_key: 'clock_in.points_image',
    config_value: '15',
    value_type: 'number',
    category: 'clock_in',
    description: '图片打卡基础积分（含AI识别）'
  },

  // ============================================================
  // 课程配置（3条）
  // ============================================================
  {
    config_key: 'course.points',
    config_value: '20',
    value_type: 'number',
    category: 'course',
    description: '课程学习完成积分（进度≥阈值时发放）'
  },
  {
    config_key: 'course.progress_threshold',
    config_value: '80',
    value_type: 'number',
    category: 'course',
    description: '课程积分发放进度阈值（%）'
  },
  {
    config_key: 'course.daily_study_limit',
    config_value: '5',
    value_type: 'number',
    category: 'course',
    description: '每日课程积分获取上限次数'
  },

  // ============================================================
  // 邀请配置（3条）
  // ============================================================
  {
    config_key: 'invite.points_register',
    config_value: '50',
    value_type: 'number',
    category: 'invite',
    description: '拉新注册奖励（被推荐人完成首评估）'
  },
  {
    config_key: 'invite.points_active',
    config_value: '100',
    value_type: 'number',
    category: 'invite',
    description: '拉新活跃奖励（被推荐人7天真实活跃）'
  },
  {
    config_key: 'invite.points_milestone',
    config_value: '200',
    value_type: 'number',
    category: 'invite',
    description: '分享N名新客户里程碑奖励'
  },

  // ============================================================
  // 评估配置（3条）
  // ============================================================
  {
    config_key: 'assessment.monthly_limit',
    config_value: '1',
    value_type: 'number',
    category: 'assessment',
    description: '会员每月免费评估次数上限'
  },
  {
    config_key: 'assessment.risk_threshold_low',
    config_value: '30',
    value_type: 'number',
    category: 'assessment',
    description: '低风险等级阈值（评分≤此值为低风险）'
  },
  {
    config_key: 'assessment.risk_threshold_high',
    config_value: '70',
    value_type: 'number',
    category: 'assessment',
    description: '高风险等级阈值（评分≥此值为高风险）'
  }
];

async function main() {
  console.log('开始插入系统配置数据...\n');

  for (const item of CONFIG_DATA) {
    const [config, created] = await db.SystemConfig.findOrCreate({
      where: { config_key: item.config_key },
      defaults: item
    });

    if (created) {
      console.log(`✅ 创建配置: ${item.config_key} = ${item.config_value} [${item.category}]`);
    } else {
      // 已存在则更新值
      await config.update({
        config_value: item.config_value,
        value_type: item.value_type,
        category: item.category,
        description: item.description
      });
      console.log(`🔄 更新配置: ${item.config_key} = ${item.config_value} [${item.category}]`);
    }
  }

  // 汇总
  console.log('\n========== 配置数据汇总 ==========');
  const categories = ['sign_in', 'clock_in', 'course', 'invite', 'assessment'];
  for (const cat of categories) {
    const count = await db.SystemConfig.count({ where: { category: cat } });
    console.log(`${cat}: ${count} 条`);
  }
  console.log('================================');

  process.exit(0);
}

main().catch(err => {
  console.error('插入配置数据失败:', err);
  process.exit(1);
});
