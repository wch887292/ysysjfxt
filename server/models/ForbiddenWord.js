// models/ForbiddenWord.js - 违禁词库模型（方案5.5 医疗红线可后台维护）
//
// 用于替代 reportGenerator.js 中硬编码的 FORBIDDEN_PATTERNS 数组，
// 让运营/合规团队可在后台动态增删违禁词规则，无需发版。
//
// 设计要点：
// 1. pattern 存储正则表达式字符串（如 "确诊"、"患有.{0,10}(?:病|症|炎|癌|瘤)"）
// 2. category 分类：diagnosis/治疗/承诺/恐吓/其他，便于分组管理
// 3. status=active 的规则才会被 reportGenerator 加载
// 4. reportGenerator 启动时加载到内存缓存，通过 invalidateForbiddenCache() 失效
module.exports = (sequelize, DataTypes) => {
  const ForbiddenWord = sequelize.define('ForbiddenWord', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    pattern: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: '正则表达式字符串（如 确诊、患有.{0,10}(?:病|症|炎|癌|瘤)）'
    },
    message: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '命中时的提示信息'
    },
    category: {
      type: DataTypes.ENUM('diagnosis', 'treatment', 'promise', 'intimidation', 'other'),
      defaultValue: 'other',
      comment: '违禁词分类：诊断/治疗/承诺/恐吓/其他'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      comment: '状态：启用/停用'
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '备注（说明添加原因或上下文限制）'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '创建人（admin user id）'
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '最后更新人'
    }
  }, {
    tableName: 'forbidden_words',
    indexes: [
      { name: 'forbidden_words_status', fields: ['status'] },
      { name: 'forbidden_words_category', fields: ['category'] }
    ]
  });

  return ForbiddenWord;
};
