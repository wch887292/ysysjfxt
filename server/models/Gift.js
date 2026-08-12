// models/Gift.js - 礼品模型
module.exports = (sequelize, DataTypes) => {
  const Gift = sequelize.define('Gift', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '礼品名称'
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '礼品描述'
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '礼品图片URL'
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '兑换所需积分'
    },
    cash_price: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '现金价格（单位：分，0表示纯积分兑换；>0需配合微信支付，方案3.4线上商城积分+现金）'
    },
    category: {
      type: DataTypes.ENUM('food', 'health', 'service', 'coupon', 'other'),
      defaultValue: 'other',
      comment: '礼品类别'
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: -1,
      comment: '库存数量(-1表示无限)'
    },
    sold_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '已兑换数量'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'sold_out'),
      defaultValue: 'active'
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '所属服务商'
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'gifts',
    indexes: [
      { name: 'gifts_status', fields: ['status'] },
      { name: 'gifts_category', fields: ['category'] },
      { name: 'gifts_agent_id', fields: ['agent_id'] }
    ]
  });

  return Gift;
};