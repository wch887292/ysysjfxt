// utils/response.js - 统一响应格式

/**
 * 递归将 Sequelize Model 实例转为纯 JSON 对象
 * 解决 res.json() 序列化 Model 实例时产出 {dataValues: {id:...}} 嵌套结构，
 * 导致前端 WXML 用 {{item.points}} 取值恒为 undefined 的问题
 */
function sanitize(data, depth = 0) {
  if (depth > 10 || data === null || data === undefined) return data;

  // Date 对象交给 JSON.stringify 序列化为 ISO 字符串
  if (data instanceof Date) return data;

  // Sequelize Model 实例：有 dataValues 属性和 toJSON 方法
  if (data && typeof data.toJSON === 'function' && data.dataValues !== undefined) {
    return sanitize(data.toJSON(), depth + 1);
  }

  // 数组
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item, depth + 1));
  }

  // 普通对象（排除 Date 等特殊对象）
  if (typeof data === 'object' && !(data instanceof Date) && !(Buffer.isBuffer(data))) {
    const result = {};
    for (const key of Object.keys(data)) {
      result[key] = sanitize(data[key], depth + 1);
    }
    return result;
  }

  return data;
}

/**
 * 成功响应
 */
function success(res, data = null, message = '操作成功') {
  return res.json({
    success: true,
    message,
    data: sanitize(data)
  });
}

/**
 * 失败响应
 */
function fail(res, message = '操作失败', code = 400) {
  return res.status(code).json({
    success: false,
    message,
    data: null
  });
}

/**
 * 参数错误响应
 */
function paramError(res, errors) {
  const messages = errors.map(err => err.msg).join('; ');
  return res.status(400).json({
    success: false,
    message: `参数错误: ${messages}`,
    data: null
  });
}

/**
 * 未授权响应
 */
function unauthorized(res, message = '未授权,请先登录') {
  return res.status(401).json({
    success: false,
    message,
    code: 'UNAUTHORIZED',
    data: null
  });
}

/**
 * 权限不足响应
 */
function forbidden(res, message = '权限不足') {
  return res.status(403).json({
    success: false,
    message,
    code: 'FORBIDDEN',
    data: null
  });
}

/**
 * 服务器错误响应
 */
function serverError(res, message = '服务器内部错误') {
  return res.status(500).json({
    success: false,
    message,
    code: 'SERVER_ERROR',
    data: null
  });
}

module.exports = {
  success,
  fail,
  paramError,
  unauthorized,
  forbidden,
  serverError
};