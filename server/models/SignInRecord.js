// models/SignInRecord.js - 每日签到记录模型
module.exports = (sequelize, DataTypes) => {
  const SignInRecord = sequelize.define('SignInRecord', {
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
    sign_in_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '签到日期'
    },
    points_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '获得积分'
    },
    consecutive_days: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '连续签到天数'
    }
  }, {
    tableName: 'sign_in_records',
    indexes: [
      { name: 'sign_in_records_user_id', fields: ['user_id'] },
      { name: 'sign_in_records_sign_in_date', fields: ['sign_in_date'] },
      { name: 'sign_in_records_user_id_sign_in_date', fields: ['user_id', 'sign_in_date'], unique: true }
    ]
  });

  return SignInRecord;
};