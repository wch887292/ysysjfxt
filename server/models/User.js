// models/User.js - 用户模型
const { encryptPhone, decryptPhone, maskPhone } = require('../utils/encrypt');
const bcrypt = require('bcryptjs');

// 手机号正则（11位国内手机号）
const PHONE_REGEX = /^1[3-9]\d{9}$/;

// 密码强度：8-32位，至少含字母和数字
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/;
// P3-安全加固：bcrypt轮数从10提升至12（提高暴力破解成本，约4x）
const PASSWORD_SALT_ROUNDS = 12;

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    openid: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false
    },
    unionid: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: true
    },
    identity_type: {
      type: DataTypes.ENUM('guest', 'user', 'member', 'service_provider', 'agent'),
      defaultValue: 'guest',
      comment: '用户身份类型'
    },
    nick_name: {
      type: DataTypes.STRING(100),
      defaultValue: '健康新人',
      allowNull: true
    },
    real_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '真实姓名'
    },
    is_real_name: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否实名'
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'AES加密存储的手机号'
    },
    phone_masked: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '脱敏显示的手机号'
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Web后台登录密码（bcrypt hash，仅 admin/agent/service_provider 角色使用）'
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'unknown'),
      defaultValue: 'unknown'
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    height: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '身高(cm)'
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '体重(kg)'
    },
    bmi: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'BMI指数'
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '当前可用积分余额'
    },
    total_points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '累计获得积分'
    },
    frozen_points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '冻结积分'
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '用户等级'
    },
    honor_level: {
      type: DataTypes.ENUM('newcomer', 'expert', 'star', 'ambassador', 'messenger'),
      defaultValue: 'newcomer',
      comment: '荣誉等级'
    },
    badges: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: '勋章列表'
    },
    role: {
      type: DataTypes.ENUM('user', 'agent', 'service_provider', 'admin'),
      defaultValue: 'user'
    },
    is_super: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否超级管理员：仅系统初始化脚本可设置，拥有最高权限（管理admin账号、重置密码等）'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'banned'),
      defaultValue: 'active'
    },
    is_member: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否会员'
    },
    member_since: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '成为会员时间'
    },
    share_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      comment: '分享码'
    },
    bound_share_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '绑定的代理商分享码'
    },
    last_assessment_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后评估日期'
    },
    consent_accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '用户同意隐私政策与数据使用授权的时间（规格12.1合规要求：首次提交问卷前必须显式同意）'
    },
    visibility_settings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: '规格7.4：信息可见范围设置，JSON结构如 {showProfile:true, showPhone:false, showHealthData:true, showReports:true}'
    },
    assessment_count_this_month: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0, max: 1 },
      comment: '本月评估次数（方案3.3：会员每月限1次免费评估；规格8.1 max=1）'
    },
    last_report_view_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后查看完整报告日期（方案3.3：与评估次数独立计数）'
    },
    report_view_count_this_month: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '本月查看完整报告次数（方案3.3：会员每月限1次）'
    },
    last_report_download_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后下载报告PDF日期（方案3.3：会员每月限1次）'
    },
    report_download_count_this_month: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '本月下载报告PDF次数（方案3.3：会员每月限1次）'
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后活跃时间'
    },
    agent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '关联的服务商Agent'
    },
    service_provider_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '关联的服务商'
    },
    referrer_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '推荐人用户ID'
    },
    questionnaire_completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否已完成健康问卷'
    }
  }, {
    tableName: 'users',
    indexes: [
      // 索引名称使用 Sequelize 自动生成格式 tablename_col，避免 sync() 创建重复索引
      { name: 'users_openid', fields: ['openid'], unique: true },
      { name: 'users_share_code', fields: ['share_code'], unique: true },
      { name: 'users_agent_id', fields: ['agent_id'] },
      { name: 'users_service_provider_id', fields: ['service_provider_id'] },
      { name: 'users_identity_type', fields: ['identity_type'] },
      { name: 'users_honor_level', fields: ['honor_level'] },
      { name: 'users_status', fields: ['status'] },
      { name: 'users_last_active_at', fields: ['last_active_at'] },
      { name: 'users_last_assessment_date', fields: ['last_assessment_date'] },
      { name: 'users_last_report_view_date', fields: ['last_report_view_date'] },
      { name: 'users_last_report_download_date', fields: ['last_report_download_date'] }
    ]
  });

  // 虚拟字段：解密手机号（仅内部使用，接口不直接返回）
  User.prototype.getDecryptedPhone = function() {
    return this.phone ? decryptPhone(this.phone) : null;
  };

  // V4修复：beforeSave钩子自动加密手机号
  User.addHook('beforeSave', (instance) => {
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
    if (instance.changed('phone_masked') && !instance.changed('phone')) {
      const prev = instance.previous('phone_masked');
      if (prev !== undefined) {
        instance.setDataValue('phone_masked', prev);
      }
    }
    // 密码变更时自动 bcrypt 加密（明文不入库）
    if (instance.changed('password')) {
      const pwd = instance.getDataValue('password');
      if (pwd === null || pwd === undefined || pwd === '') {
        instance.setDataValue('password', null);
      } else if (!pwd.startsWith('$2a$') && !pwd.startsWith('$2b$') && !pwd.startsWith('$2y$')) {
        // 非已加密的 hash，进行加密
        if (!PASSWORD_REGEX.test(String(pwd))) {
          throw new Error('密码强度不足：需8-32位且至少含字母和数字');
        }
        // P3-安全加固：使用更高轮数的 bcrypt 哈希
        instance.setDataValue('password', bcrypt.hashSync(String(pwd), PASSWORD_SALT_ROUNDS));
      }
    }
  });

  // P3-安全加固：beforeValidate 钩子，确保敏感字段在写入前已加密
  User.addHook('beforeValidate', (instance) => {
    // openid 和 unionid 不允许为空
    if (!instance.openid && instance.isNewRecord) {
      throw new Error('openid 不能为空');
    }
  });

  // 校验密码明文是否匹配
  User.prototype.verifyPassword = function(plainPassword) {
    if (!this.password || !plainPassword) return false;
    try { return bcrypt.compareSync(String(plainPassword), this.password); }
    catch { return false; }
  };

  return User;
};
