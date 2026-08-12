// models/Questionnaire.js - 问卷模型
module.exports = (sequelize, DataTypes) => {
  const Questionnaire = sequelize.define('Questionnaire', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    risk_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '健康风险评分'
    },
    risk_level: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true,
      comment: '风险等级'
    },
    recommendations: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'AI生成的饮食建议(JSON格式)'
    },
    declaration_acknowledged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '是否已确认声明'
    }
  }, {
    tableName: 'questionnaires',
    indexes: [
      { name: 'questionnaires_user_id', fields: ['user_id'] },
      { name: 'questionnaires_risk_level', fields: ['risk_level'] }
    ]
  });

  return Questionnaire;
};