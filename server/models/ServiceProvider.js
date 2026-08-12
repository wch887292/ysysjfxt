// models/ServiceProvider.js - 服务商模型
const { encryptPhone, decryptPhone, maskPhone } = require('../utils/encrypt');

// 手机号正则（11位国内手机号）
const PHONE_REGEX = /^1[3-9]\d{9}$/;

module.exports = (sequelize, DataTypes) => {
  const ServiceProvider = sequelize.define('ServiceProvider', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '企业名称'
    },
    phone: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'AES加密存储的电话'
    },
    phone_masked: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '脱敏显示的电话'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmailOrEmpty(value) {
          if (value && value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('邮箱格式不合法');
          }
        }
      }
    },
    address: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    license_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '营业执照'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending', 'rejected'),
      defaultValue: 'pending'
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'service_providers',
    indexes: [
      { name: 'service_providers_status', fields: ['status'] }
    ]
  });

  // V4修复：beforeSave钩子自动加密手机号
  ServiceProvider.addHook('beforeSave', (instance) => {
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
      // 忽略外部直接设置phone_masked，保留原值
      const prev = instance.previous('phone_masked');
      if (prev !== undefined) {
        instance.setDataValue('phone_masked', prev);
      }
    }
  });

  // 虚拟字段：解密手机号（仅内部使用）
  ServiceProvider.prototype.getDecryptedPhone = function() {
    return this.phone ? decryptPhone(this.phone) : null;
  };

  return ServiceProvider;
};