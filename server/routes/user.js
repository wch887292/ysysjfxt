// routes/user.js - 用户路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, forbidden } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const { getTodayString } = require('../utils/date');
const { recalcHonor } = require('../utils/honor');
const { selfOnly, auditSensitiveOperation } = require('../middleware/accessControl');

/**
 * 将 User 记录映射为规格8.1 结构化格式
 * 输出分为三大块：user_identity / points / 保留原始DB字段（向后兼容）
 *
 * 字段映射关系（Schema名 ← DB名）：
 *   user_id         ← id
 *   wechat_openid   ← openid
 *   nickname         ← nick_name
 *   register_date   ← created_at
 *   last_active_date ← last_active_at
 *   available_points ← points（当前可用积分）
 */
function toUserProfile(user) {
  const data = user.toJSON();
  // 脱敏手机号
  if (data.phone_masked) {
    data.phone = data.phone_masked;
  }

  // ========== 规格8.1 结构化输出 ==========
  // user_identity（与 Schema 8.1 user_identity 完全对齐）
  data.user_identity = {
    user_id: data.id,
    identity_type: data.identity_type,
    share_code: data.share_code || null,
    agent_id: data.agent_id || null,
    // P0修复：不再在客户端响应中暴露 openid（敏感服务端标识，可被用于伪造身份）
    // wechat_openid 已从客户端响应中移除，仅服务端内部使用
    nickname: data.nick_name,
    real_name: data.real_name || null,
    is_real_name: !!data.is_real_name,
    register_date: data.created_at || null,
    last_assessment_date: data.last_assessment_date || null,
    assessment_count_this_month: data.assessment_count_this_month || 0,
    last_active_date: data.last_active_at || null,
    honor_level: data.honor_level,
    badges: data.badges || [],
    // 扩展字段（DB实际存在但 Schema 需补充）
    role: data.role,
    is_super: !!data.is_super,
    is_member: !!data.is_member,
    member_since: data.member_since || null,
    status: data.status,
    avatar_url: data.avatar_url || null,
    phone: data.phone || null,
    gender: data.gender || 'unknown',
    age: data.age || null,
    height: data.height || null,
    weight: data.weight || null,
    bmi: data.bmi || null
  };

  // points（与 Schema 8.1 points 完全对齐）
  data.points_info = {
    total_points: data.total_points || 0,
    available_points: data.points || 0,
    frozen_points: data.frozen_points || 0
  };

  // 兼容旧字段名（保留扁平结构供旧版前端使用）
  data.user_id = data.id;
  // P0修复：不再暴露 wechat_openid 给客户端
  data.nickname = data.nick_name;
  data.register_date = data.created_at;
  data.last_active_date = data.last_active_at;
  data.available_points = data.points;

  return data;
}

/**
 * GET /api/user/info
 */
router.get('/info', async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: { exclude: ['phone'] }
    });

    if (!user) {
      return fail(res, '用户不存在');
    }

    // 返回规格8.1标准格式（同时保留原始字段名向后兼容）
    return success(res, toUserProfile(user));
  } catch (err) {
    logger.error('获取用户信息失败:', err);
    return fail(res, '获取用户信息失败');
  }
});

/**
 * 更新用户信息
 * PUT /api/user/info
 */
router.put('/info', async (req, res) => {
  try {
    const { nickName, avatarUrl, gender, age, height, weight, phone } = req.body;

    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return fail(res, '用户不存在');
    }

    const updateData = {};
    if (nickName) updateData.nick_name = nickName;
    if (avatarUrl) updateData.avatar_url = avatarUrl;
    // P0修复：gender 白名单校验（防注入任意字符串）
    const ALLOWED_GENDERS = ['male', 'female', 'unknown'];
    if (gender) {
      if (!ALLOWED_GENDERS.includes(gender)) {
        return fail(res, 'gender 不合法');
      }
      updateData.gender = gender;
    }
    if (age) {
      if (typeof age !== 'number' || age < 0 || age > 200 || !Number.isInteger(age)) {
        return fail(res, 'age 不合法');
      }
      updateData.age = age;
    }
    if (height) {
      if (typeof height !== 'number' || height <= 0 || height > 300) {
        return fail(res, 'height 不合法');
      }
      updateData.height = height;
    }
    if (weight) {
      if (typeof weight !== 'number' || weight <= 0 || weight > 500) {
        return fail(res, 'weight 不合法');
      }
      updateData.weight = weight;
    }
    if (phone) {
      // 手机号格式校验（防注入任意字符串触发加密异常）
      if (typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone)) {
        return fail(res, '手机号格式不合法');
      }
      // P0修复：不再手动加密，交给 User.beforeSave 钩子统一处理（避免双重加密导致校验失败）
      updateData.phone = phone;
    }

    // 自动计算BMI
    if (height && weight) {
      const heightM = height / 100;
      updateData.bmi = (weight / (heightM * heightM)).toFixed(1);
    }

    await user.update(updateData);
    logger.info(`用户信息更新: ${user.id}`);

    const safeData = user.toJSON();
    delete safeData.phone;
    return success(res, safeData, '更新成功');
  } catch (err) {
    logger.error('更新用户信息失败:', err);
    return fail(res, '更新失败');
  }
});

/**
 * 获取用户仪表盘数据
 * GET /api/user/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.User.findByPk(userId);
    if (!user) {
      return fail(res, '用户不存在');
    }

    // 今日积分（使用业务时区计算，与 utils/date.js 对齐）
    const { getBusinessDayStart } = require('../utils/date');
    const todayStart = getBusinessDayStart();

    const todayPoints = await db.PointsHistory.sum('points', {
      where: {
        user_id: userId,
        type: 'earn',
        created_at: { [db.Sequelize.Op.gte]: todayStart }
      }
    }) || 0;

    // 排名
    const ranking = await db.User.count({
      where: {
        total_points: { [db.Sequelize.Op.gt]: user.total_points }
      }
    }) + 1;

    // 最近餐食
    const recentMeals = await db.Meal.findAll({
      where: { user_id: userId },
      order: [['upload_time', 'DESC']],
      limit: 5,
      attributes: ['id', 'image_url', 'meal_type', 'points', 'upload_time']
    });

    return success(res, {
      points: user.points,
      ranking,
      todayPoints,
      recentMeals
    });
  } catch (err) {
    logger.error('获取仪表盘数据失败:', err);
    return fail(res, '获取数据失败');
  }
});

/**
 * 获取信息可见范围设置（规格7.4：用户可设置信息可见范围）
 * GET /api/user/privacy/visibility
 */
router.get('/privacy/visibility', async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: ['visibility_settings']
    });
    if (!user) return fail(res, '用户不存在');

    // 默认值：未设置时全部为 true（兼容老用户）
    const defaults = { showProfile: true, showPhone: false, showHealthData: true, showReports: true };
    const settings = { ...defaults, ...(user.visibility_settings || {}) };

    return success(res, { visibilitySettings: settings }, '获取成功');
  } catch (err) {
    logger.error('获取可见范围设置失败:', err);
    return fail(res, '获取失败');
  }
});

/**
 * 更新信息可见范围设置（规格7.4：用户可设置信息可见范围）
 * PUT /api/user/privacy/visibility
 * body: { showProfile, showPhone, showHealthData, showReports }（均为 boolean，可选）
 */
router.put('/privacy/visibility', async (req, res) => {
  try {
    const ALLOWED_KEYS = ['showProfile', 'showPhone', 'showHealthData', 'showReports'];
    const updates = {};
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== 'boolean') {
          return fail(res, `${key} 必须为布尔值`);
        }
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return fail(res, '请至少提供一个有效字段');
    }

    const user = await db.User.findByPk(req.user.id);
    if (!user) return fail(res, '用户不存在');

    // 合并已有设置
    const defaults = { showProfile: true, showPhone: false, showHealthData: true, showReports: true };
    const current = { ...defaults, ...(user.visibility_settings || {}) };
    const nextSettings = { ...current, ...updates };

    await user.update({ visibility_settings: nextSettings });

    logger.info(`用户${req.user.id}更新可见范围设置`);
    return success(res, { visibilitySettings: nextSettings }, '设置已保存');
  } catch (err) {
    logger.error('更新可见范围设置失败:', err);
    return fail(res, '保存失败');
  }
});

/**
 * 导出个人数据（规格7.4：数据导出/删除支持）
 * GET /api/user/export-data
 * 返回用户所有数据的 JSON（用户信息、问卷、打卡、积分、报告等）
 */
router.get('/export-data', async (req, res) => {
  try {
    auditSensitiveOperation(req, 'DATA_EXPORT');
    const userId = req.user.id;

    const [user, questionnaires, clockIns, pointsHistory, reports, courseRecords, signIns] = await Promise.all([
      db.User.findByPk(userId, { attributes: { exclude: ['phone'] } }),
      db.Questionnaire.findAll({ where: { user_id: userId }, include: [{ model: db.QuestionnaireAnswer, as: 'answers' }] }),
      db.ClockInRecord.findAll({ where: { user_id: userId } }),
      db.PointsHistory.findAll({ where: { user_id: userId } }),
      db.Report.findAll({ where: { user_id: userId } }),
      db.CourseRecord.findAll({ where: { user_id: userId } }),
      db.SignInRecord.findAll({ where: { user_id: userId } })
    ]);

    if (!user) return fail(res, '用户不存在');

    const userData = user.toJSON();
    if (userData.phone_masked) userData.phone = userData.phone_masked;

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userData,
      questionnaires,
      clockIns,
      pointsHistory,
      reports,
      courseRecords,
      signIns
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}-${Date.now()}.json"`);
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    logger.error('导出用户数据失败:', err);
    return fail(res, '导出数据失败');
  }
});

/**
 * 申请删除账号数据（规格7.4：数据导出/删除支持）
 * POST /api/user/request-deletion
 * 创建删除申请记录，由后台人工审核后执行（防误触+合规留痕）
 */
router.post('/request-deletion', async (req, res) => {
  try {
    auditSensitiveOperation(req, 'ACCOUNT_DELETION');
    const userId = req.user.id;
    const { reason } = req.body;

    const user = await db.User.findByPk(userId);
    if (!user) return fail(res, '用户不存在');

    // 检查是否已有待处理的删除申请
    const existing = await db.DataExportRequest.findOne({
      where: {
        user_id: userId,
        type: 'deletion',
        status: 'pending'
      }
    });
    if (existing) {
      return fail(res, '您已有待处理的删除申请，请等待审核');
    }

    const request = await db.DataExportRequest.create({
      user_id: userId,
      type: 'deletion',
      reason: reason || '用户主动申请',
      status: 'pending'
    });

    return success(res, {
      requestId: request.id,
      status: 'pending',
      message: '删除申请已提交，将在3个工作日内审核处理'
    }, '删除申请已提交');
  } catch (err) {
    logger.error('创建删除申请失败:', err);
    return fail(res, '提交申请失败');
  }
});

// ============================================================
// 资讯/公告（用户端）
// ============================================================

/**
 * 获取已发布资讯列表
 * GET /api/user/articles?category=news&page=1&pageSize=10
 *
 * 用户端仅能查看 status=published 的文章，按 sort_order DESC + published_at DESC 排序
 */
router.get('/articles', async (req, res) => {
  try {
    const { category, page = 1, pageSize = 10 } = req.query;
    const where = { status: 'published' };
    if (category) where.category = category;

    const { rows, count } = await db.Article.findAndCountAll({
      where,
      order: [['sort_order', 'DESC'], ['published_at', 'DESC']],
      limit: Math.min(Number(pageSize), 50),
      offset: (Number(page) - 1) * Number(pageSize),
      attributes: ['id', 'title', 'summary', 'cover_image', 'category', 'published_at', 'view_count', 'sort_order']
    });

    return success(res, { articles: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    logger.error('获取资讯列表失败:', err);
    return fail(res, '获取资讯列表失败');
  }
});

/**
 * 获取资讯详情
 * GET /api/user/articles/:id
 *
 * 自动增加浏览量，仅返回已发布文章
 */
router.get('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await db.Article.findByPk(id);

    if (!article || article.status !== 'published') {
      return fail(res, '资讯不存在或已下架');
    }

    // 原子性增加浏览量（防并发重复计数）
    await db.Article.increment('view_count', { where: { id } });
    article.view_count += 1;

    return success(res, { article });
  } catch (err) {
    logger.error('获取资讯详情失败:', err);
    return fail(res, '获取资讯详情失败');
  }
});

module.exports = router;