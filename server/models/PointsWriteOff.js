// models/PointsWriteOff.js - 积分核销模型
module.exports = (sequelize, DataTypes) => {
  const PointsWriteOff = sequelize.define('PointsWriteOff', {
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
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    gift_description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '礼品描述'
    },
    remark: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '幂等键，防止重复核销'
    },
    write_off_date: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'points_write_off',
    indexes: [
      { name: 'points_write_off_user_id', fields: ['user_id'] },
      { name: 'points_write_off_agent_id', fields: ['agent_id'] },
      { name: 'points_write_off_idempotency_key', fields: ['idempotency_key'], unique: true }
    ]
  });

  return PointsWriteOff;
};