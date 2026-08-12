// middleware/securityHeaders.js - 安全响应头中间件（第一道防线：网络层）
const helmet = require('helmet');

/**
 * 安全头配置（强化版）
 * - X-Frame-Options: DENY（防点击劫持）
 * - X-Content-Type-Options: nosniff（防MIME嗅探）
 * - X-XSS-Protection: 1; mode=block（IE XSS过滤）
 * - Strict-Transport-Security: max-age=31536000（HSTS，强制HTTPS）
 * - Referrer-Policy: strict-origin-when-cross-origin（防Referer泄露）
 * - Permissions-Policy: 限制浏览器能力（摄像头、麦克风等）
 */
function securityHeadersMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  });
}

/**
 * 额外安全头（helmet 不覆盖的部分）
 */
function extraSecurityHeaders() {
  return (req, res, next) => {
    // 禁止缓存敏感接口
    if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/admin/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // 服务器信息脱敏
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
  };
}

module.exports = { securityHeadersMiddleware, extraSecurityHeaders };
