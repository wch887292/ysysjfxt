// routes/agent.js - Agent服务商路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, forbidden } = require('../utils/response');
const logger = require('../utils/logger');
const { agentOnly } = require('../middleware/auth');
const { maskPhone } = require('../utils/encrypt');
const { deductPoints } = require('./points');
const contentSecurity = require('../services/contentSecurity');

// 允许的mealType白名单
const ALLOWED_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * P0修复：转义SQL LIKE通配符（%和_），防止通配符注入导致全表扫描DoS
 */
function escapeLikeWildcard(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

/**
 * 简单HTML净化：转义危险字符，防止XSS
 * 微信小程序不渲染HTML，因此全量转义即可
 */
function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * 规范化分页参数
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// 所有Agent路由需要agent/admin权限
router.use(agentOnly);

/**
 * 自定义错误类：代理商身份校验失败
 * 用于在 getAgentId 抛出后，路由 catch 中识别并返回 403
 */
class AgentAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentAuthError';
    this.statusCode = 403;
  }
}

/**
 * 统一 catch 块错误处理：识别 AgentAuthError 返回 403，其余按业务消息返回 400
 * 各路由 catch 块统一调用此函数，避免遗漏 AgentAuthError 处理导致 400 而非 403
 */
function handleRouteError(res, err, defaultMessage) {
  if (err instanceof AgentAuthError) {
    return forbidden(res, err.message);
  }
  logger.error(defaultMessage + ':', err);
  return fail(res, defaultMessage);
}

/**
 * 获取当前用户关联的Agent ID
 * 修复：原代码对 misconfigured agent（agent 关联为空）返回 null，
 * 后续 whereClause 为空对象导致该代理商账号可查看全部用户/餐食/活动，构成数据越权。
 * 现改为：非 admin 角色取不到 agentId 时抛 403，避免失败开放。
 * 同时优先使用 JWT 中已有的 agent_id（auth.js 第42行），避免冗余 DB 查询。
 */
async function getAgentId(req) {
  if (req.user.role === 'admin') return null;
  // JWT payload 已含 agent_id（auth.js generateToken 第42行），优先使用
  const jwtAgentId = req.user.agent_id;
  if (jwtAgentId) return jwtAgentId;
  // JWT 无 agent_id 时回退查 DB（兼容旧 token）
  const user = await db.User.findByPk(req.user.id, {
    include: [{ model: db.Agent, as: 'agent' }]
  });
  if (!user || !user.agent) {
    throw new AgentAuthError('无法确定代理商身份，请联系管理员配置代理商归属');
  }
  return user.agent.id;
}

/**
 * 获取统计数据
 * GET /api/agent/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const agentId = await getAgentId(req);

    // 代理商：统计自己名下 + 关联服务商的数据
    // 获取关联服务商ID
    let spId = null;
    if (agentId) {
      const agent = await db.Agent.findByPk(agentId);
      if (agent && agent.service_provider_id) {
        spId = agent.service_provider_id;
      }
    }

    // 构建用户查询条件：代理商名下 OR 关联服务商名下
    const userWhere = { status: 'active' };
    if (agentId && spId) {
      userWhere[db.Sequelize.Op.or] = [{ agent_id: agentId }, { service_provider_id: spId }];
    } else if (agentId) {
      userWhere.agent_id = agentId;
    }

    // 时间基准
    const _now = new Date();
    const todayStart = new Date(Date.UTC(_now.getUTCFullYear(), _now.getUTCMonth(), _now.getUTCDate()) - 8 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 用户统计
    const totalUsers = await db.User.count({ where: userWhere });
    const activeUsersToday = await db.User.count({ where: { ...userWhere, last_active_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const activeUsersWeek = await db.User.count({ where: { ...userWhere, last_active_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const activeUsersMonth = await db.User.count({ where: { ...userWhere, last_active_at: { [db.Sequelize.Op.gte]: monthStart } } });
    const newUsersToday = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const newUsersWeek = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const newUsersMonth = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: monthStart } } });
    const totalMembers = await db.User.count({ where: { ...userWhere, is_member: true } });

    // 积分统计
    const totalPoints = await db.User.sum('points', { where: userWhere }) || 0;
    const totalPointsIssued = await db.User.sum('total_points', { where: userWhere }) || 0;

    // 获取关联用户ID列表（用于业务统计）
    const userIds = await db.User.findAll({ where: userWhere, attributes: ['id'] }).then(rows => rows.map(u => u.id));
    const userIdIn = userIds.length ? { [db.Sequelize.Op.in]: userIds } : { [db.Sequelize.Op.eq]: '__none__' };

    // 业务统计
    const todayCheckIns = await db.ClockInRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const todaySignIns = await db.SignInRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalCourses = await db.CourseRecord.count({ where: { user_id: userIdIn } });
    const todayCourses = await db.CourseRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalMeals = await db.Meal.count({ where: { user_id: userIdIn } });
    const todayUploads = await db.Meal.count({ where: { user_id: userIdIn, upload_time: { [db.Sequelize.Op.gte]: todayStart } } });

    // 报告
    const totalReports = await db.Report.count({ where: { user_id: userIdIn } });
    const pendingReports = await db.Report.count({ where: { user_id: userIdIn, flagged: true, review_status: 'pending' } });

    // 分润
    const agentWhere = agentId ? { agent_id: agentId } : {};
    const totalCommissions = await db.Commission.count({ where: agentWhere });
    const pendingCommissions = await db.Commission.count({ where: { ...agentWhere, status: 'pending' } });
    const settledCommissions = await db.Commission.count({ where: { ...agentWhere, status: 'settled' } });

    // 礼品兑换
    const totalExchanges = await db.GiftExchange.count({ where: { user_id: userIdIn } });
    const todayExchanges = await db.GiftExchange.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });

    // 服务商统计（关联服务商的数据）
    let spStats = null;
    if (spId) {
      const spUserWhere = { service_provider_id: spId, status: 'active' };
      const spUserCount = await db.User.count({ where: spUserWhere });
      const spActiveToday = await db.User.count({ where: { ...spUserWhere, last_active_at: { [db.Sequelize.Op.gte]: todayStart } } });
      const spTotalReceptions = await db.ServiceProviderReception.count({ where: { service_provider_id: spId } });
      const spTodayReceptions = await db.ServiceProviderReception.count({ where: { service_provider_id: spId, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
      spStats = { spUserCount, spActiveToday, spTotalReceptions, spTodayReceptions };
    }

    return success(res, {
      // 用户
      totalUsers, totalMembers, newUsersToday, newUsersWeek, newUsersMonth,
      // 活跃
      activeUsersToday, activeUsersWeek, activeUsersMonth,
      // 积分
      totalPoints, totalPointsIssued,
      // 业务
      totalMeals, todayUploads, todayCheckIns, todaySignIns, totalCourses, todayCourses,
      // 报告
      totalReports, pendingReports,
      // 分润
      totalCommissions, pendingCommissions, settledCommissions,
      // 礼品兑换
      totalExchanges, todayExchanges,
      // 关联服务商数据
      serviceProviderStats: spStats
    });
  } catch (err) {
    return handleRouteError(res, err, '获取统计数据失败');
  }
});

/**
 * 获取用户列表
 * GET /api/agent/users
 */
router.get('/users', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const keyword = (req.query.keyword || '').toString().slice(0, 50);

    const agentId = await getAgentId(req);

    const whereClause = {};
    if (agentId) {
      whereClause.agent_id = agentId;
    }
    if (keyword) {
      const safeKw = escapeLikeWildcard(keyword);
      whereClause[db.Sequelize.Op.or] = [
        { nick_name: { [db.Sequelize.Op.like]: `%${safeKw}%` } },
        { phone_masked: { [db.Sequelize.Op.like]: `%${safeKw}%` } }
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where: whereClause,
      order: [['last_active_at', 'DESC']],
      limit: parseInt(pageSize),
      offset,
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'status', 'last_active_at']
    });

    // 脱敏处理 + 规格9.4 响应双写（snake_case + camelCase）
    // 修复：原仅返回 snake_case 字段(nick_name/avatar_url)，前端用 camelCase 取值导致头像/昵称不显示
    const users = rows.map(u => {
      const data = u.toJSON();
      data.phone = data.phone_masked;
      // camelCase 双写，兼容前端 item.nickName / item.avatarUrl / item.lastActiveAt
      data.nickName = data.nick_name;
      data.avatarUrl = data.avatar_url;
      data.lastActiveAt = data.last_active_at;
      return data;
    });

    return success(res, {
      users,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取用户列表失败');
  }
});

/**
 * 获取3天未活跃会员列表（方案3.5 流失预警 - 代理商视角）
 * GET /api/agent/users/inactive
 *
 * 与 service-provider /users/inactive 对等，但按 agent_id 过滤名下会员。
 * 返回字段含 days_inactive（已未活跃天数），便于代理商按紧急程度排序跟进。
 *
 * 查询参数：
 *   - days: 自定义预警阈值（默认3，方案3.5规定），允许代理商查"7天未活跃"等扩展场景
 *   - page / pageSize: 分页（默认1/50，与 /users 一致）
 */
router.get('/users/inactive', async (req, res) => {
  try {
    const agentId = await getAgentId(req);

    // 预警阈值：方案3.5 默认3天，允许 [1, 30] 范围自定义
    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 3));
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 分页：默认 pageSize=50（预警列表通常需一次性查看更多），上限100
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const reqPageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 50;
    const limit = Math.min(100, Math.max(1, reqPageSize));
    const offset = (page - 1) * limit;

    const whereClause = {
      is_member: true,
      status: 'active',
      last_active_at: { [db.Sequelize.Op.lt]: threshold }
    };
    if (agentId) {
      whereClause.agent_id = agentId;
    }

    const { count, rows } = await db.User.findAndCountAll({
      where: whereClause,
      order: [['last_active_at', 'ASC']], // 最久未活跃的在前
      limit,
      offset,
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'last_active_at']
    });

    // 计算 days_inactive（基于 last_active_at 与当前时间差）+ 规格9.4 响应双写
    const now = Date.now();
    const users = rows.map(u => {
      const data = u.toJSON();
      data.phone = data.phone_masked;
      data.nickName = data.nick_name;
      data.avatarUrl = data.avatar_url;
      data.lastActiveAt = data.last_active_at;
      const lastTs = data.last_active_at ? new Date(data.last_active_at).getTime() : now;
      data.days_inactive = Math.floor((now - lastTs) / (24 * 60 * 60 * 1000));
      return data;
    });

    return success(res, {
      users,
      total: count,
      thresholdDays: days,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取未活跃会员列表失败');
  }
});

/**
 * 获取活动记录
 * GET /api/agent/activities
 */
router.get('/activities', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    const whereClause = {};

    if (agentId) {
      const userIds = await db.User.findAll({
        where: { agent_id: agentId },
        attributes: ['id']
      }).then(rows => rows.map(u => u.id));
      whereClause.user_id = { [db.Sequelize.Op.in]: userIds };
    }

    const recentMeals = await db.Meal.findAll({
      where: whereClause,
      order: [['upload_time', 'DESC']],
      limit: 10,
      include: [{ model: db.User, as: 'user', attributes: ['nick_name'] }]
    });

    const activities = recentMeals.map(m => ({
      id: m.id,
      description: `${m.user ? m.user.nick_name : '未知用户'} 上传了${m.meal_type}`,
      time: m.upload_time
    }));

    return success(res, { activities });
  } catch (err) {
    return handleRouteError(res, err, '获取活动记录失败');
  }
});

/**
 * 获取名下用户餐食列表（供审核页使用）
 * GET /api/agent/meals?status=pending|approved|rejected
 */
router.get('/meals', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const agentId = await getAgentId(req);

    const whereClause = {};
    const ALLOWED_STATUS = ['pending', 'approved', 'rejected'];
    if (req.query.status && ALLOWED_STATUS.includes(req.query.status)) {
      whereClause.status = req.query.status;
    }
    if (agentId) {
      const userIds = await db.User.findAll({
        where: { agent_id: agentId },
        attributes: ['id']
      }).then(rows => rows.map(u => u.id));
      whereClause.user_id = { [db.Sequelize.Op.in]: userIds };
    }

    const { count, rows } = await db.Meal.findAndCountAll({
      where: whereClause,
      order: [['upload_time', 'DESC']],
      limit: pageSize,
      offset,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'nick_name', 'avatar_url'] }]
    });

    return success(res, {
      meals: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取餐食列表失败');
  }
});

/**
 * 审核餐食
 * PUT /api/agent/meals/:id/review
 */
router.put('/meals/:id/review', async (req, res) => {
  try {
    const { status, comment } = req.body;
    const mealId = req.params.id;
    const agentId = await getAgentId(req);

    // P0修复：status 必须显式校验为合法值，禁止传入任意字符串污染数据库
    const ALLOWED_REVIEW_STATUS = ['approved', 'rejected'];
    if (!ALLOWED_REVIEW_STATUS.includes(status)) {
      return fail(res, '审核状态不合法，仅支持 approved/rejected');
    }

    const meal = await db.Meal.findByPk(mealId, {
      include: [{ model: db.User, as: 'user', attributes: ['agent_id'] }]
    });
    if (!meal) {
      return fail(res, '餐食记录不存在');
    }

    // P0修复：meal.user 可能为 null（用户被删除），需空指针保护避免 TypeError
    if (agentId && (!meal.user || meal.user.agent_id !== agentId)) {
      return forbidden(res, '无权审核该餐食');
    }

    await meal.update({
      status,
      review_comment: comment || ''
    });

    return success(res, null, '审核完成');
  } catch (err) {
    return handleRouteError(res, err, '审核失败');
  }
});

/**
 * 积分核销
 * POST /api/agent/points/write-off
 */
router.post('/points/write-off', async (req, res) => {
  try {
    // 规格9.4 tolerant reader：同时接受 snake_case 和 camelCase
    const userId = req.body.user_id || req.body.userId;
    const points = req.body.points;
    const giftDescription = req.body.gift_description || req.body.giftDescription;
    const remark = req.body.remark;
    const idempotencyKey = req.body.idempotency_key || req.body.idempotencyKey;
    const agentId = await getAgentId(req);

    // V1修复：严格校验points必须为正整数，防止负积分刷分
    if (!userId || !giftDescription) {
      return fail(res, '缺少必要参数');
    }
    if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0 || !Number.isInteger(points)) {
      return fail(res, '积分必须为正整数');
    }
    if (points > 100000) {
      return fail(res, '单次核销积分超出合理范围');
    }
    if (typeof giftDescription !== 'string' || giftDescription.length > 200) {
      return fail(res, '礼品描述不合法');
    }
    if (remark && (typeof remark !== 'string' || remark.length > 500)) {
      return fail(res, '备注不合法');
    }
    // P0修复：幂等键必传（防双击/网络重试导致重复扣积分）
    // 前端 api.js writeOffPoints 已自动生成幂等键，write-off.js 也手动生成，后端再兜底强制要求
    if (!idempotencyKey) {
      return fail(res, '缺少幂等键，请通过正规接口调用');
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }
    if (!agentId) {
      return fail(res, '仅代理商可执行积分核销');
    }

    // 使用事务确保数据一致性
    const t = await db.sequelize.transaction();
    try {
      // V11修复：对会员行加锁，串行化并发核销，防止并发重复扣积分
      const user = await db.User.findByPk(userId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!user) {
        await t.rollback();
        return fail(res, '用户不存在');
      }

      // 只能核销名下用户的积分
      if (user.agent_id !== agentId) {
        await t.rollback();
        return forbidden(res, '无权核销该用户积分');
      }

      if (user.points < points) {
        await t.rollback();
        return fail(res, '用户积分不足');
      }

      // V11修复：幂等校验——同一幂等键已核销过则直接返回原记录，避免重复扣积分
      // 必须在加锁后执行，才能看到已提交的其他事务记录
      if (idempotencyKey) {
        const existed = await db.PointsWriteOff.findOne({
          where: { idempotency_key: idempotencyKey },
          transaction: t
        });
        if (existed) {
          await t.rollback();
          return success(res, {
            newBalance: user.points,
            writeOffId: existed.id,
            writeOffTime: existed.write_off_date,
            duplicated: true,
            // 规格9.4 snake_case 字段
            new_balance: user.points,
            write_off_id: existed.id,
            write_off_time: existed.write_off_date
          }, '核销成功（幂等返回）');
        }
      }

      // 扣除积分（统一积分操作）
      const deductResult = await deductPoints(
        userId,
        points,
        'agent_write_off',
        `积分核销: ${giftDescription}`,
        null,
        t,
        'write_off'
      );

      // 创建核销记录（幂等键必传，唯一索引兜底并发重复提交）
      const record = await db.PointsWriteOff.create({
        user_id: userId,
        agent_id: agentId,
        points,
        gift_description: giftDescription,
        remark: remark || '',
        write_off_date: new Date(),
        idempotency_key: idempotencyKey
      }, { transaction: t });

      await t.commit();
      return success(res, {
        newBalance: deductResult.points,
        writeOffId: record.id,
        writeOffTime: record.write_off_date,
        // 规格9.4 snake_case 字段
        new_balance: deductResult.points,
        write_off_id: record.id,
        write_off_time: record.write_off_date
      }, '核销成功');
    } catch (err) {
      await t.rollback();
      // V11修复：并发重复提交触发唯一索引冲突时，回查已有记录幂等返回
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        try {
          const existed = await db.PointsWriteOff.findOne({ where: { idempotency_key: idempotencyKey } });
          if (existed) {
            return success(res, {
              newBalance: null,
              writeOffId: existed.id,
              writeOffTime: existed.write_off_date,
              duplicated: true,
              // 规格9.4 snake_case 字段
              new_balance: null,
              write_off_id: existed.id,
              write_off_time: existed.write_off_date
            }, '核销成功（幂等返回）');
          }
        } catch (_) { /* 回查失败则按原错误抛出 */ }
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, '核销失败');
  }
});

/**
 * 发布图文信息
 * POST /api/agent/posts
 */
router.post('/posts', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    // 规格9.5 tolerant reader：同时接受 snake_case 和 camelCase
    const title = req.body.title;
    const content = req.body.content;
    const images = req.body.images;
    const companyName = req.body.company_name || req.body.companyName;
    const idempotencyKey = req.body.idempotency_key || req.body.idempotencyKey;
    if (!title || !content) {
      return fail(res, '缺少标题或内容');
    }
    if (typeof title !== 'string' || title.length > 100) {
      return fail(res, '标题不合法');
    }
    if (typeof content !== 'string' || content.length > 5000) {
      return fail(res, '内容超出长度限制');
    }
    if (companyName && (typeof companyName !== 'string' || companyName.length > 100)) {
      return fail(res, '公司名不合法');
    }
    // P0修复：幂等键校验（防网络重试/双击导致重复发布）
    if (!idempotencyKey) {
      return fail(res, '缺少幂等键，请通过正规接口调用');
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }
    // V9修复：净化HTML，防止XSS
    const safeTitle = sanitizeText(title);
    const safeContent = sanitizeText(content);
    const safeCompanyName = companyName ? sanitizeText(companyName) : '';
    let safeImages = [];
    if (Array.isArray(images)) {
      // 限制数量与长度，并校验URL格式
      safeImages = images
        .filter(img => typeof img === 'string' && /^\/uploads\/[A-Za-z0-9_\-/.]+$/.test(img))
        .slice(0, 9);
    }

    // P0修复：幂等检查——同一幂等键已发布过则直接返回原记录
    const existed = await db.AgentPost.findOne({ where: { idempotency_key: idempotencyKey } });
    if (existed) {
      return success(res, {
        publishId: existed.id,
        status: existed.status,
        message: '信息已发布（幂等返回）',
        publish_id: existed.id,
        duplicated: true
      }, '发布成功（幂等返回）');
    }

    // 内容安全检测（文本）
    const textCheckResult = await contentSecurity.checkText(`${safeTitle} ${safeContent}`);
    if (!textCheckResult.pass) {
      return fail(res, `内容不合规: ${textCheckResult.message}`);
    }

    let post;
    try {
      post = await db.AgentPost.create({
        agent_id: agentId,
        company_name: safeCompanyName,
        title: safeTitle,
        content: safeContent,
        images: safeImages,
        status: 'pending_review',
        idempotency_key: idempotencyKey
      });
    } catch (createErr) {
      // 并发重复提交触发唯一索引冲突，回查返回
      if (createErr.name === 'SequelizeUniqueConstraintError') {
        const existed2 = await db.AgentPost.findOne({ where: { idempotency_key: idempotencyKey } });
        if (existed2) {
          return success(res, {
            publishId: existed2.id,
            status: existed2.status,
            publish_id: existed2.id,
            duplicated: true
          }, '发布成功（幂等返回）');
        }
      }
      throw createErr;
    }

    logger.info(`代理商发布信息: ${post.id}, 代理商${agentId}`);
    return success(res, {
      publishId: post.id,
      status: post.status,
      message: '信息发布成功，等待总部审核',
      // 规格9.5 snake_case 字段
      publish_id: post.id
    }, '发布成功');
  } catch (err) {
    return handleRouteError(res, err, '发布失败');
  }
});

/**
 * 获取自己发布的图文信息列表
 * GET /api/agent/posts
 */
router.get('/posts', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const { page, pageSize, offset } = parsePagination(req.query);

    // P0修复：支持按 status 筛选（pending_review/approved/rejected），原代码忽略此参数
    const whereClause = { agent_id: agentId };
    const ALLOWED_POST_STATUS = ['pending_review', 'approved', 'rejected'];
    if (req.query.status && ALLOWED_POST_STATUS.includes(req.query.status)) {
      whereClause.status = req.query.status;
    }

    const { count, rows } = await db.AgentPost.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      posts: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取列表失败');
  }
});

/**
 * 获取专属拉新二维码数据（分享码）
 * GET /api/agent/share-code
 */
router.get('/share-code', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent) {
      return fail(res, '代理商不存在');
    }

    // 如未生成分享码，自动生成
    let shareCode = agent.share_code;
    if (!shareCode) {
      shareCode = `AGT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await agent.update({ share_code: shareCode });
    }

    return success(res, {
      shareCode,
      qrContent: `pages/index/index?shareCode=${shareCode}&agentId=${agentId}`
    });
  } catch (err) {
    return handleRouteError(res, err, '获取失败');
  }
});

/**
 * 获取代理商分润记录
 * GET /api/agent/commissions
 *
 * 方案3.4：代理商可查看自己的分润明细和汇总。
 * 支持按 source（gift_exchange/write_off/member_service/other）、
 * status（pending/settled/cancelled）、period（YYYY-MM）筛选。
 * 返回分润列表 + 汇总数据（待结算总额、已结算总额、总金额）。
 */
router.get('/commissions', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    const isAdmin = req.user.role === 'admin';

    // admin 角色可查看所有分润记录，agent 角色仅能查看自己的
    if (!agentId && !isAdmin) {
      return fail(res, '仅代理商可查询分润记录');
    }

    const { page, pageSize, offset } = parsePagination(req.query);

    const whereClause = {};
    if (agentId) {
      whereClause.agent_id = agentId;
    }

    // admin 可按代理商筛选
    if (isAdmin && req.query.agentId) {
      whereClause.agent_id = req.query.agentId;
    }

    // 支持按来源筛选
    const ALLOWED_SOURCES = ['gift_exchange', 'write_off', 'member_service', 'other'];
    if (req.query.source && ALLOWED_SOURCES.includes(req.query.source)) {
      whereClause.source = req.query.source;
    }

    // 支持按状态筛选
    const ALLOWED_COMMISSION_STATUS = ['pending', 'settled', 'cancelled'];
    if (req.query.status && ALLOWED_COMMISSION_STATUS.includes(req.query.status)) {
      whereClause.status = req.query.status;
    }

    // 支持按结算周期筛选（YYYY-MM 格式）
    if (req.query.period && /^\d{4}-\d{2}$/.test(req.query.period)) {
      whereClause.period = req.query.period;
    }

    const includeOptions = [
      { model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] }
    ];

    // admin 角色额外包含代理商信息
    if (isAdmin) {
      includeOptions.push({ model: db.Agent, as: 'agent', attributes: ['id', 'name', 'company_name'] });
    }

    const { count, rows } = await db.Commission.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      include: includeOptions
    });

    // 汇总数据
    const summaryWhere = {};
    if (agentId) {
      summaryWhere.agent_id = agentId;
    }
    if (isAdmin && req.query.agentId) {
      summaryWhere.agent_id = req.query.agentId;
    }

    const pendingTotal = await db.Commission.sum('amount', {
      where: { ...summaryWhere, status: 'pending' }
    }) || 0;
    const settledTotal = await db.Commission.sum('amount', {
      where: { ...summaryWhere, status: 'settled' }
    }) || 0;
    const allTotal = await db.Commission.sum('amount', {
      where: { ...summaryWhere, status: { [db.Sequelize.Op.ne]: 'cancelled' } }
    }) || 0;

    return success(res, {
      commissions: rows,
      total: count,
      summary: {
        pendingTotal,
        settledTotal,
        allTotal
      },
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取分润记录失败');
  }
});

// ============================================================
// 流失预警推送（方案3.5：会员3天无活跃 → 后台自动提醒 → 主动跟进）
// ============================================================

/**
 * 获取待跟进的流失预警列表
 * GET /api/agent/alerts
 *
 * 返回由定时任务（inactive-alert-job）自动生成的 InactiveAlert 记录，
 * 仅返回 followed_up_at IS NULL 的待跟进预警，按未活跃天数降序（最紧急的在前）。
 *
 * 查询参数：
 *   - status: 'pending'（默认，待跟进）/ 'followed'（已跟进）/ 'all'
 *   - page / pageSize: 分页
 */
router.get('/alerts', async (req, res) => {
  try {
    const agentId = await getAgentId(req);

    const { page, pageSize, offset } = parsePagination(req.query);
    const ALLOWED_STATUS = ['pending', 'followed', 'all'];
    const status = ALLOWED_STATUS.includes(req.query.status) ? req.query.status : 'pending';

    const whereClause = {};
    if (agentId) {
      whereClause.agent_id = agentId;
    } else {
      // admin 无 agentId 限制，但必须有筛选条件避免全表扫描
      whereClause.alert_type = 'agent_notified';
    }
    if (status === 'pending') {
      whereClause.followed_up_at = null;
    } else if (status === 'followed') {
      whereClause.followed_up_at = { [db.Sequelize.Op.ne]: null };
    }

    const { count, rows } = await db.InactiveAlert.findAndCountAll({
      where: whereClause,
      order: [['days_inactive', 'DESC'], ['notified_at', 'DESC']],
      limit: pageSize,
      offset,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'last_active_at'] }]
    });

    // 规格9.4 响应双写 + 计算 days_inactive（基于 last_active_at 实时计算，与列表展示一致）
    const now = Date.now();
    const alerts = rows.map(a => {
      const data = a.toJSON();
      const user = data.user || {};
      const lastTs = user.last_active_at ? new Date(user.last_active_at).getTime() : null;
      return {
        id: data.id,
        userId: data.user_id,
        daysInactive: data.days_inactive,
        alertType: data.alert_type,
        notifiedAt: data.notified_at,
        followedUpAt: data.followed_up_at,
        followUpResult: data.follow_up_result,
        // 嵌套用户信息 + camelCase 双写
        userName: user.nick_name || '未知用户',
        userAvatar: user.avatar_url,
        userPhone: user.phone_masked,
        userLastActiveAt: user.last_active_at,
        // snake_case
        user_id: data.user_id,
        days_inactive: data.days_inactive,
        alert_type: data.alert_type,
        notified_at: data.notified_at,
        followed_up_at: data.followed_up_at,
        follow_up_result: data.follow_up_result
      };
    });

    return success(res, {
      alerts,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取流失预警列表失败');
  }
});

/**
 * 标记预警为已跟进
 * PUT /api/agent/alerts/:id/follow-up
 *
 * body: { followUpResult: '已电话联系'|'已到店拜访'|'暂未联系上'|... }
 *
 * 业务流程：代理商看到预警 → 主动联系会员 → 记录跟进结果 → 标记为已跟进
 */
router.put('/alerts/:id/follow-up', async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = await getAgentId(req);
    const { followUpResult } = req.body;

    if (!followUpResult || typeof followUpResult !== 'string' || followUpResult.length === 0) {
      return fail(res, '请填写跟进结果');
    }
    if (followUpResult.length > 255) {
      return fail(res, '跟进结果不超过255字');
    }

    const alert = await db.InactiveAlert.findByPk(id);
    if (!alert) {
      return fail(res, '预警记录不存在');
    }

    // 数据隔离：只能跟进自己的预警
    if (agentId && alert.agent_id !== agentId) {
      return forbidden(res, '无权操作该预警记录');
    }

    await alert.update({
      followed_up_at: new Date(),
      follow_up_result: followUpResult
    });

    logger.info(`流失预警跟进: alertId=${id}, 结果=${followUpResult}, by=${req.user.id}`);

    return success(res, {
      alertId: alert.id,
      followedUpAt: alert.followed_up_at,
      followUpResult: alert.follow_up_result
    }, '已记录跟进结果');
  } catch (err) {
    return handleRouteError(res, err, '标记跟进失败');
  }
});

// ============================================================
// 会员转化（方案3.2：引导到店 → 线下讲解 → 会员转化）
// ============================================================

/**
 * 将名下用户转化为会员
 * POST /api/agent/users/:id/convert-to-member
 *
 * 业务流程：游客/用户完成问卷 → 生成危机钩子报告 → 引导到店 →
 *           代理商线下讲解完整报告 → 主动转化为会员
 *
 * 权限：仅代理商可操作（admin 走 /api/admin/users/:id/role），
 *      且只能转化名下用户（agent_id 匹配），防止越权转化。
 *
 * body:
 *   - remark?: 转化备注（如"已讲解完整报告，客户同意开通会员"）
 *   - idempotencyKey: 幂等键（防双击/重试导致重复触发）
 */
router.post('/users/:id/convert-to-member', async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { remark, idempotencyKey } = req.body;
    const agentId = await getAgentId(req);

    if (!agentId) {
      return fail(res, '仅代理商可执行会员转化');
    }

    // 幂等键必传（防双击/网络重试导致重复触发转化流程）
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }
    if (remark && (typeof remark !== 'string' || remark.length > 500)) {
      return fail(res, '备注不合法');
    }

    const t = await db.sequelize.transaction();
    try {
      // 对用户行加锁，防止并发转化
      const user = await db.User.findByPk(userId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!user) {
        await t.rollback();
        return fail(res, '用户不存在');
      }

      // 数据隔离：只能转化名下用户
      if (user.agent_id !== agentId) {
        await t.rollback();
        return forbidden(res, '无权转化该用户');
      }

      // 幂等校验：已转化过则直接返回
      if (user.is_member && user.member_since) {
        await t.rollback();
        return success(res, {
          userId: user.id,
          isMember: true,
          memberSince: user.member_since,
          duplicated: true
        }, '该用户已是会员（幂等返回）');
      }

      // 执行会员转化：置 is_member=true、identity_type='member'、记录转化时间
      const now = new Date();
      await user.update({
        is_member: true,
        identity_type: 'member',
        member_since: now,
        last_active_at: now
      }, { transaction: t });

      await t.commit();

      logger.info(`会员转化成功: 用户${userId}, 代理商${agentId}, 备注=${remark || ''}`);
      return success(res, {
        userId: user.id,
        isMember: true,
        memberSince: now
      }, '会员转化成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, '会员转化失败');
  }
});

// ============================================================
// 代理商查看关联服务商数据（权限规则：代理商可查看服务商的数据）
// ============================================================

/**
 * 获取关联服务商的客户列表
 * GET /api/agent/service-provider/users
 *
 * 代理商通过 Agent.service_provider_id 关联服务商，
 * 可查看该服务商名下的客户用户列表。
 */
router.get('/service-provider/users', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    // 获取代理商关联的服务商ID
    const agent = await db.Agent.findByPk(agentId);
    if (!agent || !agent.service_provider_id) {
      return fail(res, '当前代理商未关联服务商，无法查看服务商数据');
    }

    const providerId = agent.service_provider_id;
    const { page, pageSize, offset } = parsePagination(req.query);
    const keyword = (req.query.keyword || '').toString().slice(0, 50);

    const whereClause = { service_provider_id: providerId, role: 'user' };
    if (keyword) {
      const safeKw = escapeLikeWildcard(keyword);
      whereClause[db.Sequelize.Op.or] = [
        { nick_name: { [db.Sequelize.Op.like]: `%${safeKw}%` } },
        { phone_masked: { [db.Sequelize.Op.like]: `%${safeKw}%` } }
      ];
    }

    const { count, rows } = await db.User.findAndCountAll({
      where: whereClause,
      order: [['last_active_at', 'DESC']],
      limit: pageSize,
      offset,
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'status', 'last_active_at', 'is_member', 'created_at']
    });

    // 规格9.4 响应双写
    const users = rows.map(u => {
      const data = u.toJSON();
      data.phone = data.phone_masked;
      data.nickName = data.nick_name;
      data.avatarUrl = data.avatar_url;
      data.lastActiveAt = data.last_active_at;
      data.isMember = data.is_member;
      data.createdAt = data.created_at;
      return data;
    });

    return success(res, {
      users,
      total: count,
      serviceProviderId: providerId,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取服务商客户列表失败');
  }
});

/**
 * 获取关联服务商的客户详情
 * GET /api/agent/service-provider/users/:userId
 */
router.get('/service-provider/users/:userId', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent || !agent.service_provider_id) {
      return fail(res, '当前代理商未关联服务商，无法查看服务商数据');
    }

    const providerId = agent.service_provider_id;
    const userId = req.params.userId;

    const user = await db.User.findByPk(userId, {
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'status', 'last_active_at', 'is_member', 'service_provider_id', 'created_at']
    });
    if (!user) {
      return fail(res, '客户不存在');
    }

    // 数据隔离：只能查看关联服务商名下的客户
    if (user.service_provider_id !== providerId) {
      return forbidden(res, '无权查看该客户');
    }

    const data = user.toJSON();
    data.phone = data.phone_masked;
    data.nickName = data.nick_name;
    data.avatarUrl = data.avatar_url;
    data.lastActiveAt = data.last_active_at;
    data.isMember = data.is_member;
    data.createdAt = data.created_at;

    return success(res, { user: data });
  } catch (err) {
    return handleRouteError(res, err, '获取客户详情失败');
  }
});

/**
 * 获取关联服务商的接待记录
 * GET /api/agent/service-provider/receptions
 */
router.get('/service-provider/receptions', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent || !agent.service_provider_id) {
      return fail(res, '当前代理商未关联服务商，无法查看服务商数据');
    }

    const providerId = agent.service_provider_id;
    const { page, pageSize, offset } = parsePagination(req.query);

    const whereClause = { service_provider_id: providerId };
    if (req.query.userId) {
      whereClause.user_id = req.query.userId;
    }

    const { count, rows } = await db.ServiceProviderReception.findAndCountAll({
      where: whereClause,
      order: [['reception_time', 'DESC']],
      limit: pageSize,
      offset,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] }]
    });

    return success(res, {
      receptions: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取接待记录失败');
  }
});

/**
 * 获取关联服务商的报告
 * GET /api/agent/service-provider/reports/:userId
 */
router.get('/service-provider/reports/:userId', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent || !agent.service_provider_id) {
      return fail(res, '当前代理商未关联服务商，无法查看服务商数据');
    }

    const providerId = agent.service_provider_id;
    const userId = req.params.userId;

    const user = await db.User.findByPk(userId);
    if (!user) {
      return fail(res, '客户不存在');
    }

    // 数据隔离：只能查看关联服务商名下的客户报告
    if (user.service_provider_id !== providerId) {
      return forbidden(res, '无权查看该客户报告');
    }

    const reports = await db.Report.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    return success(res, { reports });
  } catch (err) {
    return handleRouteError(res, err, '获取报告失败');
  }
});

/**
 * 获取关联服务商的网点信息
 * GET /api/agent/service-provider/profile
 */
router.get('/service-provider/profile', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent || !agent.service_provider_id) {
      return fail(res, '当前代理商未关联服务商，无法查看服务商数据');
    }

    const provider = await db.ServiceProvider.findByPk(agent.service_provider_id);
    if (!provider) {
      return fail(res, '关联服务商不存在');
    }

    // 返回脱敏数据
    return success(res, {
      provider: {
        id: provider.id,
        name: provider.name,
        phone: provider.phone_masked,
        email: provider.email,
        address: provider.address,
        licenseNumber: provider.license_number,
        status: provider.status,
        verified: provider.verified
      }
    });
  } catch (err) {
    return handleRouteError(res, err, '获取服务商信息失败');
  }
});

// ============================================================
// 代理商下载完整报告（方案3.2：代理商下载完整报告 → 线下讲解）
// ============================================================

/**
 * 获取名下用户的完整报告列表（含7天调理方案）
 * GET /api/agent/reports/:userId
 *
 * 权限：代理商仅能查看名下用户的报告；admin 可查看所有。
 * 与 service-provider /reports/:userId 对等，但按 agent_id 过滤。
 */
router.get('/reports/:userId', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    const { userId } = req.params;

    const user = await db.User.findByPk(userId, {
      attributes: ['id', 'agent_id', 'nick_name', 'phone_masked']
    });
    if (!user) {
      return fail(res, '用户不存在');
    }

    // 数据隔离：非 admin 只能查看名下用户的报告
    if (agentId && user.agent_id !== agentId) {
      return forbidden(res, '无权查看该用户报告');
    }

    const reports = await db.Report.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    return success(res, { reports });
  } catch (err) {
    return handleRouteError(res, err, '获取报告失败');
  }
});

/**
 * 下载名下用户的报告（方案3.3：代理商后台下载，不占用用户月度下载次数）
 * GET /api/agent/reports/:reportId/download
 *
 * 权限：代理商仅能下载名下用户的报告；admin 可下载所有。
 * 返回：与 /api/user/reports/download/:reportId 一致的文本格式报告内容。
 */
router.get('/reports/:reportId/download', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    const { reportId } = req.params;

    const report = await db.Report.findOne({
      where: { id: reportId },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'agent_id'] }]
    });
    if (!report) {
      return fail(res, '报告不存在');
    }

    // 数据隔离：非 admin 只能下载名下用户的报告
    // P0修复：report.user 可能为 null（用户被删除），需空指针保护
    if (agentId && (!report.user || report.user.agent_id !== agentId)) {
      return forbidden(res, '无权下载该报告');
    }

    // 生成简易文本格式报告内容（与 user/reports/download 保持一致）
    const pdfContent = [
      '元生AI生态健康饮食积分系统 - 健康报告',
      '=====================================',
      `报告编号: ${report.id}`,
      `报告标题: ${report.title}`,
      `生成日期: ${report.generate_date || report.createdAt}`,
      `风险评分: ${report.risk_score}`,
      `风险等级: ${report.risk_level}`,
      '',
      '报告内容:',
      '-------------------------------------',
      typeof report.content === 'string' ? report.content : JSON.stringify(report.content, null, 2),
      '',
      '免责声明: 本报告不构成医疗诊断，请咨询专业医师。',
      '====================================='
    ].join('\n');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.txt"`);
    return res.send(pdfContent);
  } catch (err) {
    return handleRouteError(res, err, '下载报告失败');
  }
});

// ============================================================
// 代理商编辑名下用户报告（方案11.1：报告编辑，违禁词检测）
// ============================================================

/**
 * 编辑名下用户的AI饮食报告
 * PUT /api/agent/reports/:reportId/edit
 *
 * 权限：代理商仅可编辑名下用户的报告；admin 可编辑所有。
 * 违禁词检测：保存前检测内容中的违禁词，检测到仍允许保存但返回警告。
 *
 * body:
 *   - content: 报告内容（必传，字符串）
 */
router.put('/reports/:reportId/edit', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    const { reportId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return fail(res, '报告内容不能为空');
    }

    const report = await db.Report.findOne({
      where: { id: reportId },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'agent_id'] }]
    });
    if (!report) {
      return fail(res, '报告不存在');
    }

    // 数据隔离：非 admin 只能编辑名下用户的报告
    if (agentId && (!report.user || report.user.agent_id !== agentId)) {
      return forbidden(res, '无权编辑该报告');
    }

    // 违禁词检测（复用 reportGenerator 的违禁词库）
    const forbiddenWords = await db.ForbiddenWord.findAll({
      where: { status: 'active' },
      attributes: ['pattern', 'category']
    });

    const warnings = [];
    for (const fw of forbiddenWords) {
      try {
        const regex = new RegExp(fw.pattern, 'i');
        if (regex.test(content)) {
          warnings.push({ pattern: fw.pattern, category: fw.category });
        }
      } catch (e) {
        // 正则语法错误时 fallback 到 indexOf
        if (content.includes(fw.pattern)) {
          warnings.push({ pattern: fw.pattern, category: fw.category });
        }
      }
    }

    // 保存报告内容（即使有违禁词警告也允许保存，但需记录）
    await report.update({
      content: content.trim(),
      validation_errors: warnings.length > 0 ? warnings : null
    });

    return success(res, {
      report: {
        id: report.id,
        title: report.title,
        content: report.content,
        updatedAt: report.updatedAt
      },
      forbiddenWordWarnings: warnings,
      warningCount: warnings.length
    });
  } catch (err) {
    return handleRouteError(res, err, '编辑报告失败');
  }
});

// ============================================================
// 礼品兑换核销码核销（方案3.4：线下核销实物兑换）
// ============================================================

/**
 * 核销礼品兑换码
 * POST /api/agent/gifts/redeem
 *
 * 业务流程：会员线上兑换礼品 → 获得 write_off_code（状态 pending）→
 *           到店出示核销码 → 代理商扫码/输入核销码 → 状态置 completed
 *
 * 权限：代理商核销名下用户的兑换记录（user.agent_id 匹配）。
 *      若兑换记录关联的用户已解绑代理商，则拒绝核销（防止跨代理商核销）。
 *
 * body:
 *   - writeOffCode: 核销码（必传）
 *   - idempotencyKey: 幂等键（必传，防双击/重试）
 */
router.post('/gifts/redeem', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '仅代理商可核销礼品兑换码');
    }

    // 规格9.4 tolerant reader：同时接受 snake_case 和 camelCase
    const writeOffCode = req.body.writeOffCode || req.body.write_off_code;
    const idempotencyKey = req.body.idempotencyKey || req.body.idempotency_key;

    if (!writeOffCode || typeof writeOffCode !== 'string' || writeOffCode.length > 20) {
      return fail(res, '核销码不合法');
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }

    const t = await db.sequelize.transaction();
    try {
      // 行锁查询兑换记录，防止并发核销
      const exchange = await db.GiftExchange.findOne({
        where: { write_off_code: writeOffCode },
        transaction: t,
        lock: t.LOCK.UPDATE,
        include: [
          { model: db.User, as: 'user', attributes: ['id', 'agent_id', 'nick_name'] },
          { model: db.Gift, as: 'gift', attributes: ['id', 'name'] }
        ]
      });

      if (!exchange) {
        await t.rollback();
        return fail(res, '核销码无效');
      }

      // 幂等返回：已核销过的记录直接返回成功
      if (exchange.status === 'completed') {
        await t.rollback();
        return success(res, {
          exchangeId: exchange.id,
          giftName: exchange.gift ? exchange.gift.name : '',
          status: 'completed',
          writeOffDate: exchange.write_off_date,
          duplicated: true,
          // snake_case 双写
          exchange_id: exchange.id,
          gift_name: exchange.gift ? exchange.gift.name : '',
          write_off_date: exchange.write_off_date
        }, '该兑换码已核销（幂等返回）');
      }

      // 仅 pending 状态可核销，cancelled/refunded 拒绝
      if (exchange.status !== 'pending') {
        await t.rollback();
        return fail(res, `该兑换记录状态为 ${exchange.status}，无法核销`);
      }

      // 数据隔离：只能核销名下用户的兑换记录
      // P0修复：exchange.user 可能为 null（用户被删除），需空指针保护
      if (!exchange.user || exchange.user.agent_id !== agentId) {
        await t.rollback();
        return forbidden(res, '无权核销该兑换记录（非名下用户）');
      }

      // 执行核销：状态置 completed，记录核销时间和代理商
      const now = new Date();
      await exchange.update({
        status: 'completed',
        write_off_date: now,
        agent_id: agentId
      }, { transaction: t });

      await t.commit();

      logger.info(`礼品核销成功: 兑换记录${exchange.id}, 代理商${agentId}`);
      return success(res, {
        exchangeId: exchange.id,
        giftName: exchange.gift ? exchange.gift.name : '',
        points: exchange.points,
        status: 'completed',
        writeOffDate: now,
        userName: exchange.user ? exchange.user.nick_name : '',
        // snake_case 双写
        exchange_id: exchange.id,
        gift_name: exchange.gift ? exchange.gift.name : '',
        write_off_date: now
      }, '核销成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    return handleRouteError(res, err, '礼品核销失败');
  }
});

// ============================================================
// 代理商关联服务商设置
// ============================================================

/**
 * 获取可关联的服务商列表（供代理商下拉选择）
 * GET /api/agent/service-providers
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
 * 代理商设置关联服务商（同步到超级管理员）
 * PUT /api/agent/service-provider
 * body: { serviceProviderId }
 */
router.put('/service-provider', async (req, res) => {
  try {
    const { serviceProviderId } = req.body;

    // 获取代理商ID
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    // 校验服务商存在 + 唯一性（一个服务商只能被一个代理商关联）
    if (serviceProviderId) {
      const sp = await db.ServiceProvider.findByPk(serviceProviderId);
      if (!sp) {
        return fail(res, '关联的服务商不存在');
      }
      // 排除自身后检查唯一性
      const existingAgent = await db.Agent.findOne({
        where: { service_provider_id: serviceProviderId, id: { [db.Sequelize.Op.ne]: agentId } }
      });
      if (existingAgent) {
        return fail(res, '该服务商已被其他代理商关联，一个服务商只能关联一个代理商');
      }
    }

    // 更新 Agent 记录
    await db.Agent.update(
      { service_provider_id: serviceProviderId || null },
      { where: { id: agentId } }
    );

    // 同步更新 User 记录
    const agent = await db.Agent.findByPk(agentId);
    if (agent && agent.user_id) {
      await db.User.update(
        { service_provider_id: serviceProviderId || null },
        { where: { id: agent.user_id } }
      );
    }

    logger.info(`代理商设置关联服务商: agentId=${agentId}, serviceProviderId=${serviceProviderId || 'null'}, by=${req.user.id}`);

    return success(res, { agentId, serviceProviderId: serviceProviderId || null }, '关联服务商设置成功');
  } catch (err) {
    return handleRouteError(res, err, '设置关联服务商失败');
  }
});

/**
 * 获取当前关联的服务商信息
 * GET /api/agent/service-provider
 */
router.get('/service-provider', async (req, res) => {
  try {
    const agentId = await getAgentId(req);
    if (!agentId) {
      return fail(res, '无法确定代理商身份');
    }

    const agent = await db.Agent.findByPk(agentId, {
      attributes: ['id', 'name', 'service_provider_id'],
      include: [{ model: db.ServiceProvider, as: 'serviceProvider', attributes: ['id', 'name', 'status'] }]
    });

    return success(res, {
      agentId: agent.id,
      serviceProviderId: agent.service_provider_id || null,
      serviceProvider: agent.serviceProvider || null
    });
  } catch (err) {
    return handleRouteError(res, err, '获取关联服务商信息失败');
  }
});

module.exports = router;