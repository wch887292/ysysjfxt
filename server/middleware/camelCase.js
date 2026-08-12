// middleware/camelCase.js - 响应 snake_case/camelCase 双写中间件
// 项目规范：API 接口需同时支持 snake_case 和 camelCase 响应
// 此中间件拦截 JSON 响应，对 data 中的 snake_case 键自动追加 camelCase 版本
// 前端可按习惯使用任一命名风格，数据源完全统一

/**
 * snake_case → camelCase 转换
 * 例：nick_name → nickName, created_at → createdAt, is_member → isMember
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 递归遍历对象，为所有 snake_case 键添加 camelCase 副本
 * 原有 snake_case 键保留不动，camelCase 键追加（浅层不覆盖已有）
 */
function addCamelCaseKeys(obj, depth = 0) {
  if (depth > 8) return obj; // 防止循环引用无限递归

  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Buffer.isBuffer(obj) || obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => addCamelCaseKeys(item, depth + 1));
  }

  const result = { ...obj };
  for (const key of Object.keys(obj)) {
    // 仅对包含下划线的键生成 camelCase 版本
    if (key.includes('_')) {
      const camelKey = toCamelCase(key);
      // 不覆盖已存在的 camelCase 键（避免覆盖有意设定的值）
      if (!(camelKey in result)) {
        result[camelKey] = obj[key];
      }
    }
    // 递归处理嵌套对象/数组
    if (typeof obj[key] === 'object' && obj[key] !== null && !(obj[key] instanceof Date)) {
      result[key] = addCamelCaseKeys(obj[key], depth + 1);
    }
  }
  return result;
}

/**
 * Koa/Express 兼容的 camelCase 双写中间件
 * 拦截 res.json() 调用，对响应 data 中的 snake_case 键自动追加 camelCase 版本
 */
function camelCaseMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // 仅处理包含 success + data 字段的标准响应格式
    if (data && typeof data === 'object' && 'data' in data && data.data !== null && data.data !== undefined) {
      data.data = addCamelCaseKeys(data.data);
    }
    return originalJson(data);
  };

  next();
}

module.exports = { camelCaseMiddleware, addCamelCaseKeys, toCamelCase };
