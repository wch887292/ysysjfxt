// routes/signIn.js - 每日签到路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const { getTodayString, formatLocalDate } = require('../utils/date');
const { getSurpriseMessage } = require('../utils/surprise');
const configCache = require('../utils/configCache');

// 兜底默认值（DB 配置缺失时使用，与方案6.1 一致）
const FALLBACK_BASE_POINTS = 5;
const FALLBACK_MILESTONES = { 7: 10, 30: 30, 100: 100 };

/**
 * 获取昨天日期字符串
 */
function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/**
 * 从 DB 配置读取签到参数（带缓存，方案6.1 "后台可配"）
 * 缓存失效或 DB 异常时回退到 FALLBACK 默认值，保证服务可用
 * @returns {Promise<{basePoints: number, milestones: Object}>}
 */
async function getSignInConfig() {
  try {
    const [basePoints, milestones] = await Promise.all([
      configCache.get(db, 'sign_in.base_points'),
      configCache.get(db, 'sign_in.milestones')
    ]);
    return {
      basePoints: typeof basePoints === 'number' ? basePoints : FALLBACK_BASE_POINTS,
      milestones: milestones && typeof milestones === 'object' ? milestones : FALLBACK_MILESTONES
    };
  } catch (err) {
    logger.warn('读取签到配置失败，使用默认值:', err.message);
    return { basePoints: FALLBACK_BASE_POINTS, milestones: FALLBACK_MILESTONES };
  }
}

/**
 * 计算连续签到里程碑奖励
 */
function getMilestoneBonus(milestones, consecutiveDays) {
  return milestones[consecutiveDays] || 0;
}

/**
 * 每日签到
 * POST /api/user/sign-in
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayString();

    // P1-8: 事务内执行今日签到检查与昨日记录查询，并对用户行加锁，防止并发签到竞态
    const t = await db.sequelize.transaction();
    try {
      // 对用户行加锁，串行化同一用户的并发签到请求
      await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      // 检查今日是否已签到（事务内）
      const existing = await db.SignInRecord.findOne({
        where: { user_id: userId, sign_in_date: today },
        transaction: t
      });
      if (existing) {
        await t.rollback();
        return fail(res, '今日已签到');
      }

      // 查询上次签到记录，计算连续天数（事务内）
      const lastRecord = await db.SignInRecord.findOne({
        where: { user_id: userId },
        order: [['sign_in_date', 'DESC']],
        transaction: t
      });

      let consecutiveDays = 1;
      if (lastRecord && lastRecord.sign_in_date === getYesterdayString()) {
        consecutiveDays = lastRecord.consecutive_days + 1;
      }

      // 方案6.1：从 DB 配置读取签到基础积分和里程碑奖励（后台可配）
      const { basePoints, milestones } = await getSignInConfig();
      const milestoneBonus = getMilestoneBonus(milestones, consecutiveDays);
      const totalBasePoints = basePoints + milestoneBonus;

      const record = await db.SignInRecord.create({
        user_id: userId,
        sign_in_date: today,
        points_earned: totalBasePoints,
        consecutive_days: consecutiveDays
      }, { transaction: t });

      const pointsResult = await addPoints(
        userId,
        totalBasePoints,
        'sign_in',
        milestoneBonus > 0
          ? `每日签到，连续${consecutiveDays}天`
          : '每日签到',
        record.id,
        t
      );

      await db.User.update(
        { last_active_at: new Date() },
        { where: { id: userId }, transaction: t }
      );

      await t.commit();

      logger.info(`每日签到成功: 用户${userId}, 积分${pointsResult.earned}, 连续${consecutiveDays}天`);

      return success(res, {
        pointsEarned: pointsResult.earned,
        basePoints: totalBasePoints,
        bonusRate: pointsResult.bonusRate,
        consecutiveDays,
        milestoneBonus,
        totalPoints: pointsResult.points,
        surpriseMessage: getSurpriseMessage(pointsResult.earned)
      }, '签到成功');
    } catch (err) {
      await t.rollback();
      // 并发签到唯一约束冲突
      if (err.name === 'SequelizeUniqueConstraintError') {
        return fail(res, '今日已签到');
      }
      throw err;
    }
  } catch (err) {
    logger.error('每日签到失败:', err);
    return serverError(res);
  }
});

/**
 * 获取签到记录
 * GET /api/user/sign-in/history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await db.SignInRecord.findAndCountAll({
      where: { user_id: userId },
      order: [['sign_in_date', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      records: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取签到记录失败:', err);
    return serverError(res);
  }
});

module.exports = router;
