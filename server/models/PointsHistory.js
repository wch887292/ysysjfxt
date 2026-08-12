// models/PointsHistory.js - 积分历史模型
module.exports = (sequelize, DataTypes) => {
  const PointsHistory = sequelize.define('PointsHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('earn', 'spend', 'adjust', 'write_off'),
      allowNull: false,
      comment: '类型: 获取/消耗/调整/核销'
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '积分数量(正数为获取,负数为消耗)'
    },
    source: {
      type: DataTypes.ENUM(
        'meal_upload', 'vegetable', 'fruit', 'water',
      'questionnaire', 'gift_exchange', 'agent_write_off', 'admin_adjust',
      'clock_in_icon', 'clock_in_image', 'course_learning', 'sign_in',
      'invite', 'invite_register', 'invite_active', 'invite_milestone',
      'other'
      ),
      allowNull: false,
      comment: '积分来源'
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '描述'
    },
    reference_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '关联ID(如餐食ID、礼品ID等)'
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '操作后余额'
    }
  }, {
    tableName: 'points_history',
    indexes: [
      { name: 'points_history_user_id', fields: ['user_id'] },
      { name: 'points_history_type', fields: ['type'] },
      { name: 'points_history_source', fields: ['source'] },
      { name: 'points_history_created_at', fields: ['created_at'] }
    ]
  });

  return PointsHistory;
};