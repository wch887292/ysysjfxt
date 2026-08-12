// middleware/fail2ban.js - IP封禁中间件（第一道防线：防暴力攻击）
const logger = require('../utils/logger');

// 内存存储：IP -> { failedCount, lastAttempt, bannedUntil }
const ipAttemptLog = new Map();
const banWindowMs = 15 * 60 * 1000; // 封禁窗口：15分钟
const banDurationMs = 10 * 60 * 1000; // 封禁时长：10分钟
const maxFailedAttempts = 20; // 15分钟内失败20次则封禁

// 定期清理过期记录
function cleanup() {
  const now = Date.now();
  for (const [ip, data] of ipAttemptLog.entries()) {
    if (now - data.lastAttempt > banWindowMs) {
      ipAttemptLog.delete(ip);
    }
  }
}
setInterval(cleanup, 60 * 1000).unref();

function getRealIP(req) {
  // 支持代理链：X-Forwarded-For -> X-Real-IP -> req.ip
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.ip || req.connection.remoteAddress || 'unknown';
}

function isBanned(ip) {
  const data = ipAttemptLog.get(ip);
  if (!data) return false;
  const now = Date.now();
  // 从未达到封禁阈值（bannedUntil 为 0）→ 未封禁
  if (!data.bannedUntil) return false;
  // 封禁已到期 → 解封并清除记录
  if (now > data.bannedUntil) {
    ipAttemptLog.delete(ip);
    return false;
  }
  // 仅在封禁未到期时才判定为封禁
  return true;
}

function recordAttempt(ip, success) {
  const now = Date.now();
  let data = ipAttemptLog.get(ip) || { failedCount: 0, lastAttempt: 0, bannedUntil: 0 };

  if (!success) {
    data.failedCount += 1;
    data.lastAttempt = now;
    // 超过阈值则封禁
    if (data.failedCount >= maxFailedAttempts) {
      data.bannedUntil = now + banDurationMs;
      logger.warn(`[Fail2Ban] IP ${ip} 因暴力攻击被临时封禁 ${banDurationMs / 60000} 分钟`);
    }
  } else {
    // 成功登录，重置计数
    data.failedCount = 0;
    data.bannedUntil = 0;
  }
  ipAttemptLog.set(ip, data);
}

/**
 * 中间件：检查IP是否被封禁
 */
function fail2banMiddleware(req, res, next) {
  const ip = getRealIP(req);
  if (isBanned(ip)) {
    return res.status(429).json({
      success: false,
      message: '操作过于频繁，请稍后再试',
      code: 'IP_BANNED'
    });
  }
  next();
}

/**
 * 中间件：记录认证失败（供 /api/auth/login 等接口调用）
 */
function recordAuthFailure(req) {
  const ip = getRealIP(req);
  recordAttempt(ip, false);
}

/**
 * 中间件：记录认证成功（重置计数）
 */
function recordAuthSuccess(req) {
  const ip = getRealIP(req);
  recordAttempt(ip, true);
}

module.exports = { fail2banMiddleware, recordAuthFailure, recordAuthSuccess };
