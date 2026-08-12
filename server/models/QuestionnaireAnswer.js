// models/QuestionnaireAnswer.js - 问卷答案模型
// 规格8.1 health_assessment：每个答案带 category 分类，支持5类结构化分组
module.exports = (sequelize, DataTypes) => {
  const QuestionnaireAnswer = sequelize.define('QuestionnaireAnswer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    questionnaire_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    question_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '问题ID'
    },
    question_label: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '问题标签'
    },
    category: {
      type: DataTypes.ENUM('diet_habits', 'supplements', 'health_baseline', 'medical_history', 'lifestyle'),
      allowNull: false,
      defaultValue: 'diet_habits',
      comment: '健康评估分类（规格8.1：饮食习惯/营养补充/健康基线/病史/生活方式）'
    },
    answer: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '答案(JSON格式,支持多选)'
    }
  }, {
    tableName: 'questionnaire_answers',
    indexes: [
      { name: 'questionnaire_answers_questionnaire_id', fields: ['questionnaire_id'] },
      { name: 'questionnaire_answers_category', fields: ['category'] }
    ]
  });

  return QuestionnaireAnswer;
};