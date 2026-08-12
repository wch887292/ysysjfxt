// middleware/validate.js - 参数验证中间件
const { validationResult } = require('express-validator');
const { paramError } = require('../utils/response');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return paramError(res, errors.array());
  }
  next();
}

module.exports = { validate };