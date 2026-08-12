// middleware/accessControl.js - 访问控制中间件（第二道防线：权限防护）
const { forbidden, unauthorized } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * IDOR 防护中间件：确保用户只能访问自己的资源
 * 用于 GET /api/user/:id 等接口，防止通过修改ID访问他人数据
 */
function selfOnly(req, res, next) {
  const targetId = req.params.id || req.query.userId;
  if (targetId && targetId !== String(req.user.id)) {
    logger.warn(`[IDOR] 用户 ${req.user.id} 尝试访问 ${req.method} ${req.path} 非本人数据 targetId=${targetId}`);
    return forbidden(res, '无权访问他人数据');
  }
  next();
}

/**
 * 敏感操作二次验证检查
 * 记录审计日志，不阻断但标记高风险操作
 */
function auditSensitiveOperation(req, operation) {
  logger.warn(`[Audit] 敏感操作: ${req.user?.id || 'anonymous'} ${req.method} ${req.path} op=${operation}`);
}

/**
 * 检查请求来源白名单（防CSRF）
 */
function checkOrigin(req, res, next) {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

  // 本地开发跳过
  if (allowedOrigins.length === 0) {
    return next();
  }

  if (origin && !allowedOrigins.some(ao => origin.startsWith(ao))) {
    logger.warn(`[CSRF] 非授权来源请求: origin=${origin} path=${req.path}`);
    return forbidden(res, '请求来源不合法');
  }
  next();
}

/**
 * 限制请求体大小（防DoS）
 * 在 express.json({limit: '10mb'}) 之前执行，拒绝超大请求
 */
function bodySizeLimit(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({
      success: false,
      message: '请求体过大，请缩减内容后重试',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  next();
}

/**
 * 内容类型校验中间件
 * POST/PUT/PATCH 请求必须携带 application/json Content-Type
 */
function contentTypeCheck(req, res, next) {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      logger.warn(`[Security] 非JSON内容类型请求: ${method} ${req.path} contentType=${contentType}`);
      return res.status(415).json({
        success: false,
        message: '仅支持 application/json 格式',
        code: 'UNSUPPORTED_MEDIA_TYPE'
      });
    }
  }
  next();
}

module.exports = { selfOnly, auditSensitiveOperation, checkOrigin, bodySizeLimit, contentTypeCheck };
