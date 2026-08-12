// routes/service-provider.js - 服务商后台路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, forbidden } = require('../utils/response');
const logger = require('../utils/logger');
const { serviceProviderOnly } = require('../middleware/auth');

// 所有服务商路由需要service_provider/admin权限
router.use(serviceProviderOnly);

/**
 * P0修复：转义SQL LIKE通配符（%和_），防止通配符注入导致全表扫描DoS
 */
function escapeLikeWildcard(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

/**
 * 规范化分页参数
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * 自定义错误类：服务商身份校验失败
 * 用于在 getServiceProviderId 抛出后，路由 catch 中识别并返回 403
 */
class ServiceProviderAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceProviderAuthError';
    this.statusCode = 403;
  }
}

/**
 * 统一 catch 块错误处理：识别 ServiceProviderAuthError 返回 403
 */
function handleRouteError(res, err, defaultMessage) {
  if (err instanceof ServiceProviderAuthError) {
    return forbidden(res, err.message);
  }
  logger.error(defaultMessage + ':', err);
  return fail(res, defaultMessage);
}

/**
 * 从provider实例构造安全响应对象（不泄露加密手机号）
 */
function buildProviderResponse(provider) {
  if (!provider) return null;
  return {
    id: provider.id,
    name: provider.name,
    phone: provider.phone_masked,
    phoneMasked: provider.phone_masked,
    email: provider.email,
    address: provider.address,
    licenseNumber: provider.license_number,
    license_number: provider.license_number,
    status: provider.status,
    verified: provider.verified,
    createdAt: provider.created_at,
    created_at: provider.created_at,
    updatedAt: provider.updated_at,
    updated_at: provider.updated_at
  };
}

/**
 * 获取当前用户关联的服务商ID
 * 修复：原代码对 misconfigured service_provider（service_provider_id 为空）返回 null，
 * 后续 whereClause 为空对象导致该服务商账号可查看全部用户/报告，构成数据越权。
 * 现改为：非 admin 角色取不到 providerId 时抛 403，避免失败开放。
 * 优先使用 JWT 中已有的 service_provider_id（auth.js generateToken 第43行），避免冗余 DB 查询。
 */
async function getServiceProviderId(req) {
  if (req.user.role === 'admin') return null;
  // 代理商：通过 Agent 记录获取关联服务商ID
  if (req.user.role === 'agent') {
    // 优先从 JWT 中的 agent_id 查询
    const jwtAgentId = req.user.agent_id;
    if (jwtAgentId) {
      const agent = await db.Agent.findByPk(jwtAgentId);
      if (agent && agent.service_provider_id) return agent.service_provider_id;
    }
    // 回退查 DB
    const user = await db.User.findByPk(req.user.id);
    if (user && user.agent_id) {
      const agent = await db.Agent.findByPk(user.agent_id);
      if (agent && agent.service_provider_id) return agent.service_provider_id;
    }
    throw new ServiceProviderAuthError('当前代理商未关联服务商，无法查看服务商数据');
  }
  // 服务商：JWT payload 已含 service_provider_id，优先使用
  const jwtProviderId = req.user.service_provider_id;
  if (jwtProviderId) return jwtProviderId;
  // JWT 无 service_provider_id 时回退查 DB（兼容旧 token）
  const user = await db.User.findByPk(req.user.id);
  if (!user || !user.service_provider_id) {
    throw new ServiceProviderAuthError('无法确定服务商身份，请联系管理员配置服务商归属');
  }
  return user.service_provider_id;
}

/**
 * 获取统计数据
 * GET /api/service-provider/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    const userWhere = providerId ? { service_provider_id: providerId } : {};

    // 时间基准
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 用户统计
    const totalUsers = await db.User.count({ where: { ...userWhere, status: 'active' } });
    const activeUsersToday = await db.User.count({ where: { ...userWhere, status: 'active', last_active_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const activeUsersWeek = await db.User.count({ where: { ...userWhere, status: 'active', last_active_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const activeUsersMonth = await db.User.count({ where: { ...userWhere, status: 'active', last_active_at: { [db.Sequelize.Op.gte]: monthStart } } });
    const newUsersToday = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const newUsersWeek = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: weekStart } } });
    const newUsersMonth = await db.User.count({ where: { ...userWhere, created_at: { [db.Sequelize.Op.gte]: monthStart } } });
    const totalMembers = await db.User.count({ where: { ...userWhere, is_member: true } });

    // 活跃度监控
    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 3));
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const inactiveUsers = await db.User.count({
      where: { ...userWhere, is_member: true, status: 'active', last_active_at: { [db.Sequelize.Op.lt]: threshold } }
    });

    // 积分
    const totalPoints = await db.User.sum('points', { where: userWhere }) || 0;
    const totalPointsIssued = await db.User.sum('total_points', { where: userWhere }) || 0;

    // 获取用户ID列表
    const userIds = await db.User.findAll({ where: userWhere, attributes: ['id'] }).then(rows => rows.map(u => u.id));
    const userIdIn = userIds.length ? { [db.Sequelize.Op.in]: userIds } : { [db.Sequelize.Op.eq]: '__none__' };

    // 业务统计
    const todayCheckIns = await db.ClockInRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const todaySignIns = await db.SignInRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalCourses = await db.CourseRecord.count({ where: { user_id: userIdIn } });
    const todayCourses = await db.CourseRecord.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });
    const totalMeals = await db.Meal.count({ where: { user_id: userIdIn } });

    // 报告
    const totalReports = await db.Report.count({ where: { user_id: userIdIn } });
    const pendingReports = await db.Report.count({ where: { user_id: userIdIn, flagged: true, review_status: 'pending' } });

    // 接待
    const spWhere = providerId ? { service_provider_id: providerId } : {};
    const totalReceptions = await db.ServiceProviderReception.count({ where: spWhere });
    const todayReceptions = await db.ServiceProviderReception.count({ where: { ...spWhere, created_at: { [db.Sequelize.Op.gte]: todayStart } } });

    // 礼品兑换
    const totalExchanges = await db.GiftExchange.count({ where: { user_id: userIdIn } });
    const todayExchanges = await db.GiftExchange.count({ where: { user_id: userIdIn, created_at: { [db.Sequelize.Op.gte]: todayStart } } });

    return success(res, {
      // 用户
      totalUsers, totalMembers, newUsersToday, newUsersWeek, newUsersMonth,
      // 活跃
      activeUsersToday, activeUsersWeek, activeUsersMonth, inactiveUsers, thresholdDays: days,
      // 积分
      totalPoints, totalPointsIssued,
      // 业务
      totalMeals, todayCheckIns, todaySignIns, totalCourses, todayCourses,
      // 报告
      totalReports, pendingReports,
      // 接待
      totalReceptions, todayReceptions,
      // 礼品兑换
      totalExchanges, todayExchanges
    });
  } catch (err) {
    return handleRouteError(res, err, '获取统计数据失败');
  }
});

/**
 * 获取客户列表
 * GET /api/service-provider/users
 */
router.get('/users', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const keyword = (req.query.keyword || '').toString().slice(0, 50);
    const providerId = await getServiceProviderId(req);

    const whereClause = {};
    if (providerId) {
      whereClause.service_provider_id = providerId;
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
      limit: pageSize,
      offset,
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'status', 'last_active_at', 'is_member']
    });

    // P0修复：规格9.4 响应双写（snake_case + camelCase）
    const users = rows.map(u => {
      const data = u.toJSON();
      data.phone = data.phone_masked;
      data.nickName = data.nick_name;
      data.avatarUrl = data.avatar_url;
      data.lastActiveAt = data.last_active_at;
      data.isMember = data.is_member;
      return data;
    });

    return success(res, {
      users,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取客户列表失败');
  }
});

/**
 * 获取3天未活跃客户列表（活跃度监控）
 * GET /api/service-provider/users/inactive
 *
 * 与 agent /users/inactive 对等，按 service_provider_id 过滤名下客户。
 * 返回字段含 days_inactive（已未活跃天数），便于按紧急程度排序跟进。
 *
 * 查询参数：
 *   - days: 自定义预警阈值（默认3天），允许 [1, 30] 范围自定义
 *   - page / pageSize: 分页（默认1/50，上限100）
 */
router.get('/users/inactive', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);

    // 预警阈值：默认3天，允许 [1, 30] 范围自定义
    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 3));
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 分页：默认 pageSize=50，上限100
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const reqPageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 50;
    const limit = Math.min(100, Math.max(1, reqPageSize));
    const offset = (page - 1) * limit;

    const whereClause = {
      is_member: true,
      status: 'active',
      last_active_at: { [db.Sequelize.Op.lt]: threshold }
    };
    if (providerId) {
      whereClause.service_provider_id = providerId;
    }

    const { count, rows } = await db.User.findAndCountAll({
      where: whereClause,
      order: [['last_active_at', 'ASC']],
      limit,
      offset,
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'last_active_at']
    });

    // 计算 days_inactive + 规格9.4 响应双写
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
    return handleRouteError(res, err, '获取未活跃客户列表失败');
  }
});

/**
 * 获取客户详情
 * GET /api/service-provider/users/:userId
 * 供服务商后台查看客户完整信息（含积分、会员状态、最近活动）
 *
 * ⚠️ 注册顺序约束：本路由是通配参数路由，会匹配 /users/ 下任意单段路径。
 *    所有 /users/xxx 形式的**字面量**路由（如 /users/inactive）必须注册在本路由之前，
 *    否则会被 :userId 抢先匹配（userId='inactive'），导致目标路由永远无法命中。
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    const userId = req.params.userId;

    const user = await db.User.findByPk(userId, {
      attributes: ['id', 'nick_name', 'avatar_url', 'phone_masked', 'points', 'status', 'last_active_at', 'is_member', 'service_provider_id', 'created_at']
    });
    if (!user) {
      return fail(res, '客户不存在');
    }

    // 数据隔离：非 admin 只能查看名下客户
    if (providerId && user.service_provider_id !== providerId) {
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
 * 获取客户完整报告
 * GET /api/service-provider/reports/:userId
 */
router.get('/reports/:userId', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    const userId = req.params.userId;

    const user = await db.User.findByPk(userId);
    if (!user) {
      return fail(res, '客户不存在');
    }

    // 数据隔离：非 admin 只能查看名下客户的报告
    if (providerId && user.service_provider_id !== providerId) {
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
 * 下载客户报告（方案3.3：服务商后台下载，不占用用户月度下载次数）
 * GET /api/service-provider/reports/:reportId/download
 *
 * 权限：服务商仅能下载名下客户的报告；admin 可下载所有。
 * 返回：与 /api/user/reports/download/:reportId 一致的文本格式报告内容。
 */
router.get('/reports/:reportId/download', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    const reportId = req.params.reportId;

    const report = await db.Report.findOne({
      where: { id: reportId },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'service_provider_id'] }]
    });
    if (!report) {
      return fail(res, '报告不存在');
    }

    // 数据隔离：非 admin 只能下载名下客户的报告
    // P0修复：report.user 可能为 null（用户被删除），需空指针保护
    if (providerId && (!report.user || report.user.service_provider_id !== providerId)) {
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

/**
 * 创建接待记录
 * POST /api/service-provider/receptions
 *
 * 幂等设计：idempotency_key 防止网络重试/双击导致重复创建
 */
router.post('/receptions', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    if (!providerId) {
      return fail(res, '仅服务商可创建接待记录');
    }

    // 规格9.4 tolerant reader：同时接受 snake_case 和 camelCase
    const userId = req.body.user_id || req.body.userId;
    const receptionTime = req.body.reception_time || req.body.receptionTime;
    const content = req.body.content;
    const result = req.body.result;
    const idempotencyKey = req.body.idempotency_key || req.body.idempotencyKey;

    // P0修复：参数校验
    if (!userId) {
      return fail(res, '缺少客户ID');
    }
    if (!receptionTime) {
      return fail(res, '缺少接待时间');
    }
    // 接待时间必须是合法日期
    const parsedTime = new Date(receptionTime);
    if (isNaN(parsedTime.getTime())) {
      return fail(res, '接待时间格式不合法');
    }
    // 接待时间不能是未来时间（允许今天）
    if (parsedTime.getTime() > Date.now() + 60 * 1000) {
      return fail(res, '接待时间不能是未来时间');
    }
    // 内容校验
    if (content !== undefined && content !== null) {
      if (typeof content !== 'string' || content.length > 5000) {
        return fail(res, '沟通内容不超过5000字');
      }
    }
    // result 校验
    const ALLOWED_RESULTS = ['pending', 'converted', 'follow_up', 'lost'];
    if (result && !ALLOWED_RESULTS.includes(result)) {
      return fail(res, '转化结果不合法');
    }
    // P0修复：幂等键必传（防重复创建）
    if (!idempotencyKey) {
      return fail(res, '缺少幂等键，请通过正规接口调用');
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }

    const user = await db.User.findByPk(userId);
    if (!user || user.service_provider_id !== providerId) {
      return forbidden(res, '无权为该客户创建接待记录');
    }

    // P0修复：幂等检查——同一幂等键已创建过则直接返回原记录
    const existed = await db.ServiceProviderReception.findOne({ where: { idempotency_key: idempotencyKey } });
    if (existed) {
      return success(res, { reception: existed }, '接待记录已创建（幂等返回）');
    }

    let reception;
    try {
      reception = await db.ServiceProviderReception.create({
        service_provider_id: providerId,
        user_id: userId,
        reception_time: parsedTime,
        content: content || '',
        result: result || 'pending',
        idempotency_key: idempotencyKey
      });
    } catch (createErr) {
      // 并发重复提交触发唯一索引冲突，回查返回
      if (createErr.name === 'SequelizeUniqueConstraintError') {
        const existed2 = await db.ServiceProviderReception.findOne({ where: { idempotency_key: idempotencyKey } });
        if (existed2) {
          return success(res, { reception: existed2 }, '接待记录已创建（幂等返回）');
        }
      }
      throw createErr;
    }

    return success(res, { reception }, '接待记录创建成功');
  } catch (err) {
    return handleRouteError(res, err, '创建接待记录失败');
  }
});

/**
 * 获取接待记录列表
 * GET /api/service-provider/receptions
 *
 * 支持按 userId 筛选查看某客户的接待记录
 */
router.get('/receptions', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    if (!providerId) {
      return fail(res, '仅服务商可查看接待记录');
    }

    const { page, pageSize, offset } = parsePagination(req.query);

    const whereClause = { service_provider_id: providerId };
    // P0修复：支持按 userId 筛选
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
 * 获取/维护网点信息
 * GET /api/service-provider/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    if (!providerId) {
      return fail(res, '仅服务商可查看网点信息');
    }

    const provider = await db.ServiceProvider.findByPk(providerId);
    if (!provider) {
      return fail(res, '服务商不存在');
    }

    // V4修复：返回脱敏手机号，不泄露加密手机号
    return success(res, { provider: buildProviderResponse(provider) });
  } catch (err) {
    return handleRouteError(res, err, '获取失败');
  }
});

/**
 * 更新网点信息
 * PUT /api/service-provider/profile
 */
router.put('/profile', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    if (!providerId) {
      return fail(res, '仅服务商可更新网点信息');
    }

    const { name, phone, email, address } = req.body;
    const provider = await db.ServiceProvider.findByPk(providerId);
    if (!provider) {
      return fail(res, '服务商不存在');
    }

    // V4修复：严格校验输入字段
    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 2 || name.length > 100) {
        return fail(res, '企业名称长度2-100');
      }
      updateData.name = name;
    }
    if (phone !== undefined) {
      // 由模型beforeSave钩子自动加密+校验手机号格式
      if (phone !== null && phone !== '') {
        if (typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone)) {
          return fail(res, '手机号格式不合法');
        }
      }
      updateData.phone = phone === '' ? null : phone;
    }
    if (email !== undefined) {
      if (email !== null && email !== '' && (typeof email !== 'string' || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return fail(res, '邮箱格式不合法');
      }
      updateData.email = email === '' ? null : email;
    }
    if (address !== undefined) {
      if (address !== null && address !== '' && (typeof address !== 'string' || address.length > 200)) {
        return fail(res, '地址长度超限');
      }
      updateData.address = address === '' ? null : address;
    }

    await provider.update(updateData);
    // 重新加载以获取最新数据
    await provider.reload();
    return success(res, { provider: buildProviderResponse(provider) }, '更新成功');
  } catch (err) {
    if (err.message === '手机号格式不合法') {
      return fail(res, err.message);
    }
    return handleRouteError(res, err, '更新失败');
  }
});

// ============================================================
// 名下客户管理（服务商端：添加/查看名下客户）
// ============================================================

/**
 * 获取名下客户列表
 * GET /api/service-provider/clients
 *
 * 返回 service_provider_id 匹配的普通用户（role=user）列表
 */
router.get('/clients', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
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

    const clients = rows.map(u => {
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
      clients,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    return handleRouteError(res, err, '获取名下客户列表失败');
  }
});

/**
 * 添加名下客户（通过手机号绑定）
 * POST /api/service-provider/clients
 *
 * 业务流程：服务商输入客户手机号 → 系统查找该手机号对应用户 →
 *           将用户绑定到该服务商名下（设置 service_provider_id）
 *
 * body:
 *   - phone: 客户手机号（必传）
 *   - remark?: 备注
 */
router.post('/clients', async (req, res) => {
  try {
    const providerId = await getServiceProviderId(req);
    if (!providerId) {
      return fail(res, '仅服务商可添加客户');
    }

    const { phone, remark } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return fail(res, '手机号格式不合法');
    }
    if (remark && (typeof remark !== 'string' || remark.length > 200)) {
      return fail(res, '备注不合法');
    }

    // 查找手机号对应的用户（需解密比较）
    const { encryptPhone } = require('../utils/encrypt');
    let user = null;
    try {
      const encryptedPhone = encryptPhone(phone);
      user = await db.User.findOne({ where: { phone: encryptedPhone } });
    } catch {
      // 加密比较失败，尝试全表扫描（性能较差，仅作兜底）
      const allUsers = await db.User.findAll({ where: { role: 'user' } });
      for (const u of allUsers) {
        try {
          if (u.getDecryptedPhone() === phone) {
            user = u;
            break;
          }
        } catch { /* 解密失败跳过 */ }
      }
    }

    if (!user) {
      return fail(res, '未找到该手机号对应的用户，请确认用户已注册');
    }

    // 检查是否已绑定
    if (user.service_provider_id === providerId) {
      return fail(res, '该用户已是您的名下客户');
    }

    // 检查是否已绑定其他服务商（关联唯一性：首次绑定不可更改）
    if (user.service_provider_id && user.service_provider_id !== providerId) {
      return fail(res, '该用户已绑定其他服务商，首次关联不可更改');
    }

    // 绑定用户到服务商
    await user.update({ service_provider_id: providerId });

    logger.info(`服务商添加客户: providerId=${providerId}, userId=${user.id}, phone=${phone}, by=${req.user.id}`);

    return success(res, {
      userId: user.id,
      nickName: user.nick_name,
      phone: user.phone_masked
    }, '客户添加成功');
  } catch (err) {
    return handleRouteError(res, err, '添加客户失败');
  }
});

// ============================================================
// 流失预警推送（方案3.5：会员3天无活跃 → 后台自动提醒 → 主动跟进）
// ============================================================

/**
 * 获取待跟进的流失预警列表
 * GET /api/service-provider/alerts
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
    const providerId = await getServiceProviderId(req);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const ALLOWED_STATUS = ['pending', 'followed', 'all'];
    const status = ALLOWED_STATUS.includes(req.query.status) ? req.query.status : 'pending';

    const whereClause = {};
    if (providerId) {
      whereClause.service_provider_id = providerId;
    } else {
      whereClause.alert_type = 'provider_notified';
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

    // 规格9.4 响应双写
    const alerts = rows.map(a => {
      const data = a.toJSON();
      const user = data.user || {};
      return {
        id: data.id,
        userId: data.user_id,
        daysInactive: data.days_inactive,
        alertType: data.alert_type,
        notifiedAt: data.notified_at,
        followedUpAt: data.followed_up_at,
        followUpResult: data.follow_up_result,
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
 * PUT /api/service-provider/alerts/:id/follow-up
 *
 * body: { followUpResult: '已电话联系'|'已到店拜访'|'暂未联系上'|... }
 */
router.put('/alerts/:id/follow-up', async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = await getServiceProviderId(req);
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
    if (providerId && alert.service_provider_id !== providerId) {
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

module.exports = router;
