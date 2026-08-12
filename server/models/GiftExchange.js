// models/GiftExchange.js - 礼品兑换记录模型
module.exports = (sequelize, DataTypes) => {
  const GiftExchange = sequelize.define('GiftExchange', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    gift_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '消耗积分'
    },
    cash_paid: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '已支付现金（单位：分，0表示纯积分兑换）'
    },
    payment_order_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: '微信支付订单号（混合支付时记录，便于对账退款）'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'refunded'),
      defaultValue: 'pending',
      comment: '状态：待核销/已核销/已取消/已退款'
    },
    write_off_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '核销码'
    },
    write_off_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '核销日期'
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '核销服务商'
    },
    remark: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '幂等键，防止双击/重试双扣'
    }
  }, {
    tableName: 'gift_exchanges',
    indexes: [
      { name: 'gift_exchanges_user_id', fields: ['user_id'] },
      { name: 'gift_exchanges_gift_id', fields: ['gift_id'] },
      { name: 'gift_exchanges_status', fields: ['status'] },
      { name: 'gift_exchanges_write_off_code', fields: ['write_off_code'] },
      { name: 'gift_exchanges_idempotency_key', fields: ['idempotency_key'], unique: true }
    ]
  });

  return GiftExchange;
};