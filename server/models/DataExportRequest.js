// models/DataExportRequest.js - 数据导出/删除申请（规格7.4：数据导出/删除支持）
module.exports = (sequelize, DataTypes) => {
  const DataExportRequest = sequelize.define('DataExportRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    type: {
      type: DataTypes.ENUM('export', 'deletion'),
      allowNull: false,
      comment: '申请类型：导出 / 删除'
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '申请原因（用户填写）'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      comment: '审核状态：待处理 / 已批准 / 已拒绝 / 已完成'
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '审核人（管理员ID）'
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    review_note: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '审核备注'
    }
  }, {
    tableName: 'data_export_requests',
    underscored: true,
    indexes: [
      { name: 'data_export_requests_user_id', fields: ['user_id'] },
      { name: 'data_export_requests_status', fields: ['status'] },
      { name: 'data_export_requests_user_id_type_status', fields: ['user_id', 'type', 'status'] }
    ]
  });

  return DataExportRequest;
};
