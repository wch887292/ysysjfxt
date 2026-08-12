// routes/clockIn.js - 每日打卡路由（图标/拍照双模式）
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const contentSecurity = require('../services/contentSecurity');
// aiRecognition.recognizeFood 已合并入 contentSecurity.checkImage 单次调用
// （规格12.3 端到端 < 3s 优化：避免两次串行 API 调用最坏 5.6s 超时）
const ossService = require('../services/oss');
const { getTodayString } = require('../utils/date');
const { recalcHonor } = require('../utils/honor');
const { getSurpriseMessage } = require('../utils/surprise');
const configCache = require('../utils/configCache');

// 兜底默认值（DB 配置缺失时使用，与方案6.1 一致）
const FALLBACK_POINTS_RULES = {
  icon: 10,
  image: 10,
  followPlan: 20
};
const FALLBACK_DAILY_LIMIT = 3;

/**
 * 从 DB 配置读取打卡参数（带缓存，方案6.1 "后台可配"）
 * 缓存失效或 DB 异常时回退到 FALLBACK 默认值，保证服务可用
 * @returns {Promise<{pointsRules: Object, dailyLimit: number}>}
 */
async function getClockInConfig() {
  try {
    const [pointsIcon, pointsImage, pointsFollowPlan, dailyLimit] = await Promise.all([
      configCache.get(db, 'clock_in.points_icon'),
      configCache.get(db, 'clock_in.points_image'),
      configCache.get(db, 'clock_in.points_follow_plan'),
      configCache.get(db, 'clock_in.daily_limit')
    ]);
    return {
      pointsRules: {
        icon: typeof pointsIcon === 'number' ? pointsIcon : FALLBACK_POINTS_RULES.icon,
        image: typeof pointsImage === 'number' ? pointsImage : FALLBACK_POINTS_RULES.image,
        followPlan: typeof pointsFollowPlan === 'number' ? pointsFollowPlan : FALLBACK_POINTS_RULES.followPlan
      },
      dailyLimit: typeof dailyLimit === 'number' ? dailyLimit : FALLBACK_DAILY_LIMIT
    };
  } catch (err) {
    logger.warn('读取打卡配置失败，使用默认值:', err.message);
    return { pointsRules: FALLBACK_POINTS_RULES, dailyLimit: FALLBACK_DAILY_LIMIT };
  }
}

// V5修复：mealType白名单
const ALLOWED_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// V6修复：mimetype严格校验
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif']);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'meals'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${safeExt}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB（手机拍照压缩后足够，避免 base64 过大导致 AI API 超时）
  fileFilter: (req, file, cb) => {
    // V6修复：严格匹配，防止 mimetype 绕过
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

// 积分规则与每日上限已迁移至 DB 配置（getClockInConfig 读取），方案6.1 "后台可配"

/**
 * 图标打卡
 * POST /api/clock-in/icon
 */
router.post('/icon', async (req, res) => {
  try {
    const userId = req.user.id;
    // 规格9.2 tolerant reader：同时接受 snake_case 和 camelCase
    const mealType = req.body.meal_type || req.body.mealType;
    const foodIcons = req.body.food_icons || req.body.foodIcons;
    const followPlan = req.body.follow_plan !== undefined ? req.body.follow_plan : req.body.followPlan;

    // V5修复：校验mealType为合法ENUM值
    if (!mealType || !ALLOWED_MEAL_TYPES.includes(mealType)) {
      return fail(res, '无效的餐食类型');
    }
    if (!foodIcons || !Array.isArray(foodIcons) || foodIcons.length === 0) {
      return fail(res, '请选择至少一个食物图标');
    }
    if (foodIcons.length > 9) {
      return fail(res, '最多选择9个食物图标');
    }
    // V额外：校验foodIcons元素为安全字符串
    const ALLOWED_ICON_KEYS = new Set(['vegetable', 'fruit', 'water', 'grain', 'meat', 'fish', 'milk', 'egg', 'other']);
    for (const icon of foodIcons) {
      if (typeof icon !== 'string' || icon.length > 20 || !ALLOWED_ICON_KEYS.has(icon)) {
        return fail(res, '食物图标不合法');
      }
    }

    const today = getTodayString();

    // 方案6.1：积分值与每日上限从 DB 配置读取（getClockInConfig）
    const { pointsRules, dailyLimit } = await getClockInConfig();
    // 计算积分（图标打卡基础分 + 遵循饮食计划奖励）
    let points = pointsRules.icon;
    if (followPlan) points += pointsRules.followPlan;

    // 创建打卡记录并发放积分（事务）
    // 防重检查必须在事务内执行，防止并发请求绕过每日上限和同餐次重复
    const t = await db.sequelize.transaction();
    try {
      // 对用户行加锁，串行化同一用户的并发打卡请求
      await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      // 检查今日该餐次是否已打卡（事务内）
      const existing = await db.ClockInRecord.findOne({
        where: { user_id: userId, clock_in_date: today, meal_type: mealType },
        transaction: t
      });
      if (existing) {
        await t.rollback();
        return fail(res, '该餐次今日已打卡');
      }

      // 方案6.1：每日打卡次数上限（事务内计数，防止并发超限）
      const todayCount = await db.ClockInRecord.count({
        where: { user_id: userId, clock_in_date: today },
        transaction: t
      });
      if (todayCount >= dailyLimit) {
        await t.rollback();
        return fail(res, `今日打卡次数已达上限（每日最多${dailyLimit}次）`);
      }

      const record = await db.ClockInRecord.create({
        user_id: userId,
        meal_type: mealType,
        clock_in_type: 'icon',
        food_icons: foodIcons,
        follow_plan: followPlan || false,
        points_earned: points,
        clock_in_date: today,
        clock_in_time: new Date()
      }, { transaction: t });

      const pointsResult = await addPoints(
        userId,
        points,
        'clock_in_icon',
        `图标打卡${getMealTypeText(mealType)}获得积分`,
        record.id,
        t
      );

      // 重新计算荣誉等级与勋章
      const user = await db.User.findByPk(userId, { transaction: t });
      await recalcHonor(user, db, t);

      await t.commit();

      logger.info(`图标打卡成功: 用户${userId}, 积分${points}`);

      // P2-28: 惊喜消息只计算一次，避免两个字段返回不同的随机消息
      const surprise = getSurpriseMessage(pointsResult.earned);

      return success(res, {
        record: {
          id: record.id,
          mealType: record.meal_type,
          foodIcons: record.food_icons,
          pointsEarned: record.points_earned,
          clockInTime: record.clock_in_time
        },
        pointsEarned: pointsResult.earned,
        basePoints: points,
        bonusRate: pointsResult.bonusRate,
        totalPoints: pointsResult.points,
        surpriseMessage: surprise,
        // 规格9.2 snake_case 字段
        points_earned: pointsResult.earned,
        total_points: pointsResult.points,
        surprise_message: surprise
      }, '打卡成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }

  } catch (err) {
    logger.error('图标打卡失败:', err);
    return serverError(res);
  }
});

/**
 * 图片打卡
 * POST /api/clock-in/image
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    const userId = req.user.id;
    // 规格9.2 tolerant reader：同时接受 snake_case 和 camelCase
    const mealType = req.body.meal_type || req.body.mealType;

    // P2-10: 必须显式选择餐食类型，禁止静默默认为lunch
    if (!mealType || !ALLOWED_MEAL_TYPES.includes(mealType)) {
      return fail(res, '请选择餐食类型');
    }

    if (!req.file) {
      return fail(res, '请上传图片');
    }

    const today = getTodayString();

    // 规格12.3 验证流程：内容安全检测（含食物识别）→ 通过后才上传 OSS
    // （旧版先上传 OSS 再验证，导致违规图片被持久化到 OSS 且未清理）
    //
    // 性能优化（规格12.3 端到端 < 3s）：
    //   原实现 contentSecurity.checkImage + aiRecognition.recognizeFood 串行最坏 5.6s 超 3s。
    //   现合并为单次 API 调用（违规检测 + 食物详细识别合一），securityResult.aiResult
    //   即包含原 recognizeFood 返回的 foodType/foodCategory/healthScore/description，
    //   端到端 < 2.8s 满足规格。

    // 步骤1+2: 内容安全验证 + AI食物识别（单次调用合并完成）
    const securityResult = await contentSecurity.checkImage(req.file.path);
    if (!securityResult.pass) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return fail(res, securityResult.message || '图片内容不合规');
    }

    // 规格12.3：校验 AI 识别结果为食物（contentSecurity 已做食物识别，此处为防御性二次校验）
    const aiResult = securityResult.aiResult;
    if (!aiResult || aiResult.foodType === '非食物') {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return fail(res, '请上传饮食相关图片');
    }

    // 步骤3: 验证通过后上传 OSS（规格12.3：验证在前，上传在后）
    const objectKey = `meals/${userId}/${Date.now()}-${req.file.originalname}`;
    const ossResult = await ossService.uploadFile(req.file.path, objectKey);
    const imageUrl = ossResult.url || `/uploads/meals/${req.file.filename}`;

    const followPlan = req.body.followPlan === 'true' || req.body.followPlan === true;

    // 步骤4: 方案6.1：积分值与每日上限从 DB 配置读取（getClockInConfig）
    const { pointsRules, dailyLimit } = await getClockInConfig();
    let points = pointsRules.image;
    let source = 'clock_in_image';
    if (followPlan) points += pointsRules.followPlan;

    // 步骤4-5: 创建打卡记录并发放积分
    // 防重检查必须在事务内执行，防止并发请求绕过每日上限和同餐次重复
    const t = await db.sequelize.transaction();
    try {
      // 对用户行加锁，串行化同一用户的并发打卡请求
      await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      // 检查今日该餐次是否已打卡（事务内）
      const existing = await db.ClockInRecord.findOne({
        where: { user_id: userId, clock_in_date: today, meal_type: mealType },
        transaction: t
      });
      if (existing) {
        await t.rollback();
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return fail(res, '该餐次今日已打卡');
      }

      // 方案6.1：每日打卡次数上限（事务内计数，防止并发超限）
      const todayCount = await db.ClockInRecord.count({
        where: { user_id: userId, clock_in_date: today },
        transaction: t
      });
      if (todayCount >= dailyLimit) {
        await t.rollback();
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return fail(res, `今日打卡次数已达上限（每日最多${dailyLimit}次）`);
      }

      const record = await db.ClockInRecord.create({
        user_id: userId,
        meal_type: mealType,
        clock_in_type: 'image',
        image_url: imageUrl,
        image_verified: true,
        ai_food_type: aiResult.foodType,
        ai_health_score: aiResult.healthScore,
        ai_description: aiResult.description,
        follow_plan: followPlan,
        points_earned: points,
        clock_in_date: today,
        clock_in_time: new Date()
      }, { transaction: t });

      const pointsResult = await addPoints(
        userId,
        points,
        source,
        `图片打卡${getMealTypeText(mealType)}获得积分`,
        record.id,
        t
      );

      // 重新计算荣誉等级与勋章
      const user = await db.User.findByPk(userId, { transaction: t });
      await recalcHonor(user, db, t);

      await t.commit();

      logger.info(`图片打卡成功: 用户${userId}, 积分${points}`);

      return success(res, {
        record: {
          id: record.id,
          mealType: record.meal_type,
          imageUrl: record.image_url,
          pointsEarned: record.points_earned,
          clockInTime: record.clock_in_time
        },
        aiResult: {
          foodType: aiResult.foodType,
          foodCategory: aiResult.foodCategory,
          healthScore: aiResult.healthScore,
          points: points
        },
        imageValid: true,
        pointsEarned: pointsResult.earned,
        basePoints: points,
        bonusRate: pointsResult.bonusRate,
        totalPoints: pointsResult.points,
        surpriseMessage: getSurpriseMessage(pointsResult.earned),
        // 规格9.2 snake_case 字段
        image_valid: true,
        points_earned: pointsResult.earned,
        total_points: pointsResult.points
      }, '打卡成功');
    } catch (err) {
      await t.rollback();
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      // P1-10: 事务失败后清理已上传的OSS对象，防止孤儿资源
      if (ossResult && ossResult.url) {
        try {
          await ossService.deleteFile(objectKey);
        } catch (e) {
          logger.error('OSS清理失败:', e.message);
        }
      }
      throw err;
    }

  } catch (err) {
    logger.error('图片打卡失败:', err);
    if (err.message === '只支持 JPG、PNG、GIF 格式的图片') {
      return fail(res, err.message);
    }
    return serverError(res);
  }
});

/**
 * 获取今日打卡记录
 * GET /api/clock-in/today
 */
router.get('/today', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayString();

    const records = await db.ClockInRecord.findAll({
      where: { user_id: userId, clock_in_date: today },
      order: [['clock_in_time', 'ASC']]
    });

    const totalPoints = records.reduce((sum, r) => sum + r.points_earned, 0);

    return success(res, {
      records,
      totalPointsToday: totalPoints,
      hasBreakfast: records.some(r => r.meal_type === 'breakfast'),
      hasLunch: records.some(r => r.meal_type === 'lunch'),
      hasDinner: records.some(r => r.meal_type === 'dinner')
    });
  } catch (err) {
    logger.error('获取今日打卡记录失败:', err);
    return serverError(res);
  }
});

/**
 * 获取打卡历史
 * GET /api/clock-in/history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, pageSize, offset } = parsePagination(req.query);

    const { count, rows } = await db.ClockInRecord.findAndCountAll({
      where: { user_id: userId },
      order: [['clock_in_date', 'DESC'], ['clock_in_time', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      records: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取打卡历史失败:', err);
    return serverError(res);
  }
});

function getMealTypeText(mealType) {
  const map = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  return map[mealType] || '餐食';
}

module.exports = router;
