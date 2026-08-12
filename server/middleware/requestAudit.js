// middleware/requestAudit.js - 请求审计日志中间件（第一道防线：可追溯性）
const logger = require('../utils/logger');

// 敏感路径列表（记录详细日志）
const SENSITIVE_PATHS = [
  '/api/auth/login',
  '/api/auth/mobile-login',
  '/api/auth/web-login',
  '/api/auth/register',
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/admin/',
  '/api/user/export-data',
  '/api/user/request-deletion',
  '/api/agent/points/write-off',
  '/api/v1/'
];

function getRequestIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress || 'unknown';
}

function getRequestUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

function getRequestReferer(req) {
  return req.headers.referer || req.headers.referer || '-';
}

function stripSensitiveHeaders(headers) {
  const sensitive = ['authorization', 'cookie', 'x-api-key'];
  const clean = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!sensitive.includes(k.toLowerCase())) {
      clean[k] = v;
    }
  }
  return clean;
}

function requestAuditMiddleware(req, res, next) {
  const start = Date.now();
  const isSensitive = SENSITIVE_PATHS.some(p => req.path.startsWith(p));

  if (isSensitive) {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: getRequestIP(req),
      userAgent: getRequestUserAgent(req),
      referer: getRequestReferer(req),
      userId: req.user?.id || 'anonymous',
      headers: stripSensitiveHeaders(req.headers)
    };
    logger.info(`[Audit] ${req.method} ${req.path}`, logData);
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (isSensitive || res.statusCode >= 400) {
      const logEntry = {
        statusCode: res.statusCode,
        durationMs: duration,
        requestBytes: req.headers['content-length'] || 0
      };
      if (res.statusCode >= 500) {
        logger.error(`[Audit] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`, logEntry);
      } else if (res.statusCode >= 400) {
        logger.warn(`[Audit] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`, logEntry);
      }
    }
  });

  next();
}

module.exports = { requestAuditMiddleware };
