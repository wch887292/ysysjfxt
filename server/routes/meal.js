// routes/meal.js - 餐饮上传路由
//
// 注意：本文件的 POST /meals/upload 接口已废弃，统一使用 /api/clock-in/image
// 积分规则以 routes/clockIn.js 的 POINTS_RULES 为准（基础10分 + follow_plan +20）
// /meals/list 和 /meals/:id 仅保留用于历史数据展示
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const contentSecurity = require('../services/contentSecurity');
const aiRecognition = require('../services/aiRecognition');

// V5修复：mealType白名单
const ALLOWED_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// V6修复：mimetype严格校验（锚定正则）
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif']);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'meals'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // V6修复：仅使用白名单扩展名，丢弃其他字符
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${safeExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // V6修复：使用严格匹配，防止 image/jpeg; malicious 绕过
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF 格式的图片'));
    }
  }
});

/**
 * 规范化分页参数
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// 积分规则配置
const POINTS_RULES = {
  healthyMeal: 10,
  vegetable: 5,
  fruit: 3,
  water: 2,
  questionnaire: 20
};

// 确保上传目录存在
const uploadDir = path.join(__dirname, '..', 'uploads', 'meals');
require('fs').mkdirSync(uploadDir, { recursive: true });

/**
 * 上传餐食图片（已废弃）
 * POST /api/meals/upload
 * @deprecated 该接口已废弃，请使用 POST /api/clock-in/image
 *             积分规则以 routes/clockIn.js 的 POINTS_RULES 为准（基础10分 + follow_plan +20）
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  // 接口已废弃，统一走 /api/clock-in/image
  // 若已上传文件，清理临时文件后返回废弃提示
  if (req.file) {
    const fs = require('fs');
    if (fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* 忽略清理失败 */ }
    }
  }
  return fail(res, '该接口已废弃，请使用 POST /api/clock-in/image', 410);
});

/**
 * 获取餐食列表
 * GET /api/meals/list
 */
router.get('/list', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const { count, rows } = await db.Meal.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['upload_time', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      meals: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取餐食列表失败:', err);
    return fail(res, '获取列表失败');
  }
});

/**
 * 删除餐食
 * DELETE /api/meals/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const meal = await db.Meal.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!meal) {
      return fail(res, '餐食记录不存在');
    }

    await meal.destroy();
    return success(res, null, '删除成功');
  } catch (err) {
    logger.error('删除餐食失败:', err);
    return fail(res, '删除失败');
  }
});

module.exports = router;