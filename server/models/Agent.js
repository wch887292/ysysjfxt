// models/Agent.js - 服务商Agent模型
const { encryptPhone, decryptPhone, maskPhone } = require('../utils/encrypt');

// 手机号正则（11位国内手机号）
const PHONE_REGEX = /^1[3-9]\d{9}$/;

module.exports = (sequelize, DataTypes) => {
  const Agent = sequelize.define('Agent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '关联的用户ID'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '服务商名称'
    },
    phone: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '加密存储的手机号'
    },
    phone_masked: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '服务商简介'
    },
    license_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '营业执照编号'
    },
    address: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'frozen', 'resigned'),
      defaultValue: 'active'
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否已认证'
    },
    service_provider_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    max_users: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      comment: '最大服务用户数'
    },
    share_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      comment: '分享码，如 AGT-XXXXXX'
    }
  }, {
    tableName: 'agents',
    indexes: [
      { name: 'agents_user_id', fields: ['user_id'] },
      { name: 'agents_status', fields: ['status'] },
      { name: 'agents_service_provider_id', fields: ['service_provider_id'] },
      { name: 'agents_share_code', fields: ['share_code'], unique: true }
    ]
  });

  // P0修复(方案12.1)：beforeSave钩子自动加密手机号，与User/ServiceProvider保持一致
  Agent.addHook('beforeSave', (instance) => {
    if (instance.changed('phone')) {
      const plain = instance.getDataValue('phone');
      if (plain === null || plain === undefined || plain === '') {
        instance.setDataValue('phone', null);
        instance.setDataValue('phone_masked', null);
      } else {
        const plainStr = String(plain);
        if (!PHONE_REGEX.test(plainStr)) {
          throw new Error('手机号格式不合法');
        }
        instance.setDataValue('phone', encryptPhone(plainStr));
        instance.setDataValue('phone_masked', maskPhone(plainStr));
      }
    }
    // 不允许直接通过外部修改 phone_masked
    if (instance.changed('phone_masked') && !instance.changed('phone')) {
      const prev = instance.previous('phone_masked');
      if (prev !== undefined) {
        instance.setDataValue('phone_masked', prev);
      }
    }
  });

  // 虚拟字段：解密手机号（仅内部使用）
  Agent.prototype.getDecryptedPhone = function() {
    return this.phone ? decryptPhone(this.phone) : null;
  };

  return Agent;
};