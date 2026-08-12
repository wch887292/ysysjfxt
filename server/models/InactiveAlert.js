// models/InactiveAlert.js - 久未活跃提醒模型
module.exports = (sequelize, DataTypes) => {
  const InactiveAlert = sequelize.define('InactiveAlert', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    service_provider_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    days_inactive: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '不活跃天数'
    },
    alert_type: {
      type: DataTypes.ENUM('system', 'agent_notified', 'provider_notified'),
      defaultValue: 'system'
    },
    notified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    followed_up_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    follow_up_result: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'inactive_alerts',
    indexes: [
      { name: 'inactive_alerts_user_id', fields: ['user_id'] },
      { name: 'inactive_alerts_agent_id', fields: ['agent_id'] },
      { name: 'inactive_alerts_service_provider_id', fields: ['service_provider_id'] },
      { name: 'inactive_alerts_days_inactive', fields: ['days_inactive'] }
    ]
  });

  return InactiveAlert;
};