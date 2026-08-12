// middleware/bruteForce.js - 暴力破解防护中间件（第二道防线：业务逻辑层）
const { recordAuthFailure, recordAuthSuccess } = require('./fail2ban');
const logger = require('../utils/logger');

// 内存存储：账号 -> { failedCount, lastAttempt, lockedUntil }
const accountAttemptLog = new Map();
const accountLockWindowMs = 15 * 60 * 1000; // 15分钟窗口
const accountMaxFailedAttempts = 10; // 10次失败锁定
const accountLockDurationMs = 5 * 60 * 1000; // 5分钟锁定

function getAccountKey(identifier) {
  return String(identifier).toLowerCase().trim();
}

function getAccountData(key) {
  return accountAttemptLog.get(key) || { failedCount: 0, lastAttempt: 0, lockedUntil: 0 };
}

function setAccountData(key, data) {
  accountAttemptLog.set(key, data);
}

// 定期清理过期记录
function cleanup() {
  const now = Date.now();
  for (const [key, data] of accountAttemptLog.entries()) {
    if (now - data.lastAttempt > accountLockWindowMs && now > data.lockedUntil) {
      accountAttemptLog.delete(key);
    }
  }
}
setInterval(cleanup, 60 * 1000).unref();

/**
 * 检查账号是否被锁定
 */
function isAccountLocked(identifier) {
  const key = getAccountKey(identifier);
  const data = getAccountData(key);
  const now = Date.now();
  if (data.lockedUntil && now > data.lockedUntil) {
    accountAttemptLog.delete(key);
    return false;
  }
  return data.lockedUntil > now;
}

/**
 * 记录账号登录失败
 * @param {string} identifier - 账号标识
 * @param {Object} [req] - Express 请求对象，用于同步记录真实 IP 的失败次数
 */
function recordAccountFailure(identifier, req) {
  const key = getAccountKey(identifier);
  const data = getAccountData(key);
  data.failedCount += 1;
  data.lastAttempt = Date.now();
  if (data.failedCount >= accountMaxFailedAttempts) {
    data.lockedUntil = Date.now() + accountLockDurationMs;
    logger.warn(`[BruteForce] 账号 ${key} 因 ${data.failedCount} 次失败登录被锁定 ${accountLockDurationMs / 60000} 分钟`);
  }
  setAccountData(key, data);
  // 同步记录 IP 层面的失败（必须传入真实 req，否则所有来源会被归并到同一个计数桶）
  if (req) recordAuthFailure(req);
}

/**
 * 记录账号登录成功（重置计数）
 * @param {string} identifier - 账号标识
 * @param {Object} [req] - Express 请求对象
 */
function recordAccountSuccess(identifier, req) {
  const key = getAccountKey(identifier);
  accountAttemptLog.delete(key);
  if (req) recordAuthSuccess(req);
}

/**
 * 从请求中解析待校验的账号标识
 * @param {Object} req - Express 请求对象
 * @param {Function|string|undefined} resolver - 解析方式
 * @returns {string|null}
 */
function resolveIdentifier(req, resolver) {
  const body = (req && req.body) || {};
  let value;
  if (typeof resolver === 'function') {
    value = resolver(req);
  } else if (typeof resolver === 'string') {
    value = body[resolver];
  } else {
    // 默认按常见账号字段依次探测
    value = body.account || body.mobile || body.phone || body.username;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 账号锁定检查中间件
 * 用于 /api/auth/web-login 和 /api/auth/mobile-login 路由
 *
 * 注意：必须在请求到达时动态解析账号，不能在挂载路由时传入静态值。
 * 用法：router.post('/web-login', accountLockCheck(), handler)
 *      router.post('/mobile-login', accountLockCheck('phone'), handler)
 *      router.post('/xxx', accountLockCheck(req => req.body.foo), handler)
 *
 * @param {Function|string} [resolver] - 字段名 或 (req)=>identifier；缺省自动探测
 */
function accountLockCheck(resolver) {
  return (req, res, next) => {
    let identifier;
    try {
      identifier = resolveIdentifier(req, resolver);
    } catch (err) {
      logger.warn('[BruteForce] 账号解析失败，跳过锁定检查:', err.message);
      return next();
    }
    // 取不到账号时交由后续 handler 做参数校验，不在此处拦截
    if (!identifier) return next();

    if (isAccountLocked(identifier)) {
      return res.status(429).json({
        success: false,
        message: '账号已被临时锁定，请5分钟后再试',
        code: 'ACCOUNT_LOCKED'
      });
    }
    next();
  };
}

/**
 * 记录登录失败
 */
function onAuthFailure(req, identifier) {
  recordAccountFailure(identifier, req);
}

/**
 * 记录登录成功
 */
function onAuthSuccess(req, identifier) {
  recordAccountSuccess(identifier, req);
}

module.exports = {
  accountLockCheck,
  recordAccountFailure,
  recordAccountSuccess,
  isAccountLocked,
  onAuthFailure,
  onAuthSuccess
};
