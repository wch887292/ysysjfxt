// models/CourseRecord.js - 课程学习记录
module.exports = (sequelize, DataTypes) => {
  const CourseRecord = sequelize.define('CourseRecord', {
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
    course_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: '课程ID'
    },
    course_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '课程名称'
    },
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '学习进度(0-100)'
    },
    points_earned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '已获得积分'
    },
    study_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: '学习日期'
    }
  }, {
    tableName: 'course_records',
    indexes: [
      { name: 'course_records_user_id', fields: ['user_id'] },
      { name: 'course_records_course_id', fields: ['course_id'] },
      { name: 'course_records_study_date', fields: ['study_date'] },
      { name: 'course_records_user_id_course_id_study_date', fields: ['user_id', 'course_id', 'study_date'], unique: true }
    ]
  });

  return CourseRecord;
};
