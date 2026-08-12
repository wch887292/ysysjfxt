// middleware/errorHandler.js - 错误处理中间件（第三道防线：数据安全）
const logger = require('../utils/logger');

// 敏感字段黑名单：日志中不记录
const SENSITIVE_KEYS = [
  'phone', 'password', 'pwd', 'token', 'secret', 'code', 'jsCode',
  'wxCode', 'accessToken', 'refreshToken', 'authorization',
  'idCard', 'id_card', 'realName', 'real_name', 'openid', 'unionid',
  'aesKey', 'aesSecretKey', 'apiKey', 'shareCode', 'referrerId'
];

// 不向客户端泄露的内部错误码
const INTERNAL_ERROR_CODES = new Set([
  'ER_DUP_ENTRY',      // 数据库唯一约束冲突
  'SequelizeUniqueConstraintError',
  'SequelizeValidationError',
  'JsonWebTokenError',
  'TokenExpiredError',
  'SyntaxError',       // JSON 解析错误
  'RangeError'
]);

/**
 * 递归过滤敏感字段
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const safe = {};
  for (const key of Object.keys(body)) {
    if (SENSITIVE_KEYS.includes(key)) {
      safe[key] = '[REDACTED]';
    } else {
      const val = body[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        safe[key] = sanitizeBody(val);
      } else if (Array.isArray(val)) {
        safe[key] = val.length > 20 ? `[Array len=${val.length}]` : val;
      } else {
        safe[key] = val;
      }
    }
  }
  return safe;
}

function errorHandler(err, req, res, next) {
  // 过滤敏感字段，避免日志泄露
  const safeBody = sanitizeBody(req.body);
  const safeQuery = sanitizeBody(req.query);
  logger.error(`错误: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    body: safeBody,
    query: safeQuery,
    stack: err.stack,
    ip: req.ip
  });

  // Sequelize验证错误
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({
      success: false,
      message: `数据验证失败: ${messages.join('; ')}`,
      data: null
    });
  }

  // Sequelize唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: '数据已存在,请勿重复提交',
      data: null
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '认证失败',
      data: null
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token已过期,请重新登录',
      data: null
    });
  }

  // 防止信息泄露：生产环境不返回内部错误详情
  const isInternalError = err.statusCode >= 500 || INTERNAL_ERROR_CODES.has(err.name);
  if (isInternalError) {
    const statusCode = process.env.NODE_ENV === 'production' ? 500 : (err.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : (err.message || '服务器内部错误'),
      data: null,
      // 开发环境返回错误类型，生产环境不返回
      errorType: process.env.NODE_ENV !== 'production' ? err.name : undefined
    });
  }

  // 默认服务器错误
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    data: null
  });
}

module.exports = { errorHandler };