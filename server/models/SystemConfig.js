// models/SystemConfig.js - 系统配置模型（方案6.1 "后台可配"）
//
// 通用配置表设计：用 config_key + config_value(JSON) 存储可配置业务规则，
// 避免在代码中硬编码积分规则、打卡上限、签到里程碑等业务参数。
//
// 配置项示例：
//   - sign_in.base_points      = 5            (每日签到基础积分)
//   - sign_in.milestones       = {"7":10,"30":30,"100":100}  (连续签到里程碑奖励)
//   - clock_in.daily_limit     = 3            (每日打卡上限)
//   - clock_in.points_icon     = 10           (图标打卡基础积分)
//   - clock_in.points_image    = 10           (图片打卡基础积分)
//   - clock_in.points_follow_plan = 20        (遵循饮食计划奖励)
//   - course.points            = 10           (课程学习积分)
//   - course.progress_threshold = 80          (课程积分发放进度阈值)
//   - invite.points_register   = 50           (拉新注册奖励)
//   - invite.points_active     = 100          (拉新活跃奖励)
//   - invite.points_milestone  = 200          (分享2名新客户里程碑奖励)
//   - invite.milestone_count   = 2            (里程碑触发人数)
//   - assessment.monthly_limit = 1            (会员每月评估次数上限)
module.exports = (sequelize, DataTypes) => {
  const SystemConfig = sequelize.define('SystemConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    config_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: '配置键，如 sign_in.milestones'
    },
    config_value: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '配置值（JSON 字符串）'
    },
    value_type: {
      type: DataTypes.ENUM('json', 'number', 'string', 'boolean'),
      allowNull: false,
      defaultValue: 'json',
      comment: '值类型，便于解析和前端展示'
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general',
      comment: '配置分类，如 sign_in / clock_in / points / invite'
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '配置说明'
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '最后更新人（admin user id）'
    }
  }, {
    tableName: 'system_configs',
    indexes: [
      { name: 'system_configs_category', fields: ['category'] }
    ]
  });

  return SystemConfig;
};
