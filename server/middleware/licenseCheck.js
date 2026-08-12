// middleware/licenseCheck.js - 授权检查中间件
// 试用期到期后拦截所有非白名单 API 请求
const { getLicenseStatus, isWhitelisted } = require('../utils/license');
const logger = require('../utils/logger');

// 缓存授权状态，避免每次请求都读取文件（每5分钟刷新一次）
let cachedStatus = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getCachedStatus() {
  const now = Date.now();
  if (!cachedStatus || now > cacheExpiry) {
    cachedStatus = getLicenseStatus();
    cacheExpiry = now + CACHE_TTL;
  }
  return cachedStatus;
}

// 清除缓存（激活许可证后调用）
function clearCache() {
  cachedStatus = null;
  cacheExpiry = 0;
}

/**
 * 授权检查中间件
 * 试用期到期且无有效许可证时，拦截所有非白名单请求
 */
function licenseCheckMiddleware(req, res, next) {
  // 白名单路径直接放行
  if (isWhitelisted(req.path)) {
    return next();
  }

  const status = getCachedStatus();

  // 已激活许可证 或 试用期内 → 放行
  if (status.isLicensed || !status.isExpired) {
    return next();
  }

  // 试用期已到期且未激活许可证 → 拦截
  logger.warn(`[License] 试用期已到期，拦截请求: ${req.method} ${req.originalUrl}`);
  return res.status(403).json({
    success: false,
    code: 'LICENSE_EXPIRED',
    message: '试用期已到期，请输入正式版本密钥激活系统',
    data: {
      status: 'expired',
      trial: status.trial,
      activateUrl: '/api/license/activate',
      statusUrl: '/api/license/status'
    }
  });
}

module.exports = {
  licenseCheckMiddleware,
  clearCache,
  getCachedStatus
};
