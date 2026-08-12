// models/ServiceProviderReception.js - 服务商接待记录模型
module.exports = (sequelize, DataTypes) => {
  const ServiceProviderReception = sequelize.define('ServiceProviderReception', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    service_provider_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '服务商ID'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '客户用户ID'
    },
    reception_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '接待时间'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '沟通内容'
    },
    result: {
      type: DataTypes.ENUM('pending', 'converted', 'follow_up', 'lost'),
      defaultValue: 'pending',
      comment: '转化结果'
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '幂等键（防重复创建）'
    }
  }, {
    tableName: 'service_provider_receptions',
    indexes: [
      { name: 'service_provider_receptions_service_provider_id', fields: ['service_provider_id'] },
      { name: 'service_provider_receptions_user_id', fields: ['user_id'] },
      { name: 'service_provider_receptions_reception_time', fields: ['reception_time'] },
      // 幂等键唯一索引：同一幂等键不可重复创建
      { name: 'service_provider_receptions_idempotency_key', fields: ['idempotency_key'], unique: true }
    ]
  });

  return ServiceProviderReception;
};