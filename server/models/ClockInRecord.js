// models/ClockInRecord.js - 每日打卡记录（图标/拍照双模式）
module.exports = (sequelize, DataTypes) => {
  const ClockInRecord = sequelize.define('ClockInRecord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '用户ID'
    },
    meal_type: {
      type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
      allowNull: false,
      comment: '餐食类型'
    },
    clock_in_type: {
      type: DataTypes.ENUM('icon', 'image'),
      allowNull: false,
      comment: '打卡类型：图标打卡/图片打卡'
    },
    food_icons: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '图标打卡选择的食物图标列表'
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '图片打卡上传的图片URL'
    },
    image_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '图片是否验证通过'
    },
    ai_food_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'AI识别的食物类型'
    },
    ai_health_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'AI健康评分(0-100)'
    },
    ai_description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'AI分析描述'
    },
    follow_plan: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否按计划执行'
    },
    points_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '获得积分'
    },
    clock_in_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '打卡日期'
    },
    clock_in_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '打卡时间'
    }
  }, {
    tableName: 'clock_in_records',
    indexes: [
      { name: 'clock_in_records_user_id', fields: ['user_id'] },
      { name: 'clock_in_records_clock_in_date', fields: ['clock_in_date'] },
      { name: 'clock_in_records_meal_type', fields: ['meal_type'] },
      { name: 'clock_in_records_clock_in_type', fields: ['clock_in_type'] },
      { name: 'clock_in_records_user_id_clock_in_date_meal_type', fields: ['user_id', 'clock_in_date', 'meal_type'], unique: true }
    ]
  });

  return ClockInRecord;
};
