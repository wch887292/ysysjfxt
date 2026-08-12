// middleware/paramSanitize.js - 请求参数净化中间件（第二道防线：注入防护）
const logger = require('../utils/logger');

/**
 * 检测常见注入攻击模式
 * 返回 true 表示检测到攻击，应拒绝请求
 */
function detectInjection(input) {
  if (typeof input !== 'string') return false;
  if (input.length > 10000) return true; // 异常长的字符串

  const patterns = [
    // SQL注入
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b.*\b(FROM|INTO|TABLE|USER|DATABASE)\b)/i,
    /(--|;|\/\*|\*\/)/,
    // XSS
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,
    // 路径遍历
    /\.\.[\\/]/,
    // Node.js原型链污染
    /__proto__|constructor|prototype/,
    // SSRF探测
    /localhost|127\.0\.0\.1|0\.0\.0\.0|internal|metadata\.google/i,
    // Command injection
    /[;|`$]|\$\(/
  ];

  return patterns.some(p => p.test(input));
}

/**
 * 递归检测对象中的所有字符串值
 */
function deepDetect(obj, path = '') {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'string') {
    if (detectInjection(obj)) {
      return [`${path || 'root'}: ${obj.substring(0, 200)}`];
    }
    return [];
  }
  if (Array.isArray(obj)) {
    const results = [];
    for (let i = 0; i < obj.length; i++) {
      results.push(...deepDetect(obj[i], `${path}[${i}]`));
    }
    return results;
  }
  if (typeof obj === 'object') {
    const results = [];
    for (const key of Object.keys(obj)) {
      results.push(...deepDetect(obj[key], `${path}.${key}`));
    }
    return results;
  }
  return [];
}

/**
 * 净化参数：移除危险的 query 参数和 body 字段
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const safe = {};
  for (const key of Object.keys(body)) {
    const value = body[key];
    // 限制字段名长度
    if (key.length > 100) continue;
    // 跳过原型链污染键
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof value === 'string') {
      // 截断超长字符串
      safe[key] = value.length > 5000 ? value.substring(0, 5000) : value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      safe[key] = sanitizeBody(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * 请求参数净化中间件
 * 在 express.json() 之后运行，对 req.body 进行安全处理
 */
function paramSanitizeMiddleware(req, res, next) {
  // 仅处理 JSON 请求体
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeBody(req.body);
  }

  // 清理 query 参数
  if (req.query) {
    const safeQuery = {};
    for (const key of Object.keys(req.query)) {
      if (key.length > 100) continue;
      if (key === '__proto__' || key === 'constructor') continue;
      safeQuery[key] = String(req.query[key]).substring(0, 500);
    }
    req.query = safeQuery;
  }

  // 清理 params
  if (req.params) {
    const safeParams = {};
    for (const key of Object.keys(req.params)) {
      if (key.length > 100) continue;
      safeParams[key] = String(req.params[key]).substring(0, 100);
    }
    req.params = safeParams;
  }

  next();
}

module.exports = { paramSanitizeMiddleware, detectInjection, sanitizeBody };
