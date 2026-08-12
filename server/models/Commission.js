// models/Commission.js - 分润结算模型
//
// 记录代理商/服务商的分润明细，按结算周期汇总。
// 来源包括：礼品核销、积分核销、会员服务等。
//
// 结算流程：
//   1. 业务发生时（核销/兑换）生成 status=pending 的分润记录
//   2. admin 按月汇总后批量结算，status 置为 settled
//   3. 异常情况可取消（status=cancelled）
//
// 幂等设计：reference_id + source 唯一约束，防止同一笔业务重复生成分润
module.exports = (sequelize, DataTypes) => {
  const Commission = sequelize.define('Commission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '代理商ID'
    },
    service_provider_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '服务商ID（如有）'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '产生分润的用户ID'
    },
    source: {
      type: DataTypes.ENUM('gift_exchange', 'write_off', 'member_service', 'other'),
      allowNull: false,
      comment: '分润来源'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: '分润金额（元）'
    },
    rate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: '分润比例（如 0.1000 = 10%）'
    },
    base_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: '分润基数（订单金额或积分等价金额）'
    },
    reference_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '关联业务ID（如 GiftExchange.id / PointsWriteOff.id）'
    },
    period: {
      type: DataTypes.STRING(7),
      allowNull: false,
      comment: '结算周期 YYYY-MM'
    },
    status: {
      type: DataTypes.ENUM('pending', 'settled', 'cancelled', 'rejected'),
      defaultValue: 'pending',
      comment: '状态：待结算/已结算/已取消/已驳回'
    },
    settled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '结算时间'
    },
    settled_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '结算人（admin user id）'
    },
    remark: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'commissions',
    indexes: [
      { name: 'commissions_agent_id', fields: ['agent_id'] },
      { name: 'commissions_service_provider_id', fields: ['service_provider_id'] },
      { name: 'commissions_status', fields: ['status'] },
      { name: 'commissions_period', fields: ['period'] },
      // 同一业务来源不重复生成分润（reference_id 可空，故不设唯一约束，由业务层保证）
      { name: 'commissions_source_reference_id', fields: ['source', 'reference_id'] }
    ]
  });

  return Commission;
};
