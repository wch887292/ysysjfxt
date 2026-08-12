// middleware/timingSafeCompare.js - 时序安全比较（防侧信道攻击）
const crypto = require('crypto');

/**
 * 时序安全字符串比较：固定耗时，防止通过响应时间推断匹配长度
 * 替代 JSON.stringify(a) === JSON.stringify(b) 等不安全比较
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * 延迟响应中间件：防止通过响应时间差推断用户是否存在
 * 伪造一个固定的最小响应延迟
 */
function antiEnumerationDelay(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    // 在登录/注册接口添加固定延迟，防止枚举攻击
    const delay = req.path.startsWith('/api/auth/') ? 100 : 0;
    if (delay > 0) {
      setTimeout(() => originalJson(body), delay);
    } else {
      originalJson(body);
    }
  };
  next();
}

module.exports = { timingSafeEqual, antiEnumerationDelay };
