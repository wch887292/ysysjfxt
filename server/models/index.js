// models/index.js - 数据库模型入口
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 数据库配置
const sequelize = new Sequelize(
  process.env.DB_NAME || 'diet_points_system',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    // 业务时区统一为 Asia/Shanghai (UTC+8)
    // - timezone: Sequelize 写入 JS Date 时的格式化时区
    // - dialectOptions.timezone: MySQL 会话时区（SET time_zone='+08:00'）
    // 确保 DB 存储的 DATETIME 与业务时区一致，避免服务器/DB 时区为 UTC 时边界偏移
    timezone: '+08:00',
    dialectOptions: {
      timezone: '+08:00'
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci'
    }
  }
);

const db = {};

// 引入模型
db.User = require('./User')(sequelize, DataTypes);
db.Agent = require('./Agent')(sequelize, DataTypes);
db.Meal = require('./Meal')(sequelize, DataTypes);
db.ClockInRecord = require('./ClockInRecord')(sequelize, DataTypes);
db.CourseRecord = require('./CourseRecord')(sequelize, DataTypes);
db.PointsHistory = require('./PointsHistory')(sequelize, DataTypes);
db.PointsWriteOff = require('./PointsWriteOff')(sequelize, DataTypes);
db.Gift = require('./Gift')(sequelize, DataTypes);
db.GiftExchange = require('./GiftExchange')(sequelize, DataTypes);
db.Questionnaire = require('./Questionnaire')(sequelize, DataTypes);
db.QuestionnaireAnswer = require('./QuestionnaireAnswer')(sequelize, DataTypes);
db.Report = require('./Report')(sequelize, DataTypes);
db.AgentPost = require('./AgentPost')(sequelize, DataTypes);
db.InactiveAlert = require('./InactiveAlert')(sequelize, DataTypes);
db.ServiceProvider = require('./ServiceProvider')(sequelize, DataTypes);
db.ServiceProviderReception = require('./ServiceProviderReception')(sequelize, DataTypes);
db.SignInRecord = require('./SignInRecord')(sequelize, DataTypes);
db.DataExportRequest = require('./DataExportRequest')(sequelize, DataTypes);
db.SystemConfig = require('./SystemConfig')(sequelize, DataTypes);
db.ReportFeedback = require('./ReportFeedback')(sequelize, DataTypes);
db.PromptVersion = require('./PromptVersion')(sequelize, DataTypes);
db.ForbiddenWord = require('./ForbiddenWord')(sequelize, DataTypes);
db.Article = require('./Article')(sequelize, DataTypes);
db.Commission = require('./Commission')(sequelize, DataTypes);

// 设置模型关联
// 用户 -> Agent
db.Agent.hasMany(db.User, { foreignKey: 'agent_id', as: 'users' });
db.User.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });
db.User.belongsTo(db.ServiceProvider, { foreignKey: 'service_provider_id', as: 'serviceProvider' });

// 用户自关联：推荐人 -> 被推荐人（补充：referrer_id 的关联定义）
db.User.belongsTo(db.User, { foreignKey: 'referrer_id', as: 'referrer' });
db.User.hasMany(db.User, { foreignKey: 'referrer_id', as: 'referrals' });

// 用户 -> 餐食
db.User.hasMany(db.Meal, { foreignKey: 'user_id', as: 'meals' });
db.Meal.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 积分历史
db.User.hasMany(db.PointsHistory, { foreignKey: 'user_id', as: 'pointsHistory' });
db.PointsHistory.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 积分核销
db.User.hasMany(db.PointsWriteOff, { foreignKey: 'user_id', as: 'writeOffs' });
db.PointsWriteOff.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// Agent -> 积分核销
db.Agent.hasMany(db.PointsWriteOff, { foreignKey: 'agent_id', as: 'writeOffs' });
db.PointsWriteOff.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });

// 礼品 -> 兑换记录
db.Gift.hasMany(db.GiftExchange, { foreignKey: 'gift_id', as: 'exchanges' });
db.GiftExchange.belongsTo(db.Gift, { foreignKey: 'gift_id', as: 'gift' });
db.User.hasMany(db.GiftExchange, { foreignKey: 'user_id', as: 'exchanges' });
db.GiftExchange.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 礼品 -> Agent（礼品所属服务商）
db.Agent.hasMany(db.Gift, { foreignKey: 'agent_id', as: 'gifts' });
db.Gift.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });

// 兑换记录 -> Agent（核销服务商）
db.Agent.hasMany(db.GiftExchange, { foreignKey: 'agent_id', as: 'exchanges' });
db.GiftExchange.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });

// 用户 -> 问卷（支持每月多次评估历史）
db.User.hasMany(db.Questionnaire, { foreignKey: 'user_id', as: 'questionnaires' });
db.Questionnaire.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 问卷 -> 问卷答案
db.Questionnaire.hasMany(db.QuestionnaireAnswer, { foreignKey: 'questionnaire_id', as: 'answers' });
db.QuestionnaireAnswer.belongsTo(db.Questionnaire, { foreignKey: 'questionnaire_id', as: 'questionnaire' });

// 用户 -> 久未活跃提醒
db.User.hasMany(db.InactiveAlert, { foreignKey: 'user_id', as: 'alerts' });
db.InactiveAlert.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
// InactiveAlert -> Agent
db.InactiveAlert.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });
// Agent -> InactiveAlert（补充：缺少的反向关联）
db.Agent.hasMany(db.InactiveAlert, { foreignKey: 'agent_id', as: 'alerts' });
// InactiveAlert -> ServiceProvider
db.InactiveAlert.belongsTo(db.ServiceProvider, { foreignKey: 'service_provider_id', as: 'serviceProvider' });
// ServiceProvider -> InactiveAlert（补充：缺少的反向关联）
db.ServiceProvider.hasMany(db.InactiveAlert, { foreignKey: 'service_provider_id', as: 'alerts' });

// 服务商 -> Agent
db.ServiceProvider.hasMany(db.Agent, { foreignKey: 'service_provider_id', as: 'agents' });
db.Agent.belongsTo(db.ServiceProvider, { foreignKey: 'service_provider_id', as: 'serviceProvider' });

// Agent -> User（补充：Agent.user_id 关联到 User）
db.Agent.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
db.User.hasOne(db.Agent, { foreignKey: 'user_id', as: 'agentAccount' });

// 服务商 -> 用户（补充：缺少的反向关联，与 User.belongsTo(ServiceProvider) 配套）
db.ServiceProvider.hasMany(db.User, { foreignKey: 'service_provider_id', as: 'users' });

// 用户 -> 打卡记录
db.User.hasMany(db.ClockInRecord, { foreignKey: 'user_id', as: 'clockInRecords' });
db.ClockInRecord.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 课程学习记录
db.User.hasMany(db.CourseRecord, { foreignKey: 'user_id', as: 'courseRecords' });
db.CourseRecord.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 报告
db.User.hasMany(db.Report, { foreignKey: 'user_id', as: 'reports' });
db.Report.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
// Report -> User(reviewer)（补充：reviewed_by 关联到审核人）
db.Report.belongsTo(db.User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// Agent -> 发布信息
db.Agent.hasMany(db.AgentPost, { foreignKey: 'agent_id', as: 'posts' });
db.AgentPost.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });
// AgentPost -> User(reviewer)（补充：reviewed_by 关联到审核人）
db.AgentPost.belongsTo(db.User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// 服务商 -> 接待记录
db.ServiceProvider.hasMany(db.ServiceProviderReception, { foreignKey: 'service_provider_id', as: 'receptions' });
db.ServiceProviderReception.belongsTo(db.ServiceProvider, { foreignKey: 'service_provider_id', as: 'serviceProvider' });
db.User.hasMany(db.ServiceProviderReception, { foreignKey: 'user_id', as: 'receptions' });
db.ServiceProviderReception.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 签到记录
db.User.hasMany(db.SignInRecord, { foreignKey: 'user_id', as: 'signInRecords' });
db.SignInRecord.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 数据导出/删除申请（规格7.4）
db.User.hasMany(db.DataExportRequest, { foreignKey: 'user_id', as: 'dataRequests' });
db.DataExportRequest.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
// DataExportRequest -> User(reviewer)（补充：reviewed_by 关联到审核人）
db.DataExportRequest.belongsTo(db.User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// AI 第5层闭环：报告 -> 反馈
db.Report.hasMany(db.ReportFeedback, { foreignKey: 'report_id', as: 'feedbacks' });
db.ReportFeedback.belongsTo(db.Report, { foreignKey: 'report_id', as: 'report' });
db.User.hasMany(db.ReportFeedback, { foreignKey: 'user_id', as: 'reportFeedbacks' });
db.ReportFeedback.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// 分润结算：Agent / ServiceProvider / User -> Commission
db.Agent.hasMany(db.Commission, { foreignKey: 'agent_id', as: 'commissions' });
db.Commission.belongsTo(db.Agent, { foreignKey: 'agent_id', as: 'agent' });
db.ServiceProvider.hasMany(db.Commission, { foreignKey: 'service_provider_id', as: 'commissions' });
db.Commission.belongsTo(db.ServiceProvider, { foreignKey: 'service_provider_id', as: 'serviceProvider' });
db.User.hasMany(db.Commission, { foreignKey: 'user_id', as: 'commissions' });
db.Commission.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
// Commission -> User(settler)（补充：settled_by 关联到结算人）
db.Commission.belongsTo(db.User, { foreignKey: 'settled_by', as: 'settler' });

// 资讯文章：User(作者) -> Article
db.User.hasMany(db.Article, { foreignKey: 'author_id', as: 'articles' });
db.Article.belongsTo(db.User, { foreignKey: 'author_id', as: 'author' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;