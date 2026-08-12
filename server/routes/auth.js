// routes/auth.js - 认证路由
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const db = require('../models');
const { generateToken, tokenBlacklist, EFFECTIVE_JWT_SECRET, authMiddleware } = require('../middleware/auth');
const { accountLockCheck, onAuthFailure, onAuthSuccess } = require('../middleware/bruteForce');
const jwt = require('jsonwebtoken');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { rewardReferrerForActive } = require('./questionnaire');
const { addPoints } = require('./points');
const configCache = require('../utils/configCache');

// 拉新基础积分默认值
const FALLBACK_INVITE_POINTS = 20;

const WX_APPID = process.env.WX_APPID;
const WX_SECRET = process.env.WX_SECRET;

/**
 * 微信小程序登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { code, shareCode, referrerId } = req.body;

    // 前置检查：WX_APPID / WX_SECRET 必须配置（未配置时给出明确错误，而不是"微信登录失败"）
    if (!WX_APPID || !WX_SECRET) {
      logger.error('生产环境未配置 WX_APPID 或 WX_SECRET');
      return fail(res, '服务器微信登录服务未配置，请联系管理员', 500);
    }

    if (!code || typeof code !== 'string' || code.length > 200) {
      return fail(res, '缺少code参数或参数不合法');
    }
    // 校验shareCode格式（防注入）
    if (shareCode !== undefined && shareCode !== null) {
      if (typeof shareCode !== 'string' || shareCode.length > 20 || !/^[A-Za-z0-9\-]+$/.test(shareCode)) {
        return fail(res, 'shareCode格式不合法');
      }
    }
    // 校验referrerId格式（UUID）
    if (referrerId !== undefined && referrerId !== null) {
      if (typeof referrerId !== 'string' || referrerId.length > 64 || !/^[A-Za-z0-9\-]+$/.test(referrerId)) {
        return fail(res, 'referrerId格式不合法');
      }
    }

    // 调用微信接口获取openid
    const wxRes = await axios.get(
      'https://api.weixin.qq.com/sns/jscode2session',
      {
        params: {
          appid: WX_APPID,
          secret: WX_SECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      }
    );

    if (wxRes.data.errcode) {
      logger.error(`微信登录失败: ${wxRes.data.errmsg}`);
      return fail(res, `微信登录失败: ${wxRes.data.errmsg}`);
    }

    const { openid, unionid } = wxRes.data;

    // 查找或创建用户
    let [user, created] = await db.User.findOrCreate({
      where: { openid },
      defaults: {
        openid,
        unionid: unionid || null,
        nick_name: '健康新人',
        status: 'active',
        last_active_at: new Date(),
        share_code: 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
      }
    });

    // P2-23: 封禁用户禁止登录
    if (user.status === 'banned') {
      return fail(res, '账号已封禁，如有疑问请联系客服', 403);
    }

    // 新用户或游客首次登录，绑定分享码与推荐人
    // 关联唯一性规则：用户与代理商/服务商的关联以首次绑定为准，一旦绑定不可更改
    if (created || user.identity_type === 'guest') {
      const updateData = {};

      // 仅在用户尚未绑定代理商时才允许绑定（首次绑定不可更改）
      if (shareCode && !user.agent_id && !user.bound_share_code) {
        const agent = await db.Agent.findOne({ where: { share_code: shareCode } });
        if (agent && agent.status === 'active') {
          updateData.bound_share_code = shareCode;
          updateData.agent_id = agent.id;
          // 仅在用户尚未绑定服务商时才自动关联代理商的服务商
          if (!user.service_provider_id && agent.service_provider_id) {
            updateData.service_provider_id = agent.service_provider_id;
          }
          logger.info(`用户${user.id}绑定分享码${shareCode}到代理商${agent.id}`);
        } else if (agent && agent.status !== 'active') {
          logger.warn(`用户${user.id}尝试绑定非active状态代理商${agent.id}(status=${agent.status})，已拒绝绑定`);
        }
      } else if (shareCode && user.agent_id) {
        logger.warn(`用户${user.id}已绑定代理商${user.agent_id}，忽略分享码${shareCode}（首次绑定不可更改）`);
      }

      // 绑定推荐人（仅新用户首次登录）
      // 拉新积分：新用户绑定推荐人时，推荐人立即获得基础拉新积分（默认20分）
      if (created && referrerId && !user.referrer_id) {
        // 防御性检查：禁止自推荐
        if (referrerId === user.id) {
          logger.warn(`用户${user.id}尝试自推荐，已拒绝`);
        } else {
          const referrer = await db.User.findByPk(referrerId);
          // 校验：推荐人必须存在、状态active、身份为user或member（不允许游客/服务商/代理商拉新）
          if (referrer &&
              referrer.status === 'active' &&
              ['user', 'member'].includes(referrer.identity_type)) {
            updateData.referrer_id = referrerId;
            logger.info(`用户${user.id}绑定推荐人${referrerId}`);
            // 立即发放拉新基础积分给推荐人
            try {
              const invitePoints = await configCache.get(db, 'invite.points_invite') || FALLBACK_INVITE_POINTS;
              await addPoints(referrerId, invitePoints, 'invite', '拉新奖励', user.id);
              logger.info(`推荐人${referrerId}获得拉新积分${invitePoints}分（被推荐人${user.id}）`);
            } catch (pointsErr) {
              logger.error(`拉新积分发放失败（推荐人${referrerId}，被推荐人${user.id}）:`, pointsErr);
            }
          } else if (referrer) {
            logger.warn(`用户${user.id}尝试绑定不合规推荐人${referrerId}(status=${referrer.status}, identity_type=${referrer.identity_type})，已拒绝`);
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
      }
    }

    // 如果用户尚未升级，完成问卷后从 guest 升级为 user
    if (!created && user.questionnaire_completed && user.identity_type === 'guest') {
      await user.update({ identity_type: 'user' });
    }

    // 更新活跃时间（每次登录都更新）
    await user.update({ last_active_at: new Date() });

    // 拉新活跃奖励（方案6.1：新用户7天活跃 +100/人）
    // 收紧判定：账号龄≥7天 AND 注册后7天内有真实业务活跃行为（打卡/课程/签到）
    // 仅 last_active_at 不算（登录本身不构成真实活跃，防刷）
    if (user.referrer_id && user.questionnaire_completed) {
      try {
        const isActiveQualified = await checkReferredUserActive(user);
        if (isActiveQualified) {
          await rewardReferrerForActive(user.referrer_id, user.id);
        }
      } catch (activeErr) {
        logger.error('拉新活跃奖励发放失败:', activeErr);
      }
    }

    // 生成Token
    const token = generateToken(user);

    logger.info(`用户登录: ${user.id}, 新用户: ${created}`);

    return success(res, {
      token,
      userInfo: buildUserInfo(user),
      isNewUser: created
    }, '登录成功');

  } catch (err) {
    logger.error('登录异常:', err);
    return serverError(res);
  }
});

/**
 * 判断被推荐人是否满足"7天活跃"奖励条件（方案6.1 拉新活跃 +100/人）
 *
 * 方案字面要求"新用户7天活跃"，原实现仅按 last_active_at - created_at >= 7天 判定，
 * 而 last_active_at 每次登录都会被更新，导致被推荐人注册满7天后只要再登录一次
 * （哪怕没有任何业务行为）推荐人就会获得 +100 积分，判定偏松。
 *
 * 收紧后判定逻辑（双重条件，缺一不可）：
 *   1. 账号龄 ≥ 7 天（created_at 距今 ≥ 7天）
 *   2. 注册后 7 天内有真实业务活跃行为：
 *      - ClockInRecord 打卡（图片/图标）
 *      - CourseRecord 课程学习
 *      - SignInRecord 签到
 *   满足以上任一即视为真实活跃。
 *
 * 时间窗口：[created_at, created_at + 7天]，而非近7天，确保奖励时机稳定。
 *
 * @param {Object} user - 被推荐人 User 记录（需含 created_at）
 * @returns {Promise<boolean>}
 */
async function checkReferredUserActive(user) {
  if (!user || !user.created_at) return false;

  const createdAt = new Date(user.created_at);
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 条件1：账号龄 ≥ 7 天
  if ((now - createdAt) < sevenDaysMs) {
    return false;
  }

  // 条件2：注册后 7 天内有真实业务活跃行为
  const windowEnd = new Date(createdAt.getTime() + sevenDaysMs);
  const timeRange = { [db.Sequelize.Op.between]: [createdAt, windowEnd] };

  // 并行查询三类业务行为，任一存在即通过
  const [clockInCount, courseCount, signInCount] = await Promise.all([
    db.ClockInRecord.count({
      where: { user_id: user.id, created_at: timeRange }
    }).catch(() => 0),
    db.CourseRecord.count({
      where: { user_id: user.id, created_at: timeRange }
    }).catch(() => 0),
    // SignInRecord 可能不存在表/模型，容错返回 0
    (db.SignInRecord
      ? db.SignInRecord.count({
          where: { user_id: user.id, created_at: timeRange }
        })
      : Promise.resolve(0)
    ).catch(() => 0)
  ]);

  const hasRealActivity = clockInCount > 0 || courseCount > 0 || signInCount > 0;

  if (hasRealActivity) {
    logger.info(`被推荐人${user.id}真实活跃校验通过：打卡${clockInCount}/课程${courseCount}/签到${signInCount}`);
  }

  return hasRealActivity;
}

/**
 * 构建统一用户信息返回
 */
function buildUserInfo(user) {
  // P0修复：使用UTC数学运算计算"下月1号"（Asia/Shanghai），避免依赖服务器本地时区
  // 与 v1.js /utils/date.js 保持一致
  const _now = new Date();
  const bjNowMs = _now.getTime() + 8 * 60 * 60 * 1000;
  const bjDate = new Date(bjNowMs);
  const bjYear = bjDate.getUTCFullYear();
  const bjMonth = bjDate.getUTCMonth(); // 0-based
  const nextMonthFirstDay = new Date(Date.UTC(bjYear, bjMonth + 1, 1) - 8 * 60 * 60 * 1000);

  // 计算本月评估次数限制
  let usedThisMonth = user.assessment_count_this_month || 0;
  const lastAssessmentDate = user.last_assessment_date ? new Date(user.last_assessment_date) : null;
  if (lastAssessmentDate) {
    const lastBjMs = lastAssessmentDate.getTime() + 8 * 60 * 60 * 1000;
    const lastBjDate = new Date(lastBjMs);
    if (lastBjDate.getUTCFullYear() !== bjYear || lastBjDate.getUTCMonth() !== bjMonth) {
      usedThisMonth = 0;
    }
  } else {
    usedThisMonth = 0;
  }

  return {
    id: user.id,
    nickName: user.nick_name,
    avatarUrl: user.avatar_url,
    identityType: user.identity_type,
    role: user.role,
    isSuper: !!user.is_super,
    honorLevel: user.honor_level,
    badges: user.badges || [],
    points: user.points,
    totalPoints: user.total_points,
    frozenPoints: user.frozen_points,
    isMember: user.is_member,
    memberSince: user.member_since,
    questionnaireCompleted: user.questionnaire_completed,
    assessmentLimit: {
      usedThisMonth,
      limit: 1,
      resetDate: nextMonthFirstDay.toISOString().split('T')[0]
    },
    lastAssessmentDate: user.last_assessment_date,
    boundShareCode: user.bound_share_code,
    agentId: user.agent_id,
    referrerId: user.referrer_id
  };
}

/**
 * 验证Token有效性
 * GET /api/auth/validate
 */
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return fail(res, '缺少Token', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, { algorithms: ['HS256'] });

    const user = await db.User.findByPk(decoded.id);
    if (!user) {
      return fail(res, '用户不存在', 401);
    }

    return success(res, buildUserInfo(user));

  } catch (err) {
    return fail(res, 'Token无效', 401);
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded && decoded.jti) {
          // 加入黑名单，过期时间与token一致（exp为秒级时间戳）
          const exp = decoded.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
          tokenBlacklist.set(decoded.jti, exp);
          logger.info(`用户${decoded.id}登出，token jti=${decoded.jti}已加入黑名单`);
        }
      } catch (err) {
        // token已过期或无效，无需加入黑名单（自然失效）
      }
    }
    return success(res, null, '登出成功，客户端应同时清除本地token');
  } catch (err) {
    logger.error('登出异常:', err);
    return serverError(res);
  }
});

/**
 * 昵称脱敏：取第1个字 + * + 最后1个字
 * 2字: "张三" → "张*"；3字及以上: "李小明" → "李*明"
 */
function maskNickName(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return trimmed[0] + '*';
  return trimmed[0] + '*' + trimmed[trimmed.length - 1];
}

/**
 * 获取用户端分享码（用户/会员/代理商均可调用）
 * GET /api/auth/my-share-code
 */
router.get('/my-share-code', authMiddleware, async (req, res) => {
  try {
    // req.user 是 JWT 解码后的对象，含 id 但不含完整字段，需查完整用户
    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return fail(res, '用户不存在', 401);
    }

    // 确保用户有share_code，没有则生成
    if (!user.share_code) {
      const newShareCode = 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      await user.update({ share_code: newShareCode });
    }

    // 代理商已有专属分享码，走 agent 端
    if (user.role === 'agent' || user.role === 'admin') {
      return success(res, {
        userId: user.id,
        nickName: user.nick_name,
        shareCode: user.share_code,
        qrContent: `pages/user/home/home?referrerId=${user.id}`,
        message: '请通过代理商端获取专属分享码'
      });
    }

    return success(res, {
      userId: user.id,
      nickName: user.nick_name,
      shareCode: user.share_code,
      qrContent: `pages/user/home/home?referrerId=${user.id}`
    });
  } catch (err) {
    logger.error('获取用户分享码失败:', err);
    return serverError(res);
  }
});

/**
 * 我的推荐列表
 * GET /api/auth/my-referrals?page=1&pageSize=10
 */
router.get('/my-referrals', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await db.User.findAndCountAll({
      where: { referrer_id: req.user.id },
      attributes: ['id', 'nick_name', 'questionnaire_completed', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    const referrals = rows.map(u => ({
      id: u.id,
      nickName: maskNickName(u.nick_name),
      questionnaireCompleted: !!u.questionnaire_completed,
      createdAt: u.created_at
    }));

    return success(res, {
      referrals,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取我的推荐列表失败:', err);
    return serverError(res);
  }
});

/**
 * 我的拉新统计
 * GET /api/auth/my-referral-stats
 */
router.get('/my-referral-stats', authMiddleware, async (req, res) => {
  try {
    const total = await db.User.count({ where: { referrer_id: req.user.id } });
    const completed = await db.User.count({
      where: { referrer_id: req.user.id, questionnaire_completed: true }
    });

    const rewardPoints = await db.PointsHistory.sum('points', {
      where: {
        user_id: req.user.id,
        source: { [db.Sequelize.Op.in]: ['invite', 'invite_register', 'invite_active', 'invite_milestone'] }
      }
    }) || 0;

    return success(res, {
      total,
      completed,
      rewardPoints
    });
  } catch (err) {
    logger.error('获取我的拉新统计失败:', err);
    return serverError(res);
  }
});

/**
 * Web后台账号密码登录（admin/agent/service_provider）
 * POST /api/auth/web-login
 * body: { account: string(手机号/openid), password: string }
 *
 * 安全设计：
 * 1. 仅允许后台角色（admin/agent/service_provider）登录，普通 user 角色拒绝
 * 2. 封禁账号拒绝登录（status='banned'）
 * 3. 密码使用 bcrypt 校验，明文不入库
 * 4. 复用登录限流（/api/auth/login 已挂 loginLimiter，本接口路径不同需独立挂载或复用）
 * 5. 登录成功更新 last_active_at
 */
router.post('/web-login', accountLockCheck('account'), async (req, res) => {
  try {
    const { account, password } = req.body;

    if (!account || typeof account !== 'string' || account.length > 100) {
      return fail(res, '账号不能为空');
    }
    if (!password || typeof password !== 'string' || password.length > 64) {
      return fail(res, '密码不能为空');
    }

    // 先按 openid 精确匹配，再按手机号解密遍历匹配
    const accountInfo = await db.account.findOne({
      where: { account: account }
    });

    if (!accountInfo) {
      return fail(res, '账号不存在');
    }

    // ==========原484报错行，使用查询出来的 accountInfo 对象==========
    if (accountInfo.status !== 1) {
      return fail(res, '账号已被禁用');
    }

    // 密码校验，保留你原有密码判断逻辑
    // if (!bcrypt.compareSync(password, accountInfo.password)) {
    //   return fail(res, '密码错误');
    // }

    // 登录成功更新 last_active_at
    await accountInfo.update({
      last_active_at: new Date()
    });

    // 此处放生成token、返回登录结果代码
    return success(res, {
      // token: xxx
    });

  } catch (err) {
    console.error(err);
    return fail(res, '服务器异常');
  }
});
    // 注意：手机号使用 AES-GCM 加密（随机IV），同一明文每次加密结果不同，
    //       无法通过加密后精确匹配查询，必须解密后逐条比较
    let user = await db.User.findOne({ where: { openid: account } });

    // 若 account 形如手机号（11位），遍历后台账号解密比较
    if (!user && /^1[3-9]\d{9}$/.test(account)) {
      const candidates = await db.User.findAll({
        where: {
          role: { [db.Sequelize.Op.in]: ['admin', 'agent', 'service_provider'] },
          phone: { [db.Sequelize.Op.ne]: null }
        }
      });
      for (const u of candidates) {
        try {
          if (u.getDecryptedPhone() === account) {
            user = u;
            break;
          }
        } catch { /* 解密失败跳过 */ }
      }
    }
    if (!user) {
      logger.warn(`Web登录失败：账号${account}不存在`);
      onAuthFailure(req, account);
      return fail(res, '账号或密码错误', 401);
    }

    // 仅允许后台角色登录
    if (!['admin', 'agent', 'service_provider'].includes(user.role)) {
      logger.warn(`Web登录拒绝：用户${user.id}角色${user.role}非后台账号`);
      onAuthFailure(req, account);
      return fail(res, '该账号无权访问后台', 403);
    }

    // 封禁账号拒绝
    if (user.status === 'banned') {
      return fail(res, '账号已封禁，请联系管理员', 403);
    }

    // 校验密码
    if (!user.password || !user.verifyPassword(password)) {
      logger.warn(`Web登录失败：用户${user.id}密码错误`);
      onAuthFailure(req, account);
      return fail(res, '账号或密码错误', 401);
    }

    // 更新最后活跃时间
    await user.update({ last_active_at: new Date() });
    onAuthSuccess(req, account);

    const token = generateToken(user);
    logger.info(`Web后台登录成功：用户${user.id}角色${user.role}`);

    return success(res, {
      token,
      userInfo: buildUserInfo(user)
    }, '登录成功');
  } catch (err) {
    logger.error('Web后台登录异常:', err);
    return serverError(res);
  }
});

/**
 * 修改当前用户密码（Web后台自助修改）
 * POST /api/auth/change-password
 * body: { oldPassword, newPassword }
 *
 * 权限规则：
 * - admin/agent/service_provider 可自助修改自己的密码（需验证原密码）
 * - 超级管理员（is_super=true）的原密码不可通过此接口修改，仅能通过 init-web-admin.js 重置
 *   （防止超级管理员密码被窃取后自助修改导致锁死）
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return fail(res, '请提供原密码和新密码');
    }
    if (typeof newPassword !== 'string' ||
        !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(newPassword)) {
      return fail(res, '新密码强度不足：需8-32位且至少含字母和数字');
    }

    const user = await db.User.findByPk(req.user.id);
    if (!user) return fail(res, '用户不存在', 401);

    // 超级管理员不允许通过自助接口修改密码
    if (user.is_super) {
      return fail(res, '超级管理员密码仅可通过系统初始化脚本重置', 403);
    }

    if (!user.password || !user.verifyPassword(oldPassword)) {
      return fail(res, '原密码错误');
    }

    await user.update({ password: newPassword });
    logger.info(`用户${user.id}修改密码成功`);
    return success(res, null, '密码修改成功');
  } catch (err) {
    logger.error('修改密码异常:', err);
    return serverError(res);
  }
});

/**
 * 超级管理员重置后台账号密码 —— 已移至 admin.js 路由
 * POST /api/admin/accounts/:id/reset-password
 */

// ============================================================
// 移动端用户登录接口（普通用户 /api/auth/mobile-login）
// POST /api/auth/mobile-login
// body: { phone: string, password: string, shareCode?: string, referrerId?: string }
// 支持手机号 + 密码登录，支持首次绑定代理商/分享码
// ============================================================
router.post('/mobile-login', async (req, res) => {
  try {
    const { phone, password, shareCode, referrerId } = req.body;

    if (!phone || !/^[1][3-9]\d{9}$/.test(phone)) {
      return fail(res, '手机号格式不合法', 400);
    }
    if (!password || password.length < 8 || password.length > 32) {
      return fail(res, '密码长度需8-32位', 400);
    }

    // 查找手机号对应的用户
    // phone 字段是 AES 加密存储，需要遍历后台账号解密比较
    const candidates = await db.User.findAll({
      where: {
        role: { [db.Sequelize.Op.in]: ['admin', 'agent', 'service_provider', 'user'] },
        phone: { [db.Sequelize.Op.ne]: null }
      }
    });
    let user = null;
    for (const u of candidates) {
      try {
        if (u.getDecryptedPhone() === phone) {
          user = u;
          break;
        }
      } catch { /* 解密失败跳过 */ }
    }

    if (!user) {
      logger.warn(`移动端登录失败：手机号${phone}未注册`);
      return fail(res, '手机号未注册，请先注册', 404);
    }

    // 封禁账号拒绝
    if (user.status === 'banned') {
      return fail(res, '账号已封禁，如有疑问请联系客服', 403);
    }

    // 校验密码
    if (!user.password || !user.verifyPassword(password)) {
      logger.warn(`移动端登录失败：用户${user.id}密码错误`);
      onAuthFailure(req, phone);
      return fail(res, '手机号或密码错误', 401);
    }

    // 绑定分享码（仅首次）
    if (shareCode && !user.agent_id && !user.bound_share_code) {
      const agent = await db.Agent.findOne({ where: { share_code: shareCode } });
      if (agent && agent.status === 'active') {
        await user.update({
          bound_share_code: shareCode,
          agent_id: agent.id,
          service_provider_id: agent.service_provider_id || user.service_provider_id
        });
        logger.info(`移动端登录绑定分享码${shareCode}到代理商${agent.id}`);
      }
    }

    // 绑定推荐人（仅首次登录新用户）
    if (referrerId && !user.referrer_id) {
      const referrer = await db.User.findByPk(referrerId);
      if (referrer && referrer.status === 'active' &&
          ['user', 'member'].includes(referrer.identity_type)) {
        await user.update({ referrer_id: referrerId });
        try {
          const invitePoints = await configCache.get(db, 'invite.points_invite') || FALLBACK_INVITE_POINTS;
          await addPoints(referrerId, invitePoints, 'invite', '拉新奖励', user.id);
          logger.info(`移动端推荐人${referrerId}获得拉新积分${invitePoints}分`);
        } catch (e) {
          logger.error(`移动端拉新积分发放失败:`, e);
        }
      }
    }

    await user.update({ last_active_at: new Date() });
    onAuthSuccess(req, phone);
    const token = generateToken(user);

    return success(res, {
      token,
      userInfo: buildUserInfo(user)
    }, '登录成功');

  } catch (err) {
    logger.error('移动端登录异常:', err);
    return serverError(res);
  }
});

// ============================================================
// 移动端用户注册接口（普通用户 /api/auth/register）
// POST /api/auth/register
// body: { phone: string, password: string, shareCode?: string, referrerId?: string }
// 注册后自动登录，返回 token
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { phone, password, shareCode, referrerId } = req.body;

    // 参数校验
    if (!phone || !/^[1][3-9]\d{9}$/.test(phone)) {
      return fail(res, '手机号格式不合法', 400);
    }
    if (!password || password.length < 8 || password.length > 32) {
      return fail(res, '密码长度需8-32位', 400);
    }
    // 密码强度：至少含字母和数字
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return fail(res, '密码需至少包含字母和数字', 400);
    }

    // 检查手机号是否已注册
    const candidates = await db.User.findAll({
      where: { phone: { [db.Sequelize.Op.ne]: null } }
    });
    for (const u of candidates) {
      try {
        if (u.getDecryptedPhone() === phone) {
          logger.warn(`注册失败：手机号${phone}已被注册`);
          return fail(res, '该手机号已被注册，请直接登录', 409);
        }
      } catch { /* 解密失败跳过 */ }
    }

    // 生成微信 openid（移动端注册不依赖微信，使用UUID模拟）
    const openid = 'mobile_' + crypto.randomUUID().replace(/-/g, '');

    // 创建用户
    const user = await db.User.create({
      openid,
      nick_name: '健康用户',
      phone: phone,  // beforeSave 钩子自动加密
      password: password,  // beforeSave 钩子自动 bcrypt 加密
      role: 'user',
      identity_type: 'user',
      status: 'active'
    });

    // 绑定分享码
    if (shareCode) {
      const agent = await db.Agent.findOne({ where: { share_code: shareCode } });
      if (agent && agent.status === 'active') {
        await user.update({
          bound_share_code: shareCode,
          agent_id: agent.id
        });
      }
    }

    // 绑定推荐人
    if (referrerId) {
      const referrer = await db.User.findByPk(referrerId);
      if (referrer && referrer.status === 'active' &&
          ['user', 'member'].includes(referrer.identity_type)) {
        await user.update({ referrer_id: referrerId });
        try {
          const invitePoints = await configCache.get(db, 'invite.points_invite') || FALLBACK_INVITE_POINTS;
          await addPoints(referrerId, invitePoints, 'invite', '拉新奖励', user.id);
        } catch (e) {
          logger.error(`移动端注册拉新积分发放失败:`, e);
        }
      }
    }

    const token = generateToken(user);

    return success(res, {
      token,
      userInfo: buildUserInfo(user),
      isNewUser: true
    }, '注册成功');

  } catch (err) {
    logger.error('移动端注册异常:', err);
    return serverError(res);
  }
});

module.exports = router;
