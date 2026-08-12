// middleware/auth.js - 认证中间件（第二道防线：认证与权限）
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { unauthorized, forbidden } = require('../utils/response');
const db = require('../models');
const logger = require('../utils/logger');

// 生产环境强制要求密钥配置
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('生产环境必须配置 JWT_SECRET 环境变量');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev_only_secret_not_for_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Token黑名单（logout时写入）：key=jti, value=过期时间戳(ms)
const tokenBlacklist = new Map();

// 定期清理过期黑名单项，避免内存泄漏
function cleanupTokenBlacklist() {
  const now = Date.now();
  for (const [jti, exp] of tokenBlacklist.entries()) {
    if (exp <= now) {
      tokenBlacklist.delete(jti);
    }
  }
}
setInterval(() => {
  try { cleanupTokenBlacklist(); } catch (e) { /* ignore */ }
}, 60 * 60 * 1000).unref();

/**
 * 生成JWT Token
 * 安全注意：不在 payload 中包含 openid（可能被截取后用于身份关联攻击）
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      identity_type: user.identity_type,
      agent_id: user.agent_id || null,
      service_provider_id: user.service_provider_id || null,
      jti: crypto.randomUUID()
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );
}

/**
 * 验证JWT Token中间件
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = authHeader.split(' ')[1];

  try {
    // P0修复：显式指定算法，防止算法混淆攻击（alg:none / RS256→HS256）
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET, { algorithms: ['HS256'] });
    // 检查token是否在黑名单中（已登出）
    if (decoded.jti && tokenBlacklist.has(decoded.jti)) {
      return unauthorized(res, 'Token已失效,请重新登录');
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token已过期,请重新登录');
    }
    return unauthorized(res, '无效的Token');
  }
}

/**
 * 角色权限检查中间件
 */
function roleCheck(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res);
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`用户 ${req.user.id} 尝试访问受限资源,角色: ${req.user.role}`);
      return forbidden(res, `需要 ${allowedRoles.join(' 或 ')} 角色`);
    }

    next();
  };
}

/**
 * Agent权限检查
 */
function agentOnly(req, res, next) {
  return roleCheck('agent', 'admin')(req, res, next);
}

/**
 * Admin权限检查
 */
function adminOnly(req, res, next) {
  return roleCheck('admin')(req, res, next);
}

/**
 * 超级管理员权限检查
 * 仅 is_super=true 的 admin 账号可通过，用于：
 * - 创建/修改 admin 账号
 * - 修改代理商/服务商权限和密码
 * - 重置后台账号密码
 */
async function superAdminOnly(req, res, next) {
  if (!req.user) {
    return unauthorized(res);
  }
  if (req.user.role !== 'admin') {
    return forbidden(res, '需要超级管理员权限');
  }
  // req.user 来自 JWT 解码，不包含 is_super，需查库获取
  try {
    const user = await db.User.findByPk(req.user.id);
    if (!user || !user.is_super) {
      logger.warn(`用户 ${req.user.id} 尝试访问超级管理员专属资源，is_super=${user ? user.is_super : 'null'}`);
      return forbidden(res, '仅超级管理员可执行此操作');
    }
    next();
  } catch (err) {
    logger.error('superAdminOnly 查库失败:', err);
    return forbidden(res, '权限校验失败');
  }
}

/**
 * 服务商权限检查
 */
function serviceProviderOnly(req, res, next) {
  return roleCheck('service_provider', 'admin', 'agent')(req, res, next);
}

/**
 * 普通用户权限检查
 *
 * 设计说明（重要）：
 *   1. admin 始终拥有所有权限（与 agentOnly/serviceProviderOnly 保持一致）
 *   2. **不建议**将本中间件强制应用到 /api/user/* 全部路由，原因：
 *      - 方案3.1 中"代理商/服务商/管理员"本身也是用户（拥有 user_id）
 *      - 他们需要访问自己的资料、积分、报告、打卡、签到、兑换等用户端功能
 *      - 强制 roleCheck('user') 会导致代理商无法修改自己 nick_name、无法查看自己报告
 *   3. /api/user/* 当前仅用 authMiddleware 保护（任何已登录角色均可访问）是有意为之
 *   4. 本中间件供**特定场景**手动应用，例如：
 *      - 纯 C 端用户专属活动（如拉新奖励领取、新人礼包）
 *      - 不应被代理商/服务商/管理员使用的营销接口
 */
function userOnly(req, res, next) {
  return roleCheck('user', 'admin')(req, res, next);
}

module.exports = {
  generateToken,
  authMiddleware,
  roleCheck,
  agentOnly,
  adminOnly,
  superAdminOnly,
  serviceProviderOnly,
  userOnly,
  EFFECTIVE_JWT_SECRET,
  tokenBlacklist
};