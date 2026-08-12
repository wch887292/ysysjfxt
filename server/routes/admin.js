// routes/admin.js - 管理后台路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { adminOnly, superAdminOnly } = require('../middleware/auth');

// 所有Admin路由需要admin权限
router.use(adminOnly);

/**
 * P0修复：转义SQL LIKE通配符（%和_），防止通配符注入导致全表扫描DoS
 * 输入 "%%%" → 转义为 "\\%\\%\\%"，匹配字面百分号而非任意字符串
 */
function escapeLikeWildcard(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

/**
 * 获取管理统计数据（超级管理员/管理员统计所有数据）
 * GET /api/admin/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    // 时间基准（Asia/Shanghai）
    const _now = new Date();
    const todayStart = new Date(Date.UTC(_now.getUTCFullYear(), _now.getUTCMonth(), _now.getUTCDate()) - 8 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 基础计数
    const totalUsers = await db.User.count({ where: { role: 'user' } });
    const totalAgents = await db.Agent.count({ where: { status: 'active' } });
    const totalServiceProviders = await db.ServiceProvider.count({ where: { status: 'active' } });
    const totalAdmins = await db.User.count({ where: { role: 'admin' } });

    // 积分统计
    const totalPointsIssued = await db.User.sum('total_points', { where: { role: 'user' } }) || 0;
    const totalPointsUsed = Math.abs(await db.PointsHistory.sum('points', {
      where: { type: { [db.Sequelize.Op.in]: ['spend', 'write_off'] } }
    })) || 0;

    // 活跃统计
    const activeUsersToday = await db.User.count({ where: { role: 'user', last_active_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const activeUsersWeek = await db.User.count({ where: { role: 'user', last_active_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const activeUsersMonth = await db.User.count({ where: { role: 'user', last_active_at: { [db.Sequelize.Op.gte]: monthStart } } });

    // 业务统计
    const totalMeals = await db.Meal.count();
    const todayCheckIns = await db.ClockInRecord.count({ where: { created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const todaySignIns = await db.SignInRecord.count({ where: { created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalCourses = await db.CourseRecord.count();
    const todayCourses = await db.CourseRecord.count({ where: { created_at: { [db.Sequelize.Op.gte]: todayStart } } });

    // 订单/礼品/分润
    const totalGifts = await db.Gift.count();
    const totalExchanges = await db.GiftExchange.count();
    const todayExchanges = await db.GiftExchange.count({ where: { created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalCommissions = await db.Commission.count();
    const pendingCommissions = await db.Commission.count({ where: { status: 'pending' } });
    const settledCommissions = await db.Commission.count({ where: { status: 'settled' } });

    // 报告
    const totalReports = await db.Report.count();
    const pendingReports = await db.Report.count({ where: { flagged: true, review_status: 'pending' } });

    // 发布审核
    const pendingPosts = await db.AgentPost.count({ where: { status: 'pending_review' } });

    // 新增用户
    const newUsersToday = await db.User.count({ where: { role: 'user', created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const newUsersWeek = await db.User.count({ where: { role: 'user', created_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const newUsersMonth = await db.User.count({ where: { role: 'user', created_at: { [db.Sequelize.Op.gte]: monthStart } } });

    // 会员统计
    const totalMembers = await db.User.count({ where: { role: 'user', is_member: true } });

    return success(res, {
      // 用户
      totalUsers, totalMembers, totalAgents, totalServiceProviders, totalAdmins,
      newUsersToday, newUsersWeek, newUsersMonth,
      // 活跃
      activeUsersToday, activeUsersWeek, activeUsersMonth,
      // 积分
      totalPointsIssued, totalPointsUsed,
      // 业务
      totalMeals, todayCheckIns, todaySignIns, totalCourses, todayCourses,
      // 商品/订单
      totalGifts, totalExchanges, todayExchanges,
      // 分润
      totalCommissions, pendingCommissions, settledCommissions,
      // 审核
      totalReports, pendingReports, pendingPosts
    });
  } catch (err) {
    logger.error('获取管理统计数据失败:', err);
    return fail(res, '获取统计数据失败');
  }
});

/**
 * 获取代理商发布信息列表（待审核/全部）
 * GET /api/admin/posts
 */
router.get('/posts', async (req, res) => {
  try {
    // V7修复：限制pageSize上限，并校验status白名单
    const ALLOWED_STATUS = ['all', 'pending_review', 'approved', 'rejected'];
    const status = ALLOWED_STATUS.includes(req.query.status) ? req.query.status : 'pending_review';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows } = await db.AgentPost.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      include: [{ model: db.Agent, as: 'agent', attributes: ['id', 'name'] }]
    });

    return success(res, {
      posts: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取代理商发布列表失败:', err);
    return fail(res, '获取列表失败');
  }
});

/**
 * 审核代理商发布信息
 * PUT /api/admin/posts/:id/review
 */
router.put('/posts/:id/review', async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    const postId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      return fail(res, '无效的审核状态');
    }
    if (rejectReason !== undefined && rejectReason !== null) {
      if (typeof rejectReason !== 'string' || rejectReason.length > 500) {
        return fail(res, '拒绝原因长度超限');
      }
    }

    const post = await db.AgentPost.findByPk(postId);
    if (!post) {
      return fail(res, '发布信息不存在');
    }

    const updateData = {
      status,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      reject_reason: rejectReason || null
    };
    if (status === 'approved') {
      updateData.published_at = new Date();
    }

    await post.update(updateData);

    logger.info(`管理员审核发布信息: ${postId}, 状态${status}`);
    return success(res, {
      postId: post.id,
      status: post.status,
      publishedAt: post.published_at
    }, '审核完成');
  } catch (err) {
    logger.error('审核发布信息失败:', err);
    return fail(res, '审核失败');
  }
});

// ============================================================
// 系统配置管理（方案6.1 "后台可配"）
// ============================================================
const configCache = require('../utils/configCache');

/**
 * 获取所有配置项（含默认值）
 * GET /api/admin/config
 * 支持按分类筛选：?category=sign_in
 */
router.get('/config', async (req, res) => {
  try {
    const { category } = req.query;
    const defaults = configCache.getDefaults();

    // 合并 DB 配置和默认值
    const result = [];
    const categories = category
      ? [category]
      : [...new Set(Object.values(defaults).map(d => d.category))];

    for (const cat of categories) {
      const dbConfig = await configCache.getCategory(db, cat);
      for (const [key, def] of Object.entries(defaults)) {
        if (def.category !== cat) continue;
        result.push({
          key,
          value: dbConfig[key] !== undefined ? dbConfig[key] : def.value,
          type: def.type,
          category: def.category,
          description: def.description,
          isDefault: dbConfig[key] === undefined // 标识是否使用默认值
        });
      }
    }

    return success(res, { configs: result, total: result.length }, '获取配置成功');
  } catch (err) {
    logger.error('获取系统配置失败:', err);
    return fail(res, '获取配置失败');
  }
});

/**
 * 更新单个配置项
 * PUT /api/admin/config/:key
 * body: { value, description? }
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const defaults = configCache.getDefaults();
    const def = defaults[key];
    if (!def) {
      return fail(res, `未知的配置键: ${key}`);
    }

    // 校验 value 类型
    let configValue;
    let valueType = def.type;
    if (def.type === 'json') {
      if (typeof value !== 'object' || value === null) {
        return fail(res, `配置 ${key} 需要 JSON 对象`);
      }
      configValue = JSON.stringify(value);
    } else if (def.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return fail(res, `配置 ${key} 需要数字类型`);
      }
      configValue = String(value);
    } else if (def.type === 'boolean') {
      configValue = String(!!value);
    } else {
      configValue = String(value);
    }

    // 业务校验：里程碑天数必须为正整数，积分必须为非负
    if (key === 'sign_in.milestones') {
      for (const [day, pts] of Object.entries(value)) {
        const d = Number(day);
        if (!Number.isInteger(d) || d <= 0) {
          return fail(res, `里程碑天数 ${day} 必须为正整数`);
        }
        if (typeof pts !== 'number' || pts < 0) {
          return fail(res, `里程碑 ${day} 天的积分必须为非负数`);
        }
      }
    }
    if (def.type === 'number' && key.endsWith('points') && value < 0) {
      return fail(res, `积分配置 ${key} 不能为负数`);
    }

    // upsert 配置
    const [config, created] = await db.SystemConfig.findOrCreate({
      where: { config_key: key },
      defaults: {
        config_key: key,
        config_value: configValue,
        value_type: valueType,
        category: def.category,
        description: description || def.description,
        updated_by: req.user.id
      }
    });

    if (!created) {
      config.config_value = configValue;
      config.value_type = valueType;
      config.category = def.category;
      if (description) config.description = description;
      config.updated_by = req.user.id;
      await config.save();
    }

    // 立即失效缓存，让下次请求读到新值
    configCache.invalidate(def.category);

    logger.info(`系统配置更新: ${key}=${configValue} (by ${req.user.id})`);

    return success(res, {
      key,
      value: def.type === 'json' ? value : (def.type === 'number' ? Number(configValue) : configValue),
      type: valueType,
      category: def.category,
      description: config.description
    }, '配置更新成功');
  } catch (err) {
    logger.error('更新系统配置失败:', err);
    return fail(res, '更新配置失败');
  }
});

/**
 * 重置单个配置为默认值
 * POST /api/admin/config/:key/reset
 */
router.post('/config/:key/reset', async (req, res) => {
  try {
    const { key } = req.params;
    const defaults = configCache.getDefaults();
    const def = defaults[key];
    if (!def) {
      return fail(res, `未知的配置键: ${key}`);
    }

    await db.SystemConfig.destroy({ where: { config_key: key } });
    configCache.invalidate(def.category);

    logger.info(`系统配置重置为默认值: ${key} (by ${req.user.id})`);

    return success(res, {
      key,
      value: def.value,
      type: def.type,
      category: def.category,
      description: def.description,
      isDefault: true
    }, '已重置为默认值');
  } catch (err) {
    logger.error('重置系统配置失败:', err);
    return fail(res, '重置失败');
  }
});

// ============================================================
// AI 第5层闭环：报告复核（方案5.1 优化层）
// ============================================================

/**
 * 获取待复核/已复核的报告列表
 * GET /api/admin/reports/flagged?reviewStatus=pending&page=1&pageSize=20
 *
 * 筛选：
 *   - flagged=true 的报告（第4层命中医疗红线或用户反馈医疗越界）
 *   - reviewStatus: pending/approved/rejected/rewritten（默认 pending）
 */
router.get('/reports/flagged', async (req, res) => {
  try {
    // P0修复：reviewStatus 白名单校验 + 分页参数规范化（原 NaN 会传播到 limit/offset）
    const ALLOWED_REVIEW_STATUS = ['pending', 'approved', 'rejected', 'rewritten', 'all'];
    const reviewStatus = ALLOWED_REVIEW_STATUS.includes(req.query.reviewStatus) ? req.query.reviewStatus : 'pending';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    const where = { flagged: true };
    if (reviewStatus !== 'all') {
      where.review_status = reviewStatus;
    }

    const { count, rows } = await db.Report.findAndCountAll({
      where,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] },
        { model: db.ReportFeedback, as: 'feedbacks', required: false }
      ],
      order: [['generate_date', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, {
      reports: rows,
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    logger.error('获取待复核报告列表失败:', err);
    return fail(res, '获取列表失败');
  }
});

/**
 * 获取报告复核详情（含内容、验证错误、用户反馈）
 * GET /api/admin/reports/:id/review
 */
router.get('/reports/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.Report.findByPk(id, {
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] },
        { model: db.ReportFeedback, as: 'feedbacks', include: [
          { model: db.User, as: 'user', attributes: ['id', 'nick_name'] }
        ]}
      ]
    });

    if (!report) {
      return fail(res, '报告不存在');
    }

    return success(res, {
      report: {
        id: report.id,
        reportType: report.report_type,
        title: report.title,
        content: report.content,
        riskScore: report.risk_score,
        riskLevel: report.risk_level,
        aiModel: report.ai_model,
        aiParams: report.ai_params,
        flagged: report.flagged,
        validationErrors: report.validation_errors,
        reviewStatus: report.review_status,
        reviewRemark: report.review_remark,
        reviewedBy: report.reviewed_by,
        reviewedAt: report.reviewed_at,
        generateDate: report.generate_date,
        user: report.user,
        feedbacks: (report.feedbacks || []).map(f => ({
          id: f.id,
          feedbackType: f.feedback_type,
          issueCategory: f.issue_category,
          content: f.content,
          createdAt: f.created_at,
          user: f.user
        }))
      }
    });
  } catch (err) {
    logger.error('获取报告复核详情失败:', err);
    return fail(res, '获取详情失败');
  }
});

/**
 * 复核报告（通过/拒绝/标记需重写）
 * PUT /api/admin/reports/:id/review
 * body: { action: 'approve'|'reject'|'rewrite', remark }
 */
router.put('/reports/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remark } = req.body;

    const validActions = ['approve', 'reject', 'rewrite'];
    if (!validActions.includes(action)) {
      return fail(res, 'action 必须为 approve/reject/rewrite');
    }

    const report = await db.Report.findByPk(id);
    if (!report) {
      return fail(res, '报告不存在');
    }
    if (!report.flagged) {
      return fail(res, '该报告未被标记，无需复核');
    }

    const statusMap = { approve: 'approved', reject: 'rejected', rewrite: 'rewritten' };
    await report.update({
      review_status: statusMap[action],
      review_remark: remark || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date()
    });

    // 同步标记关联反馈为已处理
    await db.ReportFeedback.update(
      { handled: true },
      { where: { report_id: id } }
    );

    logger.info(`报告复核: report=${id}, action=${action}, admin=${req.user.id}`);

    return success(res, {
      reportId: report.id,
      reviewStatus: statusMap[action]
    }, '复核完成');
  } catch (err) {
    logger.error('报告复核失败:', err);
    return fail(res, '复核失败');
  }
});

/**
 * 触发报告重新生成（复核 action=rewrite 后调用）
 * POST /api/admin/reports/:id/rewrite
 *
 * 注意：重新生成会调用 AI 模型，可能耗时 10-30s。
 *       原报告保留为历史记录，新生成的报告 flagged/review_status 重置。
 */
router.post('/reports/:id/rewrite', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await db.Report.findByPk(id);
    if (!report) {
      return fail(res, '报告不存在');
    }

    // P0修复：状态守卫——已重写的报告不能再次触发重写，避免并发重复生成
    if (report.review_status === 'rewritten') {
      return fail(res, '该报告已触发过重写，请勿重复操作');
    }

    // P0修复：幂等锁——通过 review_status 原子更新判断是否抢到重写权
    // 使用 where 条件确保只有非 rewritten 状态才能更新成功，防止并发双击
    const [affectedCount] = await db.Report.update(
      {
        review_status: 'rewritten',
        review_remark: (report.review_remark || '') + ' [已触发重写]',
        reviewed_by: req.user.id,
        reviewed_at: new Date()
      },
      {
        where: { id, review_status: { [db.Sequelize.Op.ne]: 'rewritten' } }
      }
    );
    if (affectedCount === 0) {
      return fail(res, '该报告已触发过重写，请勿重复操作');
    }

    // 查找用户的最新问卷用于重新生成
    const questionnaire = await db.Questionnaire.findOne({
      where: { user_id: report.user_id },
      order: [['created_at', 'DESC']]
    });

    if (!questionnaire) {
      return fail(res, '找不到用户问卷，无法重新生成');
    }

    // P0修复：空指针保护——用户被删除时给出明确错误而非 setImmediate 内崩溃
    const user = await db.User.findByPk(report.user_id);
    if (!user) {
      return fail(res, '用户不存在，无法重新生成报告');
    }

    // 异步重新生成（不阻塞响应）
    const { generateCrisisHookReport, generate7DayPlan } = require('../services/reportGenerator');
    const answers = await db.QuestionnaireAnswer.findAll({
      where: { questionnaire_id: questionnaire.id }
    });

    setImmediate(async () => {
      try {
        if (report.report_type === 'crisis_hook') {
          const data = await generateCrisisHookReport(user, questionnaire, answers, { generateDate: new Date() });
          await db.Report.create({
            user_id: report.user_id,
            report_type: 'crisis_hook',
            title: data.title,
            content: data.content,
            risk_score: data.riskScore,
            risk_level: data.riskLevel,
            visible_to_guest: data.visibleToGuest,
            ai_model: data.aiModel,
            ai_params: { ...data.aiParams, validationErrors: data.validationErrors, flagged: data.flagged, rewritten_from: report.id },
            flagged: data.flagged,
            validation_errors: data.validationErrors,
            review_status: data.flagged ? 'pending' : null
          });
        } else {
          const data = await generate7DayPlan(user, questionnaire, answers);
          await db.Report.create({
            user_id: report.user_id,
            report_type: '7day_plan',
            title: data.title,
            content: data.content,
            risk_score: data.riskScore,
            risk_level: data.riskLevel,
            visible_to_guest: data.visibleToGuest,
            ai_model: data.aiModel,
            ai_params: { ...data.aiParams, validationErrors: data.validationErrors, flagged: data.flagged, rewritten_from: report.id },
            flagged: data.flagged,
            validation_errors: data.validationErrors,
            review_status: data.flagged ? 'pending' : null
          });
        }
        logger.info(`报告重写完成: original=${id}, user=${report.user_id}`);
      } catch (err) {
        logger.error(`报告重写失败: original=${id},`, err);
      }
    });

    return success(res, { originalReportId: id }, '已触发重新生成，新报告将在 30 秒内生成');
  } catch (err) {
    logger.error('触发报告重写失败:', err);
    return fail(res, '触发重写失败');
  }
});

/**
 * 获取反馈统计（供后台 dashboard）
 * GET /api/admin/reports/feedback-stats
 */
router.get('/reports/feedback-stats', async (req, res) => {
  try {
    const [likes, dislikes, issues, pendingFlagged, totalFlagged] = await Promise.all([
      db.ReportFeedback.count({ where: { feedback_type: 'like' } }),
      db.ReportFeedback.count({ where: { feedback_type: 'dislike' } }),
      db.ReportFeedback.count({ where: { feedback_type: 'issue' } }),
      db.Report.count({ where: { flagged: true, review_status: 'pending' } }),
      db.Report.count({ where: { flagged: true } })
    ]);

    // 按问题分类统计
    const issueCategories = await db.ReportFeedback.findAll({
      where: { feedback_type: 'issue' },
      attributes: ['issue_category', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['issue_category'],
      raw: true
    });

    return success(res, {
      feedback: { likes, dislikes, issues },
      flagged: { pending: pendingFlagged, total: totalFlagged },
      issueCategories
    });
  } catch (err) {
    logger.error('获取反馈统计失败:', err);
    return fail(res, '获取统计失败');
  }
});

// ============================================================
// AI 第5层闭环：Prompt 版本管理（方案5.1 优化层）
// ============================================================

// 合法的 prompt_key 白名单（与 reportGenerator.js 对应）
const VALID_PROMPT_KEYS = [
  'crisis_hook_system',
  'crisis_hook_user',
  '7day_plan_system',
  '7day_plan_user'
];

/**
 * 获取 Prompt 版本列表
 * GET /api/admin/prompts?promptKey=crisis_hook_system&status=active
 */
router.get('/prompts', async (req, res) => {
  try {
    const { promptKey, status } = req.query;
    const where = {};
    if (promptKey) where.prompt_key = promptKey;
    if (status) where.status = status;

    const { count, rows } = await db.PromptVersion.findAndCountAll({
      where,
      order: [['prompt_key', 'ASC'], ['version', 'DESC']],
      limit: 50
    });

    return success(res, { prompts: rows, total: count });
  } catch (err) {
    logger.error('获取 Prompt 版本列表失败:', err);
    return fail(res, '获取列表失败');
  }
});

/**
 * 创建新 Prompt 版本
 * POST /api/admin/prompts
 * body: { promptKey, content, changeLog }
 */
router.post('/prompts', async (req, res) => {
  try {
    const { promptKey, content, changeLog } = req.body;

    if (!VALID_PROMPT_KEYS.includes(promptKey)) {
      return fail(res, `promptKey 必须为以下之一: ${VALID_PROMPT_KEYS.join(', ')}`);
    }
    if (!content || content.length < 10) {
      return fail(res, 'content 至少 10 个字符');
    }

    // P0修复：使用事务+行锁防止并发创建重复版本号
    const t = await db.sequelize.transaction();
    try {
      const lastVersion = await db.PromptVersion.findOne({
        where: { prompt_key: promptKey },
        order: [['version', 'DESC']],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      const nextVersion = (lastVersion?.version || 0) + 1;

      const prompt = await db.PromptVersion.create({
        prompt_key: promptKey,
        version: nextVersion,
        content,
        status: 'draft',
        change_log: changeLog || null,
        created_by: req.user.id
      }, { transaction: t });

      await t.commit();

      logger.info(`Prompt 新版本创建: key=${promptKey}, version=${nextVersion}, admin=${req.user.id}`);

      return success(res, { prompt }, 'Prompt 版本创建成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    logger.error('创建 Prompt 版本失败:', err);
    return fail(res, '创建失败');
  }
});

/**
 * 激活 Prompt 版本（同时归档同 key 的旧 active 版本）
 * PUT /api/admin/prompts/:id/activate
 */
router.put('/prompts/:id/activate', async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const prompt = await db.PromptVersion.findByPk(id, { transaction: t });
    if (!prompt) {
      await t.rollback();
      return fail(res, 'Prompt 版本不存在');
    }
    if (prompt.status === 'active') {
      await t.rollback();
      return fail(res, '该版本已是激活状态');
    }

    // 归档同 key 的旧 active 版本
    await db.PromptVersion.update(
      { status: 'archived' },
      { where: { prompt_key: prompt.prompt_key, status: 'active' }, transaction: t }
    );

    // 激活新版本
    await prompt.update({
      status: 'active',
      activated_by: req.user.id,
      activated_at: new Date()
    }, { transaction: t });

    await t.commit();

    // 失效 reportGenerator 的内存缓存，让下次生成报告读到新 Prompt
    try {
      const { invalidatePromptCache } = require('../services/reportGenerator');
      invalidatePromptCache();
    } catch (_) { /* reportGenerator 尚未加载，忽略 */ }

    logger.info(`Prompt 版本激活: key=${prompt.prompt_key}, version=${prompt.version}, admin=${req.user.id}`);

    return success(res, { prompt }, '激活成功');
  } catch (err) {
    await t.rollback();
    logger.error('激活 Prompt 版本失败:', err);
    return fail(res, '激活失败');
  }
});

/**
 * 获取当前激活的 Prompt（供 reportGenerator 读取）
 * GET /api/admin/prompts/:key/active
 */
router.get('/prompts/:key/active', async (req, res) => {
  try {
    const { key } = req.params;
    if (!VALID_PROMPT_KEYS.includes(key)) {
      return fail(res, `promptKey 非法`);
    }

    const prompt = await db.PromptVersion.findOne({
      where: { prompt_key: key, status: 'active' }
    });

    return success(res, { prompt });
  } catch (err) {
    logger.error('获取激活 Prompt 失败:', err);
    return fail(res, '获取失败');
  }
});

// ============================================================
// 1. 账号管理（admin/agent/service_provider 账号）
// ============================================================

/**
 * 获取服务商列表（供下拉选择用，仅返回 id 和 name）
 * GET /api/admin/service-providers
 */
router.get('/service-providers', async (req, res) => {
  try {
    const providers = await db.ServiceProvider.findAll({
      where: { status: 'active' },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    return success(res, { serviceProviders: providers });
  } catch (err) {
    logger.error('获取服务商列表失败:', err);
    return fail(res, '获取服务商列表失败');
  }
});

/**
 * 获取账号列表（按角色筛选）
 * GET /api/admin/accounts?role=admin&page=1&pageSize=20&status=active
 */
router.get('/accounts', async (req, res) => {
  try {
    const { role, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    const ALLOWED_ROLES = ['admin', 'agent', 'service_provider'];
    const ALLOWED_ACCT_STATUS = ['active', 'banned'];
    const where = {};
    if (role && ALLOWED_ROLES.includes(role)) where.role = role;
    if (status && ALLOWED_ACCT_STATUS.includes(status)) where.status = status;

    const { count, rows } = await db.User.findAndCountAll({
      where,
      attributes: ['id', 'openid', 'nick_name', 'real_name', 'phone_masked', 'role', 'identity_type',
                   'status', 'avatar_url', 'agent_id', 'service_provider_id', 'created_at',
                   'last_active_at'],
      include: [
        { model: db.ServiceProvider, as: 'serviceProvider', attributes: ['id', 'name'], required: false }
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, {
      accounts: rows,
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    logger.error('获取账号列表失败:', err);
    return fail(res, '获取账号列表失败');
  }
});

/**
 * 创建后台账号（agent/service_provider）
 * POST /api/admin/accounts
 * body: { openid, nickName, role, realName?, phone?, password? }
 *
 * 权限规则：
 * - admin 账号禁止通过 API 创建，只能由系统初始化脚本（init-web-admin.js）设置
 * - agent/service_provider 账号只能由超级管理员（is_super=true）创建
 * - 普通管理员（is_super=false）无权创建任何后台账号
 */
router.post('/accounts', superAdminOnly, async (req, res) => {
  try {
    const { openid, nickName, role, realName, phone, password, serviceProviderId } = req.body;

    // 禁止通过 API 创建 admin 账号，admin 只能由系统初始化脚本创建
    if (role === 'admin') {
      return fail(res, 'admin 账号仅可通过系统初始化脚本创建，不允许通过 API 创建', 403);
    }

    const ALLOWED_ROLES = ['agent', 'service_provider'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(res, 'role 必须为 agent 或 service_provider（admin 仅由系统初始化创建）');
    }

    // 代理商关联服务商校验（唯一性：一个服务商只能被一个代理商关联）
    if (role === 'agent' && serviceProviderId) {
      const sp = await db.ServiceProvider.findByPk(serviceProviderId);
      if (!sp) {
        return fail(res, '关联的服务商不存在');
      }
      const existingAgent = await db.Agent.findOne({ where: { service_provider_id: serviceProviderId } });
      if (existingAgent) {
        return fail(res, '该服务商已被其他代理商关联，一个服务商只能关联一个代理商');
      }
    }
    // openid 可选：未传时自动生成（1个大写字母 + 7个数字）
    let finalOpenid = openid;
    if (!finalOpenid || typeof finalOpenid !== 'string' || finalOpenid.length < 3) {
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const digits = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
      finalOpenid = `${letter}${digits}`;
    }
    if (!nickName || typeof nickName !== 'string' || nickName.length > 100) {
      return fail(res, 'nickName 不合法');
    }
    // 手机号必填
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return fail(res, '手机号为必填项，且格式不合法');
    }
    // Web后台登录密码校验（强度规则与 User 模型一致）
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' ||
          !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(password)) {
        return fail(res, '密码强度不足：需8-32位且至少含字母和数字');
      }
    }

    // 防止重复创建（openid 或 手机号）
    const existingByOpenid = await db.User.findOne({ where: { openid: finalOpenid } });
    if (existingByOpenid) {
      return fail(res, '账号标识已存在，请更换或稍后重试');
    }
    // 手机号唯一性检查（需加密后比较）
    const { encryptPhone } = require('../utils/encrypt');
    try {
      const encryptedPhone = encryptPhone(phone);
      const existingByPhone = await db.User.findOne({ where: { phone: encryptedPhone } });
      if (existingByPhone) {
        return fail(res, '该手机号已被注册');
      }
    } catch { /* 加密比较失败时跳过，由数据库唯一约束兜底 */ }

    // P0修复：identity_type ENUM 为 (guest/user/member/service_provider/agent)，不含 admin。
    // 原 identity_type: role 对 admin 角色会触发 ENUM 约束错误。
    // admin 账号映射为 'user'（最高权限身份），agent 映射 'agent'，service_provider 映射 'service_provider'。
    const IDENTITY_TYPE_MAP = { admin: 'user', agent: 'agent', service_provider: 'service_provider' };

    // 创建 agent/service_provider 时，必须先创建 User 再创建关联记录（外键约束要求先有 User）
    // 先创建 User（不设 agent_id/service_provider_id）
    const user = await db.User.create({
      openid: finalOpenid,
      nick_name: nickName,
      real_name: realName || null,
      phone: phone || null,
      password: password || null,  // beforeSave 钩子会自动加密
      role,
      identity_type: IDENTITY_TYPE_MAP[role],
      status: 'active'
    });

    // 再创建 Agent/ServiceProvider 并关联到 User
    let agentId = null;
    let createdServiceProviderId = null;

    if (role === 'agent') {
      const agent = await db.Agent.create({
        user_id: user.id,
        name: realName || nickName,
        phone: phone || null,
        service_provider_id: serviceProviderId || null,
        status: 'active',
        verified: true,
        share_code: `AGT${Date.now().toString(36).toUpperCase()}`
      });
      agentId = agent.id;
      await user.update({ agent_id: agentId, service_provider_id: serviceProviderId || null });
    } else if (role === 'service_provider') {
      const sp = await db.ServiceProvider.create({
        name: realName || nickName,
        phone: phone || null,
        status: 'active',
        verified: true
      });
      createdServiceProviderId = sp.id;
      await user.update({ service_provider_id: createdServiceProviderId });
    }

    logger.info(`管理员创建账号: openid=${finalOpenid}, phone=${phone}, role=${role}, agent_id=${agentId}, sp_id=${createdServiceProviderId || serviceProviderId}, by=${req.user.id}`);

    return success(res, {
      userId: user.id,
      openid: user.openid,
      role: user.role,
      agentId: agentId,
      serviceProviderId: createdServiceProviderId || serviceProviderId || null,
      status: user.status
    }, '账号创建成功');
  } catch (err) {
    logger.error('创建账号失败:', err);
    return fail(res, '创建账号失败');
  }
});

/**
 * 修改账号角色（账号权限管理 - 角色分配）
 * PUT /api/admin/accounts/:id/role
 * body: { role: 'agent'|'service_provider', agentId?, serviceProviderId? }
 *
 * 权限规则：
 * - admin 角色禁止通过 API 分配，只能由系统初始化脚本设置
 * - 涉及角色变更的操作只能由超级管理员执行
 * - 禁止将任何账号提升为 admin
 * - 超级管理员不可被降级
 */
router.put('/accounts/:id/role', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, agentId, serviceProviderId, confirm } = req.body;

    // 禁止通过 API 分配 admin 角色
    if (role === 'admin') {
      return fail(res, 'admin 角色仅可通过系统初始化脚本设置，不允许通过 API 分配', 403);
    }

    const ALLOWED_ROLES = ['agent', 'service_provider'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(res, 'role 必须为 agent 或 service_provider（admin 仅由系统初始化创建）');
    }
    // P0修复：角色变更为重要操作，需二次确认
    if (confirm !== true) {
      return fail(res, '角色变更为重要操作，请确认后传 confirm=true');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '账号不存在');
    }
    if (user.role === 'user') {
      return fail(res, '该接口仅用于后台账号，普通用户请使用 /api/admin/users/:id/role');
    }
    // 超级管理员不可被降级
    if (user.is_super) {
      return fail(res, '超级管理员角色不可变更', 403);
    }
    // 非超级管理员的 admin 账号可降级为 agent/service_provider
    // 防止管理员降级自己（避免误操作锁死系统）
    if (user.id === req.user.id) {
      return fail(res, '不能变更当前登录账号的角色');
    }

    // 角色变更时同步外键关联
    // 关联唯一性规则：用户的agent_id/service_provider_id首次绑定后不可更改
    const updateData = { role };
    const IDENTITY_TYPE_MAP = { admin: 'user', agent: 'agent', service_provider: 'service_provider' };
    updateData.identity_type = IDENTITY_TYPE_MAP[role];

    if (role === 'agent') {
      if (agentId) {
        const agent = await db.Agent.findByPk(agentId);
        if (!agent) return fail(res, '代理商不存在');
        updateData.agent_id = agentId;
      } else if (!user.agent_id) {
        // 未传 agentId 且用户无已有代理商关联，自动创建 Agent 记录
        let plainPhone = null;
        try { plainPhone = user.getDecryptedPhone(); } catch { /* 解密失败忽略 */ }
        const agent = await db.Agent.create({
          user_id: user.id,
          name: user.real_name || user.nick_name || '代理商',
          phone: plainPhone,
          status: 'active',
          verified: true,
          share_code: `AGT${Date.now().toString(36).toUpperCase()}`
        });
        updateData.agent_id = agent.id;
      }
      // 保留已有的 service_provider_id（不可清除已绑定关联）
      if (!user.service_provider_id) {
        updateData.service_provider_id = null;
      }
    } else if (role === 'service_provider') {
      if (serviceProviderId) {
        const sp = await db.ServiceProvider.findByPk(serviceProviderId);
        if (!sp) return fail(res, '服务商不存在');
        updateData.service_provider_id = serviceProviderId;
      } else if (!user.service_provider_id) {
        // 未传 serviceProviderId 且用户无已有服务商关联，自动创建 ServiceProvider 记录
        let spPlainPhone = null;
        try { spPlainPhone = user.getDecryptedPhone(); } catch { /* 解密失败忽略 */ }
        const sp = await db.ServiceProvider.create({
          name: user.real_name || user.nick_name || '服务商',
          phone: spPlainPhone,
          status: 'active',
          verified: true
        });
        updateData.service_provider_id = sp.id;
      }
      // 保留已有的 agent_id（不可清除已绑定关联）
      if (!user.agent_id) {
        updateData.agent_id = null;
      }
    } else {
      // admin 角色：保留已有的 agent_id 和 service_provider_id（不可清除已绑定关联）
      if (!user.agent_id) updateData.agent_id = null;
      if (!user.service_provider_id) updateData.service_provider_id = null;
    }

    await user.update(updateData);

    logger.info(`管理员账号角色变更: userId=${id}, role=${role}, by=${req.user.id}`);

    return success(res, { userId: id, role }, '角色更新成功');
  } catch (err) {
    logger.error('账号角色变更失败:', err);
    return fail(res, err.message || '操作失败');
  }
});

/**
 * 启用/停用账号
 * PUT /api/admin/accounts/:id/status
 * body: { status: 'active'|'banned', reason? }
 *
 * 权限规则：
 * - 超级管理员不可被封禁
 * - admin 账号的状态变更只能由超级管理员操作
 * - agent/service_provider 账号的状态变更只能由超级管理员操作
 */
router.put('/accounts/:id/status', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return fail(res, 'status 必须为 active/banned');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '账号不存在');
    }
    if (user.role !== 'admin' && user.role !== 'agent' && user.role !== 'service_provider') {
      return fail(res, '该接口仅用于管理后台账号，普通用户请使用 /api/admin/users/:id/status');
    }
    // 超级管理员不可被封禁
    if (user.is_super && status === 'banned') {
      return fail(res, '超级管理员不可被封禁', 403);
    }
    // 防止管理员封禁自己
    if (status === 'banned' && user.id === req.user.id) {
      return fail(res, '不能封禁当前登录账号');
    }

    await user.update({ status });

    logger.info(`管理员账号状态变更: userId=${id}, status=${status}, reason=${reason || ''}, by=${req.user.id}`);

    return success(res, { userId: id, status }, status === 'banned' ? '账号已封禁' : '账号已启用');
  } catch (err) {
    logger.error('账号状态变更失败:', err);
    return fail(res, '操作失败');
  }
});

/**
 * 超级管理员重置后台账号密码
 * POST /api/admin/accounts/:id/reset-password
 * body: { newPassword, confirm }
 *
 * 权限规则：
 * - 仅超级管理员（is_super=true）可执行
 * - 不允许重置超级管理员自身的密码（自身密码仅通过初始化脚本管理）
 * - 目标账号必须为后台账号（agent/service_provider/admin）
 * - 重置为重要操作，需二次确认
 */
router.post('/accounts/:id/reset-password', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirm } = req.body;

    if (confirm !== true) {
      return fail(res, '密码重置为重要操作，请确认后传 confirm=true');
    }
    if (typeof newPassword !== 'string' ||
        !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(newPassword)) {
      return fail(res, '新密码强度不足：需8-32位且至少含字母和数字');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '账号不存在');
    }
    if (!['admin', 'agent', 'service_provider'].includes(user.role)) {
      return fail(res, '仅可重置后台账号（admin/agent/service_provider）的密码');
    }
    // 超级管理员自身的密码不通过此接口重置
    if (user.is_super) {
      return fail(res, '超级管理员密码仅可通过系统初始化脚本管理', 403);
    }

    await user.update({ password: newPassword });
    logger.info(`超级管理员重置密码: userId=${id}, role=${user.role}, by=${req.user.id}`);

    return success(res, { userId: id }, '密码重置成功');
  } catch (err) {
    logger.error('重置密码失败:', err);
    return fail(res, '重置密码失败');
  }
});

/**
 * 编辑后台账号信息
 * PUT /api/admin/accounts/:id
 * body: { nickName?, realName?, phone?, password? }
 *
 * 权限：仅超级管理员可操作
 */
router.put('/accounts/:id', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickName, realName, phone, password, serviceProviderId } = req.body;

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '账号不存在');
    }
    if (!['admin', 'agent', 'service_provider'].includes(user.role)) {
      return fail(res, '该接口仅用于后台账号，普通用户请使用 /api/admin/users/:id');
    }
    // 超级管理员自身信息不通过此接口修改
    if (user.is_super) {
      return fail(res, '超级管理员信息仅可通过系统初始化脚本管理', 403);
    }

    const updateData = {};

    if (nickName !== undefined) {
      if (typeof nickName !== 'string' || nickName.length > 100 || nickName.length < 1) {
        return fail(res, '昵称不合法');
      }
      updateData.nick_name = nickName;
    }

    if (realName !== undefined) {
      updateData.real_name = realName || null;
    }

    if (phone !== undefined) {
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return fail(res, '手机号格式不合法');
      }
      // 手机号唯一性检查（排除自身）
      if (phone) {
        const { encryptPhone } = require('../utils/encrypt');
        try {
          const encryptedPhone = encryptPhone(phone);
          const existingByPhone = await db.User.findOne({
            where: { phone: encryptedPhone, id: { [db.Sequelize.Op.ne]: id } }
          });
          if (existingByPhone) {
            return fail(res, '该手机号已被其他账号使用');
          }
        } catch { /* 加密比较失败时跳过 */ }
      }
      updateData.phone = phone || null;
    }

    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' ||
          !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(password)) {
        return fail(res, '密码强度不足：需8-32位且至少含字母和数字');
      }
      updateData.password = password;  // beforeSave 钩子自动加密
    }

    // 代理商关联服务商设置（唯一性：一个服务商只能被一个代理商关联）
    if (serviceProviderId !== undefined) {
      if (user.role === 'agent') {
        if (serviceProviderId) {
          const sp = await db.ServiceProvider.findByPk(serviceProviderId);
          if (!sp) {
            return fail(res, '关联的服务商不存在');
          }
          // 排除自身后检查唯一性
          const existingAgent = await db.Agent.findOne({
            where: { service_provider_id: serviceProviderId, id: { [db.Sequelize.Op.ne]: user.agent_id } }
          });
          if (existingAgent) {
            return fail(res, '该服务商已被其他代理商关联，一个服务商只能关联一个代理商');
          }
        }
        updateData.service_provider_id = serviceProviderId || null;
        // 同步更新 Agent 记录的 service_provider_id
        if (user.agent_id) {
          await db.Agent.update(
            { service_provider_id: serviceProviderId || null },
            { where: { id: user.agent_id } }
          );
        }
      } else if (user.role === 'service_provider') {
        // 服务商不能设置关联服务商
        return fail(res, '服务商账号不能设置关联服务商');
      }
    }

    if (Object.keys(updateData).length === 0) {
      return fail(res, '请至少提供一个要修改的字段');
    }

    await user.update(updateData);
    logger.info(`管理员编辑账号: userId=${id}, fields=${Object.keys(updateData).join(',')}, by=${req.user.id}`);

    return success(res, { userId: id }, '账号信息更新成功');
  } catch (err) {
    logger.error('编辑账号失败:', err);
    return fail(res, '编辑账号失败');
  }
});

// ============================================================
// 2. 违禁词库维护（方案5.5 医疗红线可后台维护）
// ============================================================

/**
 * 获取违禁词列表
 * GET /api/admin/forbidden-words?category=diagnosis&status=active&page=1&pageSize=50
 */
router.get('/forbidden-words', async (req, res) => {
  try {
    const { category, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));

    // P1修复：category/status 白名单校验
    const ALLOWED_FW_CATEGORIES = ['diagnosis', 'treatment', 'promise', 'intimidation', 'other'];
    const ALLOWED_FW_STATUS = ['active', 'inactive'];
    const where = {};
    if (category && ALLOWED_FW_CATEGORIES.includes(category)) where.category = category;
    if (status && ALLOWED_FW_STATUS.includes(status)) where.status = status;

    const { count, rows } = await db.ForbiddenWord.findAndCountAll({
      where,
      order: [['category', 'ASC'], ['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, { words: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取违禁词列表失败:', err);
    return fail(res, '获取违禁词列表失败');
  }
});

/**
 * 新增违禁词规则
 * POST /api/admin/forbidden-words
 * body: { pattern, message, category, note? }
 *
 * pattern 为正则表达式字符串，服务端会先校验是否能编译通过。
 */
router.post('/forbidden-words', async (req, res) => {
  try {
    const { pattern, message, category, note } = req.body;

    if (!pattern || typeof pattern !== 'string' || pattern.length > 500) {
      return fail(res, 'pattern 不合法（1-500字符）');
    }
    if (!message || typeof message !== 'string' || message.length > 200) {
      return fail(res, 'message 不合法（1-200字符）');
    }
    const ALLOWED_CATEGORIES = ['diagnosis', 'treatment', 'promise', 'intimidation', 'other'];
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return fail(res, 'category 非法');
    }

    // 校验正则可编译，避免无效规则污染库
    try {
      new RegExp(pattern);
    } catch (e) {
      return fail(res, `正则表达式编译失败: ${e.message}`);
    }
    // P0修复：ReDoS防护——检测已知危险的重复量词模式（如 (a+)+, (a*)*, (.*)* 等）
    // 灾难性回溯通常由嵌套重复量词引起，拒绝此类模式
    const REDOS_PATTERN = /\([^)]*[\+\*][^)]*\)[\+\*]|\\.\*[\+\*]\s*[\+\*]|\(\.\*\)[\+\*]|\(\.\+\)[\+\*]/;
    if (REDOS_PATTERN.test(pattern)) {
      return fail(res, '正则表达式包含潜在的灾难性回溯模式（嵌套重复量词），请简化表达式');
    }

    const word = await db.ForbiddenWord.create({
      pattern,
      message,
      category: category || 'other',
      note: note || null,
      created_by: req.user.id,
      updated_by: req.user.id
    });

    // 失效 reportGenerator 的违禁词缓存，下次生成报告时重新加载
    try {
      const { invalidateForbiddenCache } = require('../services/reportGenerator');
      invalidateForbiddenCache();
    } catch (_) { /* reportGenerator 尚未加载，忽略 */ }

    logger.info(`违禁词新增: pattern=${pattern}, category=${category}, by=${req.user.id}`);

    return success(res, { word }, '违禁词新增成功');
  } catch (err) {
    logger.error('新增违禁词失败:', err);
    return fail(res, '新增违禁词失败');
  }
});

/**
 * 更新违禁词规则
 * PUT /api/admin/forbidden-words/:id
 * body: { pattern?, message?, category?, status?, note? }
 */
router.put('/forbidden-words/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pattern, message, category, status, note } = req.body;

    const word = await db.ForbiddenWord.findByPk(id);
    if (!word) {
      return fail(res, '违禁词规则不存在');
    }

    if (pattern !== undefined) {
      if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 500) {
        return fail(res, 'pattern 不合法');
      }
      try { new RegExp(pattern); } catch (e) {
        return fail(res, `正则表达式编译失败: ${e.message}`);
      }
      // P0修复：ReDoS防护
      const REDOS_PATTERN = /\([^)]*[\+\*][^)]*\)[\+\*]|\\.\*[\+\*]\s*[\+\*]|\(\.\*\)[\+\*]|\(\.\+\)[\+\*]/;
      if (REDOS_PATTERN.test(pattern)) {
        return fail(res, '正则表达式包含潜在的灾难性回溯模式（嵌套重复量词），请简化表达式');
      }
      word.pattern = pattern;
    }
    if (message !== undefined) {
      if (typeof message !== 'string' || message.length === 0 || message.length > 200) {
        return fail(res, 'message 不合法');
      }
      word.message = message;
    }
    if (category !== undefined) {
      const ALLOWED = ['diagnosis', 'treatment', 'promise', 'intimidation', 'other'];
      if (!ALLOWED.includes(category)) return fail(res, 'category 非法');
      word.category = category;
    }
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) return fail(res, 'status 非法');
      word.status = status;
    }
    if (note !== undefined) word.note = note;

    word.updated_by = req.user.id;
    await word.save();

    try {
      const { invalidateForbiddenCache } = require('../services/reportGenerator');
      invalidateForbiddenCache();
    } catch (_) { /* ignore */ }

    logger.info(`违禁词更新: id=${id}, by=${req.user.id}`);

    return success(res, { word }, '更新成功');
  } catch (err) {
    logger.error('更新违禁词失败:', err);
    return fail(res, '更新失败');
  }
});

/**
 * 删除违禁词规则
 * DELETE /api/admin/forbidden-words/:id
 */
router.delete('/forbidden-words/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const word = await db.ForbiddenWord.findByPk(id);
    if (!word) {
      return fail(res, '违禁词规则不存在');
    }

    await word.destroy();

    try {
      const { invalidateForbiddenCache } = require('../services/reportGenerator');
      invalidateForbiddenCache();
    } catch (_) { /* ignore */ }

    logger.info(`违禁词删除: id=${id}, by=${req.user.id}`);

    return success(res, { id }, '删除成功');
  } catch (err) {
    logger.error('删除违禁词失败:', err);
    return fail(res, '删除失败');
  }
});

// ============================================================
// 3. 接口配置（AI/内容安全/OSS 等外部服务地址与密钥）
// ============================================================
//
// 设计：复用 SystemConfig 表，category='interface'，存储外部服务配置。
// 敏感字段（密钥）在响应中脱敏，仅返回是否已配置。
// 实际值通过环境变量读取（规格：敏感文件中禁止硬编码API密钥），
// 此接口仅用于展示配置状态和非敏感参数（如 model、timeout）的后台可配。

/**
 * 获取接口配置状态（脱敏）
 * GET /api/admin/interface-config
 */
router.get('/interface-config', async (req, res) => {
  try {
    // 读取环境变量判断是否已配置（不返回真实密钥）
    const config = {
      ai_text: {
        url: process.env.AI_SERVICE_URL ? '***已配置***' : '未配置',
        key: process.env.AI_SERVICE_KEY ? '***已配置***' : '未配置',
        model: process.env.AI_MODEL || 'doubao-pro-32k'
      },
      ai_vision: {
        url: process.env.AI_VISION_URL || process.env.AI_SERVICE_URL ? '***已配置***' : '未配置',
        key: process.env.AI_VISION_KEY || process.env.AI_SERVICE_KEY ? '***已配置***' : '未配置',
        model: process.env.AI_VISION_MODEL || process.env.AI_SERVICE_MODEL || 'Qwen/Qwen3-VL-8B-Instruct'
      },
      content_security: {
        url: process.env.CONTENT_SECURITY_URL ? '***已配置***' : '未配置',
        key: process.env.CONTENT_SECURITY_KEY ? '***已配置***' : '未配置'
      },
      oss: {
        endpoint: process.env.OSS_ENDPOINT || '未配置',
        bucket: process.env.OSS_BUCKET || '未配置',
        region: process.env.OSS_REGION || '未配置',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID ? '***已配置***' : '未配置',
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ? '***已配置***' : '未配置'
      },
      wechat: {
        appid: process.env.WX_APPID ? '***已配置***' : '未配置',
        secret: process.env.WX_SECRET ? '***已配置***' : '未配置'
      }
    };

    // 从 SystemConfig 读取可后台调整的非敏感参数（如 timeout、max_tokens）
    const tunableConfig = await configCache.getCategory(db, 'interface');

    return success(res, {
      secrets: config,
      tunable: tunableConfig
    });
  } catch (err) {
    logger.error('获取接口配置失败:', err);
    return fail(res, '获取接口配置失败');
  }
});

/**
 * 更新接口可调参数（非密钥参数，如 model、timeout、max_tokens 等）
 * PUT /api/admin/interface-config/:key
 *
 * 权限：仅超级管理员
 * 设计：密钥类参数通过环境变量管理，此接口仅允许调整非敏感的可调参数
 * 存储于 SystemConfig 表 category='interface'
 */
router.put('/interface-config/:key', superAdminOnly, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (!key || typeof key !== 'string') {
      return fail(res, '配置键名不能为空');
    }

    // 禁止通过此接口修改密钥类参数（密钥必须通过环境变量管理）
    const SECRET_KEY_PATTERNS = /key|secret|password|token|credential/i;
    if (SECRET_KEY_PATTERNS.test(key)) {
      return fail(res, '密钥类参数请通过环境变量管理，不可通过后台接口修改');
    }

    // 允许的可调参数白名单
    const ALLOWED_TUNABLE_KEYS = [
      'ai_model', 'ai_timeout', 'ai_max_tokens', 'ai_temperature',
      'content_security_timeout', 'oss_upload_timeout',
      'sms_timeout', 'wechat_pay_timeout'
    ];

    if (!ALLOWED_TUNABLE_KEYS.includes(key)) {
      return fail(res, `不支持的配置项: ${key}，可选项: ${ALLOWED_TUNABLE_KEYS.join(', ')}`);
    }

    const [config, created] = await db.SystemConfig.findOrCreate({
      where: { config_key: key, category: 'interface' },
      defaults: {
        config_key: key,
        category: 'interface',
        config_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: description || `接口参数: ${key}`
      }
    });

    if (!created) {
      await config.update({
        config_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        description: description || config.description
      });
    }

    // 清除缓存使新值生效
    configCache.invalidate('interface');

    return success(res, {
      key: config.config_key,
      value: config.config_value,
      description: config.description,
      updatedAt: config.updated_at
    }, '更新成功');
  } catch (err) {
    logger.error('更新接口配置失败:', err);
    return fail(res, '更新接口配置失败');
  }
});

// ============================================================
// 4. 全平台用户管控
// ============================================================

/**
 * 获取全平台用户列表（含搜索）
 * GET /api/admin/users?keyword=xxx&role=user&status=active&isMember=true&page=1&pageSize=20
 *
 * keyword 模糊匹配 nick_name / real_name / phone_masked
 */
router.get('/users', async (req, res) => {
  try {
    const { keyword, role, status, isMember } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    // P0修复：role/status 白名单校验，防止任意字符串注入查询
    const ALLOWED_ROLES = ['user', 'agent', 'service_provider', 'admin'];
    const ALLOWED_STATUS = ['active', 'inactive', 'banned'];

    const where = {};
    if (role && ALLOWED_ROLES.includes(role)) where.role = role;
    if (status && ALLOWED_STATUS.includes(status)) where.status = status;
    if (isMember === 'true') where.is_member = true;
    if (isMember === 'false') where.is_member = false;

    // P0修复：keyword 长度限制（防慢查询 LIKE 扫描）+ LIKE通配符转义（防通配符注入DoS）
    if (keyword) {
      const kw = escapeLikeWildcard(String(keyword).slice(0, 50));
      where[db.Sequelize.Op.or] = [
        { nick_name: { [db.Sequelize.Op.like]: `%${kw}%` } },
        { real_name: { [db.Sequelize.Op.like]: `%${kw}%` } },
        { phone_masked: { [db.Sequelize.Op.like]: `%${kw}%` } }
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where,
      attributes: ['id', 'nick_name', 'real_name', 'phone_masked', 'avatar_url', 'role',
                   'identity_type', 'status', 'is_member', 'points', 'total_points',
                   'honor_level', 'agent_id', 'service_provider_id', 'created_at', 'last_active_at'],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, {
      users: rows,
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    logger.error('获取用户列表失败:', err);
    return fail(res, '获取用户列表失败');
  }
});

/**
 * 封禁/解封用户
 * PUT /api/admin/users/:id/status
 * body: { status: 'active'|'banned', reason? }
 *
 * 封禁后用户无法获取新 token（auth.js findOrCreate 后检查 status === 'banned' 返回 403）。
 */
router.put('/users/:id/status', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'banned'].includes(status)) {
      return fail(res, 'status 必须为 active/banned');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '用户不存在');
    }
    if (user.role === 'admin') {
      return fail(res, '不能封禁管理员账号，请使用 /api/admin/accounts/:id/status');
    }

    await user.update({ status });

    logger.info(`用户状态变更: userId=${id}, status=${status}, reason=${reason || ''}, by=${req.user.id}`);

    return success(res, { userId: id, status }, status === 'banned' ? '用户已封禁' : '用户已解封');
  } catch (err) {
    logger.error('用户状态变更失败:', err);
    return fail(res, '操作失败');
  }
});

/**
 * 获取用户详情（含积分、关联关系）
 * GET /api/admin/users/:id
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.User.findByPk(id, {
      attributes: ['id', 'nick_name', 'real_name', 'phone_masked', 'avatar_url', 'gender', 'age',
                   'height', 'weight', 'bmi', 'role', 'identity_type', 'status', 'is_member',
                   'points', 'total_points', 'frozen_points', 'level', 'honor_level', 'badges',
                   'agent_id', 'service_provider_id', 'referrer_id', 'share_code',
                   'created_at', 'last_active_at', 'member_since'],
      include: [
        { model: db.Agent, as: 'agent', attributes: ['id', 'name'] },
        { model: db.ServiceProvider, as: 'serviceProvider', attributes: ['id', 'name'] }
      ]
    });

    if (!user) {
      return fail(res, '用户不存在');
    }

    return success(res, { user });
  } catch (err) {
    logger.error('获取用户详情失败:', err);
    return fail(res, '获取用户详情失败');
  }
});

/**
 * 修改用户角色（用户管理 - 角色分配）
 * PUT /api/admin/users/:id/role
 * body: { role: 'user'|'agent'|'service_provider', agentId?, serviceProviderId? }
 *
 * 用于将普通用户提升为代理商/服务商（需指定关联ID），
 * 或将代理商/服务商降级为普通用户。
 * 不能用于创建 admin 账号（请使用 /api/admin/accounts）。
 */
router.put('/users/:id/role', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, agentId, serviceProviderId, confirm } = req.body;

    const ALLOWED_ROLES = ['user', 'agent', 'service_provider'];
    if (!ALLOWED_ROLES.includes(role)) {
      return fail(res, 'role 必须为 user/agent/service_provider');
    }
    // P0修复：角色变更为重要操作，需二次确认（与 /accounts/:id/role 保持一致）
    if (confirm !== true) {
      return fail(res, '角色变更为重要操作，请确认后传 confirm=true');
    }

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '用户不存在');
    }
    if (user.role === 'admin') {
      return fail(res, '不能通过此接口修改管理员角色，请使用 /api/admin/accounts/:id/role');
    }

    // 角色变更时同步外键关联
    // 关联唯一性规则：用户的agent_id/service_provider_id首次绑定后不可更改
    const updateData = { role };
    const IDENTITY_TYPE_MAP = { user: 'user', agent: 'agent', service_provider: 'service_provider' };
    updateData.identity_type = IDENTITY_TYPE_MAP[role];

    if (role === 'agent') {
      if (agentId) {
        const agent = await db.Agent.findByPk(agentId);
        if (!agent) return fail(res, '代理商不存在');
        updateData.agent_id = agentId;
      } else if (!user.agent_id) {
        // 未传 agentId 且用户无已有代理商关联，自动创建 Agent 记录
        let plainPhone = null;
        try { plainPhone = user.getDecryptedPhone(); } catch { /* 解密失败忽略 */ }
        const agent = await db.Agent.create({
          user_id: user.id,
          name: user.real_name || user.nick_name || '代理商',
          phone: plainPhone,
          status: 'active',
          verified: true,
          share_code: `AGT${Date.now().toString(36).toUpperCase()}`
        });
        updateData.agent_id = agent.id;
      }
      // 保留已有的 service_provider_id（不可清除已绑定关联）
      if (!user.service_provider_id) {
        updateData.service_provider_id = null;
      }
    } else if (role === 'service_provider') {
      if (serviceProviderId) {
        const sp = await db.ServiceProvider.findByPk(serviceProviderId);
        if (!sp) return fail(res, '服务商不存在');
        updateData.service_provider_id = serviceProviderId;
      } else if (!user.service_provider_id) {
        // 未传 serviceProviderId 且用户无已有服务商关联，自动创建 ServiceProvider 记录
        let spPlainPhone = null;
        try { spPlainPhone = user.getDecryptedPhone(); } catch { /* 解密失败忽略 */ }
        const sp = await db.ServiceProvider.create({
          name: user.real_name || user.nick_name || '服务商',
          phone: spPlainPhone,
          status: 'active',
          verified: true
        });
        updateData.service_provider_id = sp.id;
      }
      // 保留已有的 agent_id（不可清除已绑定关联）
      if (!user.agent_id) {
        updateData.agent_id = null;
      }
    } else {
      // user 角色：保留已有的 agent_id 和 service_provider_id（不可清除已绑定关联）
      if (!user.agent_id) updateData.agent_id = null;
      if (!user.service_provider_id) updateData.service_provider_id = null;
    }

    await user.update(updateData);

    logger.info(`用户角色变更: userId=${id}, role=${role}, by=${req.user.id}`);

    return success(res, { userId: id, role }, '角色更新成功');
  } catch (err) {
    logger.error('用户角色变更失败:', err);
    return fail(res, err.message || '操作失败');
  }
});

/**
 * 编辑用户信息（超级管理员）
 * PUT /api/admin/users/:id/edit
 * body: { nickName?, realName?, phone?, gender?, age?, height?, weight?, password? }
 *
 * 权限：仅超级管理员可操作
 */
router.put('/users/:id/edit', superAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickName, realName, phone, gender, age, height, weight, password } = req.body;

    const user = await db.User.findByPk(id);
    if (!user) {
      return fail(res, '用户不存在');
    }
    if (['admin', 'agent', 'service_provider'].includes(user.role)) {
      return fail(res, '后台账号请使用 /api/admin/accounts/:id 编辑');
    }

    const updateData = {};

    if (nickName !== undefined) {
      if (typeof nickName !== 'string' || nickName.length > 100 || nickName.length < 1) {
        return fail(res, '昵称不合法');
      }
      updateData.nick_name = nickName;
    }

    if (realName !== undefined) {
      updateData.real_name = realName || null;
    }

    if (phone !== undefined) {
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return fail(res, '手机号格式不合法');
      }
      if (phone) {
        const { encryptPhone } = require('../utils/encrypt');
        try {
          const encryptedPhone = encryptPhone(phone);
          const existingByPhone = await db.User.findOne({
            where: { phone: encryptedPhone, id: { [db.Sequelize.Op.ne]: id } }
          });
          if (existingByPhone) {
            return fail(res, '该手机号已被其他用户使用');
          }
        } catch { /* 加密比较失败时跳过 */ }
      }
      updateData.phone = phone || null;
    }

    const ALLOWED_GENDERS = ['male', 'female', 'unknown'];
    if (gender !== undefined) {
      if (!ALLOWED_GENDERS.includes(gender)) {
        return fail(res, 'gender 不合法');
      }
      updateData.gender = gender;
    }

    if (age !== undefined) {
      if (typeof age !== 'number' || age < 0 || age > 200 || !Number.isInteger(age)) {
        return fail(res, 'age 不合法');
      }
      updateData.age = age;
    }

    if (height !== undefined) {
      if (typeof height !== 'number' || height <= 0 || height > 300) {
        return fail(res, 'height 不合法');
      }
      updateData.height = height;
    }

    if (weight !== undefined) {
      if (typeof weight !== 'number' || weight <= 0 || weight > 500) {
        return fail(res, 'weight 不合法');
      }
      updateData.weight = weight;
    }

    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' ||
          !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(password)) {
        return fail(res, '密码强度不足：需8-32位且至少含字母和数字');
      }
      updateData.password = password;
    }

    // 自动计算BMI
    if (updateData.height && updateData.weight) {
      const heightM = updateData.height / 100;
      updateData.bmi = (updateData.weight / (heightM * heightM)).toFixed(1);
    } else if (updateData.height && user.weight) {
      const heightM = updateData.height / 100;
      updateData.bmi = (user.weight / (heightM * heightM)).toFixed(1);
    } else if (updateData.weight && user.height) {
      const heightM = user.height / 100;
      updateData.bmi = (updateData.weight / (heightM * heightM)).toFixed(1);
    }

    if (Object.keys(updateData).length === 0) {
      return fail(res, '请至少提供一个要修改的字段');
    }

    await user.update(updateData);
    logger.info(`管理员编辑用户: userId=${id}, fields=${Object.keys(updateData).join(',')}, by=${req.user.id}`);

    return success(res, { userId: id }, '用户信息更新成功');
  } catch (err) {
    logger.error('编辑用户失败:', err);
    return fail(res, '编辑用户失败');
  }
});

// ============================================================
// 5. 资讯发布管理
// ============================================================

/**
 * 获取资讯列表（含草稿）
 * GET /api/admin/articles?status=published&category=news&page=1&pageSize=20
 */
router.get('/articles', async (req, res) => {
  try {
    const { status, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    // P1修复：status/category 白名单校验
    const ALLOWED_ARTICLE_STATUS = ['draft', 'published', 'offline'];
    const ALLOWED_CATEGORIES = ['news', 'health_tips', 'activity', 'announcement', 'other'];
    const where = {};
    if (status && ALLOWED_ARTICLE_STATUS.includes(status)) where.status = status;
    if (category && ALLOWED_CATEGORIES.includes(category)) where.category = category;

    const { count, rows } = await db.Article.findAndCountAll({
      where,
      order: [['sort_order', 'DESC'], ['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return success(res, { articles: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取资讯列表失败:', err);
    return fail(res, '获取资讯列表失败');
  }
});

/**
 * 创建资讯
 * POST /api/admin/articles
 * body: { title, content, summary?, coverImage?, category?, sortOrder? }
 */
router.post('/articles', async (req, res) => {
  try {
    const { title, content, summary, coverImage, category, sortOrder } = req.body;

    if (!title || typeof title !== 'string' || title.length > 200) {
      return fail(res, 'title 不合法（1-200字符）');
    }
    if (!content || typeof content !== 'string') {
      return fail(res, 'content 不能为空');
    }

    const ALLOWED_CATEGORIES = ['news', 'health_tips', 'activity', 'announcement', 'other'];
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return fail(res, 'category 非法');
    }

    const article = await db.Article.create({
      title,
      content,
      summary: summary || null,
      cover_image: coverImage || null,
      category: category || 'news',
      sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
      author_id: req.user.id,
      status: 'draft'
    });

    logger.info(`资讯创建: id=${article.id}, title=${title}, by=${req.user.id}`);

    return success(res, { article }, '资讯创建成功');
  } catch (err) {
    logger.error('创建资讯失败:', err);
    return fail(res, '创建资讯失败');
  }
});

/**
 * 更新资讯
 * PUT /api/admin/articles/:id
 */
router.put('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, summary, coverImage, category, sortOrder } = req.body;

    const article = await db.Article.findByPk(id);
    if (!article) {
      return fail(res, '资讯不存在');
    }
    if (article.status === 'published') {
      return fail(res, '已发布的资讯不能直接编辑，请先下架');
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
        return fail(res, 'title 不合法');
      }
      article.title = title;
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || content.length === 0) {
        return fail(res, 'content 不能为空');
      }
      article.content = content;
    }
    if (summary !== undefined) article.summary = summary;
    if (coverImage !== undefined) article.cover_image = coverImage;
    if (category !== undefined) {
      const ALLOWED = ['news', 'health_tips', 'activity', 'announcement', 'other'];
      if (!ALLOWED.includes(category)) return fail(res, 'category 非法');
      article.category = category;
    }
    if (sortOrder !== undefined) article.sort_order = sortOrder;

    await article.save();

    logger.info(`资讯更新: id=${id}, by=${req.user.id}`);

    return success(res, { article }, '更新成功');
  } catch (err) {
    logger.error('更新资讯失败:', err);
    return fail(res, '更新失败');
  }
});

/**
 * 发布/下架资讯
 * PUT /api/admin/articles/:id/publish
 * body: { action: 'publish'|'offline' }
 */
router.put('/articles/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['publish', 'offline'].includes(action)) {
      return fail(res, 'action 必须为 publish/offline');
    }

    const article = await db.Article.findByPk(id);
    if (!article) {
      return fail(res, '资讯不存在');
    }

    if (action === 'publish') {
      if (!article.content || article.content.length < 10) {
        return fail(res, '正文内容过短，无法发布');
      }
      article.status = 'published';
      article.published_at = new Date();
    } else {
      article.status = 'offline';
    }

    await article.save();

    logger.info(`资讯${action === 'publish' ? '发布' : '下架'}: id=${id}, by=${req.user.id}`);

    return success(res, { id, status: article.status }, action === 'publish' ? '发布成功' : '下架成功');
  } catch (err) {
    logger.error('资讯发布/下架失败:', err);
    return fail(res, '操作失败');
  }
});

/**
 * 删除资讯
 * DELETE /api/admin/articles/:id
 */
router.delete('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await db.Article.findByPk(id);
    if (!article) {
      return fail(res, '资讯不存在');
    }
    if (article.status === 'published') {
      return fail(res, '已发布的资讯不能直接删除，请先下架');
    }

    await article.destroy();
    logger.info(`资讯删除: id=${id}, by=${req.user.id}`);

    return success(res, { id }, '删除成功');
  } catch (err) {
    logger.error('删除资讯失败:', err);
    return fail(res, '删除失败');
  }
});

// ============================================================
// 6. 商城商品管理
// ============================================================

/**
 * 获取礼品列表（含下架商品，admin 用）
 * GET /api/admin/gifts?status=active&category=food&page=1&pageSize=20
 */
router.get('/gifts', async (req, res) => {
  try {
    const { status, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    // P1修复：status/category 白名单校验
    const ALLOWED_GIFT_STATUS = ['active', 'inactive', 'sold_out'];
    const ALLOWED_GIFT_CATEGORIES = ['food', 'health', 'service', 'coupon', 'other'];
    const where = {};
    if (status && ALLOWED_GIFT_STATUS.includes(status)) where.status = status;
    if (category && ALLOWED_GIFT_CATEGORIES.includes(category)) where.category = category;

    const { count, rows } = await db.Gift.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [{ model: db.Agent, as: 'agent', attributes: ['id', 'name'] }]
    });

    return success(res, { gifts: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取礼品列表失败:', err);
    return fail(res, '获取礼品列表失败');
  }
});

/**
 * 创建礼品
 * POST /api/admin/gifts
 * body: { name, description?, image?, points, category?, stock?, agentId?, startDate?, endDate? }
 */
router.post('/gifts', async (req, res) => {
  try {
    const { name, description, image, points, cashPrice, category, stock, agentId, startDate, endDate } = req.body;

    if (!name || typeof name !== 'string' || name.length > 100) {
      return fail(res, 'name 不合法（1-100字符）');
    }
    if (typeof points !== 'number' || points <= 0 || !Number.isInteger(points)) {
      return fail(res, 'points 必须为正整数');
    }
    // P1修复：cashPrice 校验（单位：分，0=纯积分，正整数=混合支付）
    if (cashPrice !== undefined && cashPrice !== null) {
      if (typeof cashPrice !== 'number' || !Number.isInteger(cashPrice) || cashPrice < 0) {
        return fail(res, 'cashPrice 必须为非负整数（单位：分）');
      }
    }
    // P0修复：stock 必须为整数（-1 表示无限），原代码接受 1.5 等非整数值
    if (stock !== undefined && stock !== null) {
      if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < -1) {
        return fail(res, 'stock 必须为整数且 >= -1（-1表示无限）');
      }
    }

    const ALLOWED_CATEGORIES = ['food', 'health', 'service', 'coupon', 'other'];
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return fail(res, 'category 非法');
    }

    // P0修复：日期格式校验 + 开始日期不能晚于结束日期
    let parsedStart = null, parsedEnd = null;
    if (startDate) {
      parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) return fail(res, 'startDate 格式不合法');
    }
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) return fail(res, 'endDate 格式不合法');
    }
    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      return fail(res, 'startDate 不能晚于 endDate');
    }

    const gift = await db.Gift.create({
      name,
      description: description || null,
      image: image || null,
      points,
      cash_price: typeof cashPrice === 'number' ? cashPrice : 0,
      category: category || 'other',
      stock: typeof stock === 'number' ? stock : -1,
      status: 'active',
      agent_id: agentId || null,
      start_date: parsedStart,
      end_date: parsedEnd
    });

    logger.info(`礼品创建: id=${gift.id}, name=${name}, by=${req.user.id}`);

    return success(res, { gift }, '礼品创建成功');
  } catch (err) {
    logger.error('创建礼品失败:', err);
    return fail(res, '创建礼品失败');
  }
});

/**
 * 更新礼品
 * PUT /api/admin/gifts/:id
 */
router.put('/gifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, points, cashPrice, category, stock, status, agentId, startDate, endDate } = req.body;

    const gift = await db.Gift.findByPk(id);
    if (!gift) {
      return fail(res, '礼品不存在');
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length === 0 || name.length > 100) return fail(res, 'name 不合法');
      gift.name = name;
    }
    if (description !== undefined) gift.description = description;
    if (image !== undefined) gift.image = image;
    if (points !== undefined) {
      if (typeof points !== 'number' || points <= 0 || !Number.isInteger(points)) return fail(res, 'points 必须为正整数');
      gift.points = points;
    }
    // P1修复：支持更新 cashPrice（混合支付现金部分，单位：分）
    if (cashPrice !== undefined && cashPrice !== null) {
      if (typeof cashPrice !== 'number' || !Number.isInteger(cashPrice) || cashPrice < 0) return fail(res, 'cashPrice 必须为非负整数（单位：分）');
      gift.cash_price = cashPrice;
    }
    if (category !== undefined) {
      const ALLOWED = ['food', 'health', 'service', 'coupon', 'other'];
      if (!ALLOWED.includes(category)) return fail(res, 'category 非法');
      gift.category = category;
    }
    if (stock !== undefined) {
      // P1修复：stock 整数校验与 create 保持一致（-1=无限）
      if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < -1) return fail(res, 'stock 必须为整数且 >= -1（-1表示无限）');
      gift.stock = stock;
    }
    if (status !== undefined) {
      if (!['active', 'inactive', 'sold_out'].includes(status)) return fail(res, 'status 非法');
      gift.status = status;
    }
    if (agentId !== undefined) gift.agent_id = agentId || null;
    if (startDate !== undefined) gift.start_date = startDate;
    if (endDate !== undefined) gift.end_date = endDate;

    await gift.save();

    logger.info(`礼品更新: id=${id}, by=${req.user.id}`);

    return success(res, { gift }, '更新成功');
  } catch (err) {
    logger.error('更新礼品失败:', err);
    return fail(res, '更新失败');
  }
});

/**
 * 删除礼品（软删除：置为 inactive）
 * DELETE /api/admin/gifts/:id
 */
router.delete('/gifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gift = await db.Gift.findByPk(id);
    if (!gift) {
      return fail(res, '礼品不存在');
    }

    // 已有兑换记录的礼品不能物理删除，只能下架
    const exchangeCount = await db.GiftExchange.count({ where: { gift_id: id } });
    if (exchangeCount > 0) {
      await gift.update({ status: 'inactive' });
      logger.info(`礼品有兑换记录，置为下架: id=${id}, by=${req.user.id}`);
      return success(res, { id, status: 'inactive' }, '礼品已有兑换记录，已置为下架');
    }

    await gift.destroy();
    logger.info(`礼品删除: id=${id}, by=${req.user.id}`);

    return success(res, { id }, '删除成功');
  } catch (err) {
    logger.error('删除礼品失败:', err);
    return fail(res, '删除失败');
  }
});

// ============================================================
// 7. 订单处理（礼品兑换订单）
// ============================================================

/**
 * 获取兑换订单列表
 * GET /api/admin/orders?status=completed&giftId=xxx&page=1&pageSize=20
 */
router.get('/orders', async (req, res) => {
  try {
    const { status, giftId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    // P1修复：status 白名单校验
    const ALLOWED_ORDER_STATUS = ['pending', 'completed', 'refunded', 'cancelled', 'processing', 'shipped'];
    const where = {};
    if (status && ALLOWED_ORDER_STATUS.includes(status)) where.status = status;
    if (giftId) where.gift_id = giftId;

    const { count, rows } = await db.GiftExchange.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] },
        { model: db.Gift, as: 'gift', attributes: ['id', 'name', 'points'] },
        { model: db.Agent, as: 'agent', attributes: ['id', 'name'] }
      ]
    });

    return success(res, { orders: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取订单列表失败:', err);
    return fail(res, '获取订单列表失败');
  }
});

/**
 * 订单退款（退还积分 + 取消订单）
 * POST /api/admin/orders/:id/refund
 * body: { reason }
 *
 * 重要操作：需事务 + 行锁，退还积分到用户余额，记录积分历史。
 */
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.length < 2) {
      return fail(res, '退款原因必填（至少2字符）');
    }
    if (reason.length > 500) {
      return fail(res, '退款原因不超过500字');
    }

    const t = await db.sequelize.transaction();
    try {
      const order = await db.GiftExchange.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
        include: [{ model: db.Gift, as: 'gift' }]
      });
      if (!order) {
        await t.rollback();
        return fail(res, '订单不存在');
      }
      // P0修复：使用正向白名单（仅 completed/pending 可退款），原代码用负向黑名单
      const REFUNDABLE_STATUS = ['completed', 'pending', 'processing', 'shipped'];
      if (!REFUNDABLE_STATUS.includes(order.status)) {
        await t.rollback();
        return fail(res, `订单状态(${order.status})不可退款`);
      }

      // 退还积分到用户余额（行锁防止并发）
      const user = await db.User.findByPk(order.user_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!user) {
        await t.rollback();
        return fail(res, '用户不存在');
      }

      const refundPoints = Math.abs(order.points);
      // P0修复：先计算新余额，再更新，避免 Sequelize 实例 update 后 points 已变导致 balance_after 翻倍
      const newBalance = user.points + refundPoints;
      await user.update({
        points: newBalance
      }, { transaction: t });

      // 记录积分历史（balance_after 使用预计算的 newBalance，而非 user.points + refundPoints）
      await db.PointsHistory.create({
        user_id: order.user_id,
        type: 'adjust',
        points: refundPoints,
        source: 'admin_adjust',
        description: `订单退款退还积分: ${order.gift ? order.gift.name : '礼品'} (订单${id})`,
        reference_id: id,
        balance_after: newBalance
      }, { transaction: t });

      // 更新订单状态
      await order.update({
        status: 'refunded',
        remark: `管理员退款: ${reason}`
      }, { transaction: t });

      await t.commit();

      logger.info(`订单退款: orderId=${id}, userId=${order.user_id}, points=${refundPoints}, reason=${reason}, by=${req.user.id}`);

      return success(res, { orderId: id, status: 'refunded', refundedPoints: refundPoints }, '退款成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    logger.error('订单退款失败:', err);
    return fail(res, '退款失败');
  }
});

// ============================================================
// 8. 分润结算
// ============================================================

/**
 * 获取分润记录列表
 * GET /api/admin/commissions?agentId=xxx&status=pending&period=2026-07&page=1&pageSize=20
 */
router.get('/commissions', async (req, res) => {
  try {
    const { agentId, status, period } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    // P1修复：status 白名单校验，防止任意字符串注入查询
    const ALLOWED_COMMISSION_STATUS = ['pending', 'settled', 'cancelled', 'rejected'];
    const where = {};
    if (agentId) where.agent_id = agentId;
    if (status && ALLOWED_COMMISSION_STATUS.includes(status)) where.status = status;
    if (period && /^\d{4}-\d{2}$/.test(period)) where.period = period;

    const { count, rows } = await db.Commission.findAndCountAll({
      where,
      order: [['period', 'DESC'], ['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [
        { model: db.Agent, as: 'agent', attributes: ['id', 'name'] },
        { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] }
      ]
    });

    return success(res, { commissions: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取分润列表失败:', err);
    return fail(res, '获取分润列表失败');
  }
});

/**
 * 分润汇总（按代理商+周期）
 * GET /api/admin/commissions/summary?period=2026-07
 *
 * 返回汇总统计：pendingCount, pendingAmount, settledCount, settledAmount
 * period 参数可选，不传则返回所有周期的汇总。
 */
router.get('/commissions/summary', async (req, res) => {
  try {
    const { period } = req.query;

    // period 参数可选，但如果传了必须符合格式
    if (period && !/^\d{4}-\d{2}$/.test(period)) {
      return fail(res, 'period 格式应为 YYYY-MM');
    }

    const whereClause = {};
    if (period) {
      whereClause.period = period;
    }

    // 聚合查询：按 status 分组统计
    const grouped = await db.Commission.findAll({
      where: whereClause,
      attributes: [
        'status',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total_amount'],
        [db.sequelize.fn('COUNT', db.sequelize.col('Commission.id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // 转换为前端需要的格式
    const result = {
      pendingCount: 0,
      pendingAmount: 0,
      settledCount: 0,
      settledAmount: 0,
      cancelledCount: 0,
      cancelledAmount: 0,
      rejectedCount: 0,
      rejectedAmount: 0
    };

    grouped.forEach(row => {
      const status = row.status;
      const count = parseInt(row.count) || 0;
      const amount = parseFloat(row.total_amount) || 0;
      
      if (status === 'pending') {
        result.pendingCount = count;
        result.pendingAmount = amount;
      } else if (status === 'settled') {
        result.settledCount = count;
        result.settledAmount = amount;
      } else if (status === 'cancelled') {
        result.cancelledCount = count;
        result.cancelledAmount = amount;
      } else if (status === 'rejected') {
        result.rejectedCount = count;
        result.rejectedAmount = amount;
      }
    });

    return success(res, result);
  } catch (err) {
    logger.error('获取分润汇总失败:', err);
    return fail(res, '获取分润汇总失败');
  }
});

/**
 * 批量结算分润
 * POST /api/admin/commissions/settle
 * body: { commissionIds: [id1, id2, ...], remark? }
 *
 * 重要操作：批量将 status=pending 的记录置为 settled。
 */
router.post('/commissions/settle', async (req, res) => {
  try {
    const { commissionIds, remark } = req.body;

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return fail(res, 'commissionIds 不能为空');
    }
    if (commissionIds.length > 500) {
      return fail(res, '单次结算不能超过 500 条');
    }

    const t = await db.sequelize.transaction();
    try {
      const [updatedCount] = await db.Commission.update({
        status: 'settled',
        settled_at: new Date(),
        settled_by: req.user.id,
        remark: remark || '批量结算'
      }, {
        where: {
          id: { [db.Sequelize.Op.in]: commissionIds },
          status: 'pending'
        },
        transaction: t
      });

      await t.commit();

      logger.info(`分润批量结算: count=${updatedCount}, by=${req.user.id}`);

      return success(res, { settledCount: updatedCount }, `成功结算 ${updatedCount} 条`);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    logger.error('分润结算失败:', err);
    return fail(res, '结算失败');
  }
});

/**
 * 批量取消分润
 * POST /api/admin/commissions/cancel
 * body: { commissionIds: [id1, id2, ...], remark? }
 *
 * 将 status=pending 的记录置为 cancelled。
 */
router.post('/commissions/cancel', async (req, res) => {
  try {
    const { commissionIds, remark } = req.body;

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return fail(res, 'commissionIds 不能为空');
    }
    if (commissionIds.length > 500) {
      return fail(res, '单次取消不能超过 500 条');
    }

    const [updatedCount] = await db.Commission.update({
      status: 'cancelled',
      remark: remark || '手动取消'
    }, {
      where: {
        id: { [db.Sequelize.Op.in]: commissionIds },
        status: 'pending'
      }
    });

    logger.info(`分润批量取消: count=${updatedCount}, by=${req.user.id}`);

    return success(res, { cancelledCount: updatedCount }, `成功取消 ${updatedCount} 条`);
  } catch (err) {
    logger.error('分润取消失败:', err);
    return fail(res, '取消失败');
  }
});

/**
 * 批量驳回分润
 * POST /api/admin/commissions/reject
 * body: { commissionIds: [id1, id2, ...], remark? }
 *
 * 将 status=pending 的记录置为 rejected（已驳回）。
 */
router.post('/commissions/reject', async (req, res) => {
  try {
    const { commissionIds, remark } = req.body;

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return fail(res, 'commissionIds 不能为空');
    }
    if (commissionIds.length > 500) {
      return fail(res, '单次驳回不能超过 500 条');
    }

    const [updatedCount] = await db.Commission.update({
      status: 'rejected',
      remark: remark || '驳回'
    }, {
      where: {
        id: { [db.Sequelize.Op.in]: commissionIds },
        status: 'pending'
      }
    });

    logger.info(`分润批量驳回: count=${updatedCount}, by=${req.user.id}`);

    return success(res, { rejectedCount: updatedCount }, `成功驳回 ${updatedCount} 条`);
  } catch (err) {
    logger.error('分润驳回失败:', err);
    return fail(res, '驳回失败');
  }
});

// ============================================================
// 9. 核销记录查询
// ============================================================

/**
 * 获取核销记录列表
 * GET /api/admin/write-offs?agentId=xxx&userId=xxx&startDate=2026-07-01&endDate=2026-07-31&page=1&pageSize=20
 */
router.get('/write-offs', async (req, res) => {
  try {
    const { agentId, userId, startDate, endDate } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    const where = {};
    if (agentId) where.agent_id = agentId;
    if (userId) where.user_id = userId;
    if (startDate || endDate) {
      where.write_off_date = {};
      if (startDate) where.write_off_date[db.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.write_off_date[db.Sequelize.Op.lte] = new Date(endDate + 'T23:59:59');
    }

    const { count, rows } = await db.PointsWriteOff.findAndCountAll({
      where,
      order: [['write_off_date', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] },
        { model: db.Agent, as: 'agent', attributes: ['id', 'name'] }
      ]
    });

    return success(res, { writeOffs: rows, total: count, page, pageSize });
  } catch (err) {
    logger.error('获取核销记录失败:', err);
    return fail(res, '获取核销记录失败');
  }
});

// ============================================================
// 10. 积分全局管理
// ============================================================

/**
 * 获取积分流水（积分全局 - 流水查询）
 * GET /api/admin/points/history?userId=xxx&source=sign_in&page=1&pageSize=20
 *
 * 支持按 userId、source（积分来源）、type（earn/deduct/adjust）筛选，
 * 供管理员审计积分流向。
 */
router.get('/points/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    const where = {};
    if (req.query.userId) {
      where.user_id = req.query.userId;
    }
    // source 白名单校验
    const ALLOWED_SOURCES = ['sign_in', 'clock_in', 'course', 'gift_exchange', 'write_off', 'referral', 'admin_adjust', 'system'];
    if (req.query.source && ALLOWED_SOURCES.includes(req.query.source)) {
      where.source = req.query.source;
    }
    // type 白名单校验
    const ALLOWED_TYPES = ['earn', 'deduct', 'adjust'];
    if (req.query.type && ALLOWED_TYPES.includes(req.query.type)) {
      where.type = req.query.type;
    }

    const { count, rows } = await db.PointsHistory.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] }]
    });

    return success(res, {
      history: rows,
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    logger.error('获取积分流水失败:', err);
    return fail(res, '获取积分流水失败');
  }
});

// ============================================================
// 11. 积分人工调整
// ============================================================

/**
 * 人工调整用户积分
 * POST /api/admin/points/adjust
 * body: { userId, points, reason, confirm?: boolean }
 *
 * 重要操作（规格：积分核销等需二次确认）：
 *   - points > 0: 增加积分（发放）
 *   - points < 0: 扣减积分（回收）
 *   - 必须填写 reason（将记入积分历史 description）
 *   - 前端需二次确认后传 confirm=true 才执行
 *
 * 事务 + 用户行锁，防止并发导致余额错乱。
 */
router.post('/points/adjust', async (req, res) => {
  try {
    const { userId, points, reason, confirm } = req.body;

    // 参数校验
    if (!userId) return fail(res, 'userId 不能为空');
    if (typeof points !== 'number' || !Number.isInteger(points) || points === 0) {
      return fail(res, 'points 必须为非零整数（正数增加，负数扣减）');
    }
    if (Math.abs(points) > 100000) {
      return fail(res, '单次调整不能超过 100000 积分');
    }
    if (!reason || typeof reason !== 'string' || reason.length < 2 || reason.length > 200) {
      return fail(res, 'reason 必填（2-200字符），将记入积分历史');
    }
    // 二次确认机制（重要操作防护）
    if (confirm !== true) {
      return fail(res, '请确认调整信息后传 confirm=true 执行', 400);
    }

    const t = await db.sequelize.transaction();
    try {
      // 用户行锁，防止并发调整/兑换导致余额错乱
      const user = await db.User.findByPk(userId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!user) {
        await t.rollback();
        return fail(res, '用户不存在');
      }

      // 扣减时检查余额
      if (points < 0 && user.points + points < 0) {
        await t.rollback();
        return fail(res, `用户余额不足（当前: ${user.points}，尝试扣减: ${Math.abs(points)}）`);
      }

      const newPoints = user.points + points;
      const newTotalPoints = points > 0 ? user.total_points + points : user.total_points;

      await user.update({
        points: newPoints,
        total_points: newTotalPoints
      }, { transaction: t });

      // 记录积分历史
      await db.PointsHistory.create({
        user_id: userId,
        type: 'adjust',
        points, // 正数增加，负数扣减
        source: 'admin_adjust',
        description: `管理员人工调整: ${reason}`,
        balance_after: newPoints
      }, { transaction: t });

      await t.commit();

      logger.info(`积分人工调整: userId=${userId}, points=${points}, reason=${reason}, by=${req.user.id}, newBalance=${newPoints}`);

      return success(res, {
        userId,
        adjustedPoints: points,
        newBalance: newPoints,
        newTotalPoints
      }, '积分调整成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    logger.error('积分人工调整失败:', err);
    return fail(res, '积分调整失败');
  }
});

// ============================================================
// 12. 系统基础设置（微信ID、密码、大模型密钥、其他技术设置）
// ============================================================
//
// 设计要点：
// 1. 敏感配置（密钥/密码）存储在 SystemConfig 表中，使用 AES-256-GCM 加密
// 2. 读取时脱敏：仅返回是否已配置，不返回明文
// 3. 写入时二次确认：需传 confirm=true
// 4. 仅超级管理员可操作
// 5. 配置分组：wechat / ai / oss / system

const vault = require('../utils/secretVault');
const { encrypt: legacyEncrypt } = require('../utils/encrypt');

/**
 * 系统设置分组定义
 * 每个配置项包含：key、label、type（string/number/boolean/json）、sensitive（是否敏感）、category、description
 */
const SYSTEM_SETTINGS_SCHEMA = {
  // 微信配置
  'wechat.appid': { label: '微信小程序 AppID', type: 'string', sensitive: false, category: 'wechat', description: '微信小程序的 AppID' },
  'wechat.secret': { label: '微信小程序密钥', type: 'string', sensitive: true, category: 'wechat', description: '微信小程序的 AppSecret' },

  // AI 文本模型配置（报告生成等）
  'ai_text.service_url': { label: '文本模型服务地址', type: 'string', sensitive: false, category: 'ai_text', description: 'AI 文本生成服务的 API 地址（如 DeepSeek、豆包等）' },
  'ai_text.service_key': { label: '文本模型服务密钥', type: 'string', sensitive: true, category: 'ai_text', description: 'AI 文本生成服务的 API Key（加密存储）' },
  'ai_text.model': { label: '文本模型 ID', type: 'string', sensitive: false, category: 'ai_text', description: '文本生成使用的模型标识（如 deepseek-chat、doubao-pro-32k）' },
  'ai_text.max_tokens': { label: '最大输出 Token', type: 'number', sensitive: false, category: 'ai_text', description: 'AI 单次请求最大输出 Token 数' },
  'ai_text.temperature': { label: '温度参数', type: 'number', sensitive: false, category: 'ai_text', description: 'AI 生成温度参数（0-1，越高越随机）' },
  'ai_text.timeout': { label: '请求超时(秒)', type: 'number', sensitive: false, category: 'ai_text', description: 'AI 文本接口超时时间（秒）' },

  // AI 视觉模型配置（图片识别等）
  'ai_vision.service_url': { label: '视觉模型服务地址', type: 'string', sensitive: false, category: 'ai_vision', description: 'AI 视觉识别服务的 API 地址（如硅基流动、OpenAI 等）' },
  'ai_vision.service_key': { label: '视觉模型服务密钥', type: 'string', sensitive: true, category: 'ai_vision', description: 'AI 视觉识别服务的 API Key（加密存储）' },
  'ai_vision.model': { label: '视觉模型 ID', type: 'string', sensitive: false, category: 'ai_vision', description: '视觉识别使用的模型标识（如 Qwen3-VL-8B-Instruct）' },
  'ai_vision.max_tokens': { label: '最大输出 Token', type: 'number', sensitive: false, category: 'ai_vision', description: 'AI 视觉单次请求最大输出 Token 数' },
  'ai_vision.timeout': { label: '请求超时(秒)', type: 'number', sensitive: false, category: 'ai_vision', description: 'AI 视觉接口超时时间（秒）' },

  // 内容安全配置
  'content_security.url': { label: '内容安全服务地址', type: 'string', sensitive: false, category: 'content_security', description: '内容安全检测 API 地址' },
  'content_security.key': { label: '内容安全密钥', type: 'string', sensitive: true, category: 'content_security', description: '内容安全服务的 API Key（加密存储）' },

  // OSS 存储配置
  'oss.endpoint': { label: 'OSS Endpoint', type: 'string', sensitive: false, category: 'oss', description: '对象存储服务 Endpoint' },
  'oss.bucket': { label: 'OSS Bucket', type: 'string', sensitive: false, category: 'oss', description: '对象存储 Bucket 名称' },
  'oss.region': { label: 'OSS Region', type: 'string', sensitive: false, category: 'oss', description: '对象存储区域' },
  'oss.access_key_id': { label: 'OSS AccessKey ID', type: 'string', sensitive: true, category: 'oss', description: 'OSS 访问密钥 ID（加密存储）' },
  'oss.access_key_secret': { label: 'OSS AccessKey Secret', type: 'string', sensitive: true, category: 'oss', description: 'OSS 访问密钥 Secret（加密存储）' },

  // 系统配置
  'system.jwt_secret': { label: 'JWT 签名密钥', type: 'string', sensitive: true, category: 'system', description: 'JWT Token 签名密钥（修改后所有用户需重新登录）' },
  'system.jwt_expires_in': { label: 'JWT 有效期', type: 'string', sensitive: false, category: 'system', description: 'JWT Token 有效期（如 7d、24h）' },
  'system.aes_secret_key': { label: 'AES 加密密钥', type: 'string', sensitive: true, category: 'system', description: '手机号等敏感数据加密密钥（修改后需重新加密所有数据）' },
  'system.cors_origins': { label: 'CORS 允许源', type: 'string', sensitive: false, category: 'system', description: '允许跨域访问的域名（逗号分隔）' },

  // 学习课程配置
  'course.points': { label: '课程学习积分', type: 'number', sensitive: false, category: 'course', description: '课程学习达到进度阈值时发放的积分数量' },
  'course.progress_threshold': { label: '课程积分进度阈值(%)', type: 'number', sensitive: false, category: 'course', description: '学习进度达到此百分比时发放积分（0-100）' },
  'course.daily_limit': { label: '每日课程学习上限', type: 'number', sensitive: false, category: 'course', description: '每个用户每日可记录学习进度的课程数量上限' },
  'course.video_base_url': { label: '课程视频基础URL', type: 'string', sensitive: false, category: 'course', description: '课程视频资源的基础访问地址' },
  'course.cover_base_url': { label: '课程封面基础URL', type: 'string', sensitive: false, category: 'course', description: '课程封面图片的基础访问地址' },
  'course.default_duration': { label: '课程默认时长(分钟)', type: 'number', sensitive: false, category: 'course', description: '新建课程的默认学习时长' },
  'course.enable_auto_publish': { label: '自动发布新课程', type: 'boolean', sensitive: false, category: 'course', description: '新建课程时是否自动发布（否则需手动审核发布）' }
};

/**
 * 获取系统设置（脱敏）
 * GET /api/admin/system-settings?category=wechat
 *
 * 返回所有配置项，敏感字段仅显示是否已配置
 */
router.get('/system-settings', superAdminOnly, async (req, res) => {
  try {
    const { category } = req.query;
    const ALLOWED_CATEGORIES = ['wechat', 'ai', 'content_security', 'oss', 'course', 'system'];
    const categories = category && ALLOWED_CATEGORIES.includes(category)
      ? [category]
      : ALLOWED_CATEGORIES;

    const result = {};
    for (const cat of categories) {
      result[cat] = [];
      for (const [key, schema] of Object.entries(SYSTEM_SETTINGS_SCHEMA)) {
        if (schema.category !== cat) continue;

        // 从 SystemConfig 表读取（优先），回退到环境变量
        const dbConfig = await db.SystemConfig.findOne({
          where: { config_key: key, category: 'system_setting' }
        });

        let value;
        let source;
        if (dbConfig) {
          source = 'database';
          if (schema.sensitive) {
            // 敏感字段：尝试解密确认值存在，但返回脱敏
            try {
              const decrypted = vault.decryptSecret(dbConfig.config_value);
              value = decrypted ? '***已配置***' : '未配置';
            } catch {
              value = '***已配置***';
            }
          } else {
            // 非敏感字段：解析并返回明文值
            value = configCache.parseValue(dbConfig.config_value, schema.type);
          }
        } else {
          // 回退到环境变量
          source = 'env';
          const envKey = key.replace(/\./g, '_').toUpperCase();
          const envValue = process.env[envKey];
          if (schema.sensitive) {
            value = envValue ? '***已配置(ENV)***' : '未配置';
          } else {
            value = envValue || schema.type === 'number' ? (envValue ? configCache.parseValue(envValue, schema.type) : null) : (envValue || null);
          }
        }

        result[cat].push({
          key,
          label: schema.label,
          value,
          type: schema.type,
          sensitive: schema.sensitive,
          description: schema.description,
          source
        });
      }
    }

    return success(res, { settings: result }, '获取系统设置成功');
  } catch (err) {
    logger.error('获取系统设置失败:', err);
    return fail(res, '获取系统设置失败');
  }
});

/**
 * 更新系统设置项
 * PUT /api/admin/system-settings/:key
 * body: { value, confirm?: boolean }
 *
 * 权限：仅超级管理员
 * 安全：敏感字段加密存储，需二次确认
 */
router.put('/system-settings/:key', superAdminOnly, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, confirm } = req.body;

    // 校验配置项是否在 Schema 中定义
    const schema = SYSTEM_SETTINGS_SCHEMA[key];
    if (!schema) {
      return fail(res, `未知的配置项: ${key}，可配置项请通过 GET /api/admin/system-settings 查看`);
    }

    // 二次确认（系统设置为重要操作）
    if (confirm !== true) {
      return fail(res, '修改系统设置为重要操作，请确认后传 confirm=true');
    }

    // 值校验
    if (value === null || value === undefined || value === '') {
      // 允许清空配置（删除数据库记录，回退到环境变量）
      await db.SystemConfig.destroy({ where: { config_key: key, category: 'system_setting' } });
      configCache.invalidate('system_setting');
      logger.info(`系统设置清除: key=${key}, by=${req.user.id}`);
      return success(res, { key, value: null, source: 'env' }, '配置已清除，回退到环境变量');
    }

    // 类型校验
    let configValue;
    if (schema.type === 'number') {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return fail(res, `配置 ${key} 需要数字类型`);
      }
      configValue = String(num);
    } else if (schema.type === 'boolean') {
      configValue = String(!!value);
    } else {
      configValue = String(value);
    }

    // 敏感字段加密存储：
    //  - 三重密钥就绪(VAULT_MASTER_KEY + keys/ + 机器指纹) → 三重信封加密(ENV3: 前缀)
    //  - 过渡期密钥未就绪 → 回退旧单层 AES-256-GCM，保证功能不中断；注入 VAULT_MASTER_KEY 后自动升级
    if (schema.sensitive) {
      configValue = vault.hasAllKeys() ? vault.encryptSecret(configValue) : legacyEncrypt(configValue);
    }

    // 特殊字段业务校验
    if (key === 'ai.temperature') {
      const num = Number(value);
      if (num < 0 || num > 1) {
        return fail(res, 'AI 温度参数范围为 0-1');
      }
    }
    if (key === 'ai.timeout') {
      const num = Number(value);
      if (num < 1 || num > 120) {
        return fail(res, 'AI 超时范围为 1-120 秒');
      }
    }
    if (key === 'ai.max_tokens') {
      const num = Number(value);
      if (num < 1 || num > 32768) {
        return fail(res, 'AI 最大输出 Token 范围为 1-32768');
      }
    }
    if (key === 'system.jwt_secret' && String(value).length < 32) {
      return fail(res, 'JWT 密钥长度不得少于 32 字符');
    }
    if (key === 'system.aes_secret_key' && String(value).length < 32) {
      return fail(res, 'AES 加密密钥长度不得少于 32 字符');
    }

    // 学习课程配置校验
    if (key === 'course.points') {
      const num = Number(value);
      if (num < 0 || num > 1000) {
        return fail(res, '课程学习积分范围为 0-1000');
      }
    }
    if (key === 'course.progress_threshold') {
      const num = Number(value);
      if (num < 1 || num > 100) {
        return fail(res, '课程积分进度阈值范围为 1-100');
      }
    }
    if (key === 'course.daily_limit') {
      const num = Number(value);
      if (num < 1 || num > 50) {
        return fail(res, '每日课程学习上限范围为 1-50');
      }
    }
    if (key === 'course.default_duration') {
      const num = Number(value);
      if (num < 1 || num > 120) {
        return fail(res, '课程默认时长范围为 1-120 分钟');
      }
    }

    // Upsert 到 SystemConfig 表
    const [config, created] = await db.SystemConfig.findOrCreate({
      where: { config_key: key, category: 'system_setting' },
      defaults: {
        config_key: key,
        category: 'system_setting',
        config_value: configValue,
        value_type: schema.type,
        description: schema.description,
        updated_by: req.user.id
      }
    });

    if (!created) {
      await config.update({
        config_value: configValue,
        value_type: schema.type,
        description: schema.description,
        updated_by: req.user.id
      });
    }

    // 失效缓存
    configCache.invalidate('system_setting');

    // 特殊处理：JWT 密钥变更需记录警告
    if (key === 'system.jwt_secret') {
      logger.warn(`⚠️ JWT 密钥已变更，所有现有 Token 将失效，用户需重新登录。操作人: ${req.user.id}`);
    }
    if (key === 'system.aes_secret_key') {
      logger.warn(`⚠️ AES 加密密钥已变更，需重新加密所有敏感数据。操作人: ${req.user.id}`);
    }

    logger.info(`系统设置更新: key=${key}, sensitive=${schema.sensitive}, by=${req.user.id}`);

    // 返回脱敏结果
    return success(res, {
      key,
      label: schema.label,
      value: schema.sensitive ? '***已配置***' : (schema.type === 'number' ? Number(configValue) : configValue),
      type: schema.type,
      sensitive: schema.sensitive,
      source: 'database',
      updatedAt: config.updated_at
    }, '系统设置更新成功');
  } catch (err) {
    logger.error('更新系统设置失败:', err);
    return fail(res, '更新系统设置失败');
  }
});

/**
 * 获取系统设置 Schema（供前端动态渲染表单）
 * GET /api/admin/system-settings/schema
 */
router.get('/system-settings/schema', superAdminOnly, async (req, res) => {
  try {
    const groups = {};
    for (const [key, schema] of Object.entries(SYSTEM_SETTINGS_SCHEMA)) {
      if (!groups[schema.category]) {
        groups[schema.category] = {
          label: {
            wechat: '微信小程序配置',
            ai_text: 'AI 文本模型配置',
            ai_vision: 'AI 视觉模型配置',
            content_security: '内容安全配置',
            oss: 'OSS 存储配置',
            course: '学习课程配置',
            system: '系统安全配置'
          }[schema.category] || schema.category,
          items: []
        };
      }
      groups[schema.category].items.push({
        key,
        label: schema.label,
        type: schema.type,
        sensitive: schema.sensitive,
        description: schema.description
      });
    }

    return success(res, { schema: groups }, '获取 Schema 成功');
  } catch (err) {
    logger.error('获取系统设置 Schema 失败:', err);
    return fail(res, '获取 Schema 失败');
  }
});

module.exports = router;