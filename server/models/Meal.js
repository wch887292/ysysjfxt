// models/Meal.js - 餐食模型
module.exports = (sequelize, DataTypes) => {
  const Meal = sequelize.define('Meal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: '餐食图片URL'
    },
    meal_type: {
      type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack', 'other'),
      allowNull: false,
      comment: '餐食类型'
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '用户备注'
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
    points: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '获得积分'
    },
    content_safe: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '内容安全验证是否通过'
    },
    content_check_result: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '内容安全检测结果'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'approved',
      comment: '审核状态'
    },
    review_comment: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    upload_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'meals',
    indexes: [
      { name: 'meals_user_id', fields: ['user_id'] },
      { name: 'meals_meal_type', fields: ['meal_type'] },
      { name: 'meals_status', fields: ['status'] },
      { name: 'meals_upload_time', fields: ['upload_time'] }
    ]
  });

  return Meal;
};