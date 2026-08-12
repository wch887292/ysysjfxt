// routes/v1.js - API v1 路由（规格9.1-9.5 对外契约）
// 提供规格定义的 /api/v1/ 版本化路径，复用现有 handler 逻辑
// 请求兼容 snake_case（规格）和 camelCase（现有前端），响应同时返回两种命名
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { generateToken, authMiddleware, agentOnly } = require('../middleware/auth');
const axios = require('axios');
const { addPoints } = require('./points');
const configCache = require('../utils/configCache');

// 拉新基础积分默认值
const FALLBACK_INVITE_POINTS = 20;

const WX_APPID = process.env.WX_APPID;
const WX_SECRET = process.env.WX_SECRET;

/**
 * 从请求体中同时获取 snake_case 和 camelCase 字段（tolerant reader）
 * 优先 snake_case（规格），回退 camelCase（现有前端）
 */
function pickField(body, snakeKey, camelKey) {
  if (body[snakeKey] !== undefined) return body[snakeKey];
  if (body[camelKey] !== undefined) return body[camelKey];
  return undefined;
}

// ============================================================
// 规格9.1 用户身份识别接口
// POST /api/v1/user/identify
// ============================================================
router.post('/user/identify', async (req, res) => {
  try {
    const wechatOpenid = pickField(req.body, 'wechat_openid', 'wechatOpenid');
    const shareCode = pickField(req.body, 'share_code', 'shareCode');
    const referrerId = pickField(req.body, 'referrer_id', 'referrerId');
    const code = req.body.code;

    // 校验referrerId格式（UUID）
    if (referrerId !== undefined && referrerId !== null) {
      if (typeof referrerId !== 'string' || referrerId.length > 64 || !/^[A-Za-z0-9\-]+$/.test(referrerId)) {
        return fail(res, 'referrerId格式不合法');
      }
    }

    let openid = wechatOpenid;

    if (!openid && code) {
      const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: WX_APPID,
          secret: WX_SECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });
      if (wxRes.data.errcode) {
        return fail(res, `微信登录失败: ${wxRes.data.errmsg}`);
      }
      openid = wxRes.data.openid;
    }

    if (!openid) {
      return fail(res, '缺少 wechat_openid 或 code 参数');
    }

    let [user, created] = await db.User.findOrCreate({
      where: { openid },
      defaults: {
        openid,
        nick_name: '健康新人',
        status: 'active',
        last_active_at: new Date(),
        share_code: 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
      }
    });

    // 封禁用户不得获取登录 token（与 /api/auth/login 第72-74行对齐，硬约束）
    if (user.status === 'banned') {
      return fail(res, '账号已封禁，如有疑问请联系客服', 403);
    }

    // 关联唯一性规则：用户与代理商/服务商的关联以首次绑定为准，一旦绑定不可更改
    const updateData = {};
    if (shareCode && !user.agent_id && !user.bound_share_code) {
      const agent = await db.Agent.findOne({ where: { share_code: shareCode } });
      if (agent && agent.status === 'active') {
        updateData.bound_share_code = shareCode;
        updateData.agent_id = agent.id;
        // 仅在用户尚未绑定服务商时才自动关联代理商的服务商
        if (!user.service_provider_id && agent.service_provider_id) {
          updateData.service_provider_id = agent.service_provider_id;
        }
      }
    } else if (shareCode && user.agent_id) {
      // 已绑定代理商，忽略新分享码
    }

    // 绑定推荐人（仅新用户首次登录）
    // 拉新积分：新用户绑定推荐人时，推荐人立即获得基础拉新积分（默认20分）
    if (created && referrerId && !user.referrer_id) {
      // 防御性检查：禁止自推荐
      if (referrerId === user.id) {
        logger.warn(`用户${user.id}尝试自推荐，已拒绝`);
      } else {
        const referrer = await db.User.findByPk(referrerId);
        // 校验：推荐人必须存在、状态active、身份为user或member
        if (referrer &&
            referrer.status === 'active' &&
            ['user', 'member'].includes(referrer.identity_type)) {
          updateData.referrer_id = referrerId;
          logger.info(`用户${user.id}绑定推荐人${referrerId}（v1）`);
          // 立即发放拉新基础积分给推荐人
          try {
            const invitePoints = await configCache.get(db, 'invite.points_invite') || FALLBACK_INVITE_POINTS;
            await addPoints(referrerId, invitePoints, 'invite', '拉新奖励', user.id);
            logger.info(`推荐人${referrerId}获得拉新积分${invitePoints}分（被推荐人${user.id}，v1）`);
          } catch (pointsErr) {
            logger.error(`拉新积分发放失败（推荐人${referrerId}，被推荐人${user.id}，v1）:`, pointsErr);
          }
        } else if (referrer) {
          logger.warn(`用户${user.id}尝试绑定不合规推荐人${referrerId}(status=${referrer.status}, identity_type=${referrer.identity_type})，已拒绝`);
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }

    if (!created && user.questionnaire_completed && user.identity_type === 'guest') {
      await user.update({ identity_type: 'user' });
    }

    await user.update({ last_active_at: new Date() });
    const token = generateToken(user);

    // P0修复：使用UTC数学运算计算"下月1号"（Asia/Shanghai），避免依赖服务器本地时区
    // 与 utils/date.js 的 getBusinessDayStart 保持一致
    const _now = new Date();
    // 北京时间 = UTC + 8h → 当前UTC毫秒 + 8h偏移
    const bjNowMs = _now.getTime() + 8 * 60 * 60 * 1000;
    const bjDate = new Date(bjNowMs);
    const bjYear = bjDate.getUTCFullYear();
    const bjMonth = bjDate.getUTCMonth(); // 0-based
    // 下月1号（北京时间）= UTC时间
    const nextMonthFirstDay = new Date(Date.UTC(bjYear, bjMonth + 1, 1) - 8 * 60 * 60 * 1000);

    let usedThisMonth = user.assessment_count_this_month || 0;
    const lastAssessmentDate = user.last_assessment_date ? new Date(user.last_assessment_date) : null;
    // 同样使用UTC数学运算判断"本月"
    if (lastAssessmentDate) {
      const lastBjMs = lastAssessmentDate.getTime() + 8 * 60 * 60 * 1000;
      const lastBjDate = new Date(lastBjMs);
      if (lastBjDate.getUTCFullYear() !== bjYear || lastBjDate.getUTCMonth() !== bjMonth) {
        usedThisMonth = 0;
      }
    } else {
      usedThisMonth = 0;
    }

    // 规格9.1 响应（扁平结构 + snake_case + camelCase 兼容）
    // identity_type 枚举：guest|user|member|agent|service_provider（与 Schema 8.1 对齐）
    return success(res, {
      user_id: user.id,
      identity_type: user.identity_type,
      is_first_visit: created,
      agent_id: user.agent_id || null,
      referrer_id: user.referrer_id || null,
      share_code: user.share_code || null,
      assessment_limit: {
        used_this_month: usedThisMonth,
        limit: 1,
        reset_date: nextMonthFirstDay.toISOString().split('T')[0]
      },
      honor_level: user.honor_level,
      badges: user.badges || [],
      token,
      // camelCase 兼容双写
      userId: user.id,
      identityType: user.identity_type,
      isFirstVisit: created,
      agentId: user.agent_id || null,
      referrerId: user.referrer_id || null,
      shareCode: user.share_code || null,
      assessmentLimit: {
        usedThisMonth,
        limit: 1,
        resetDate: nextMonthFirstDay.toISOString().split('T')[0]
      },
      honorLevel: user.honor_level
    }, '身份识别成功');
  } catch (err) {
    logger.error('用户身份识别失败:', err);
    return serverError(res);
  }
});

// ============================================================
// 规格9.2 打卡接口 — 复用 clockIn 路由（需认证）
// /api/v1/clock-in/icon, /api/v1/clock-in/image
// ============================================================
const clockInRoutes = require('./clockIn');
router.use('/clock-in', authMiddleware, clockInRoutes);

// ============================================================
// 规格9.3 课程学习接口 — 复用 course 路由（需认证）
// /api/v1/course/progress
// ============================================================
const courseRoutes = require('./course');
router.use('/course', authMiddleware, courseRoutes);

// ============================================================
// 规格9.4 积分核销接口 — 代理到 agent 路由的 write-off（需 agent 权限）
// POST /api/v1/points/write-off
// ============================================================
const agentRoutes = require('./agent');

router.post('/points/write-off', authMiddleware, agentOnly, (req, res, next) => {
  // 转发到 agent 路由的 /points/write-off handler
  req.url = '/points/write-off';
  agentRoutes.handle(req, res, next);
});

// ============================================================
// 规格9.5 信息发布接口 — 代理到 agent 路由的 posts（需 agent 权限）
// POST /api/v1/agent/publish → 映射到 /posts
// ============================================================
router.post('/agent/publish', authMiddleware, agentOnly, (req, res, next) => {
  req.url = '/posts';
  agentRoutes.handle(req, res, next);
});

// 同时挂载完整 agent 路由供 /api/v1/agent/* 其他端点使用
router.use('/agent', authMiddleware, agentOnly, agentRoutes);

module.exports = router;
