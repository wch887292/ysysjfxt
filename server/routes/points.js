// routes/points.js - 积分路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { getHonorBonusRate } = require('../utils/honor');

/**
 * 获取积分余额
 * GET /api/user/points
 */
router.get('/', async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return fail(res, '用户不存在');
    }

    const ranking = await db.User.count({
      where: { total_points: { [db.Sequelize.Op.gt]: user.total_points } }
    }) + 1;

    return success(res, {
      points: user.points,
      totalPoints: user.total_points,
      ranking
    });
  } catch (err) {
    logger.error('获取积分失败:', err);
    return fail(res, '获取积分失败');
  }
});

/**
 * 获取积分历史
 * GET /api/user/points/history
 */
router.get('/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await db.PointsHistory.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      // attributes 使用数据库列名（raw:true 时返回列名而非 JS 属性名）
      // created_at 会通过 camelCase 中间件自动添加 createdAt 副本
      attributes: ['id', 'type', 'points', 'source', 'description', 'created_at'],
      raw: true
    });

    return success(res, {
      history: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取积分历史失败:', err);
    return fail(res, '获取积分历史失败');
  }
});

/**
 * 生成线下积分核销二维码（规格6.4 步骤1：会员到店出示积分二维码）
 * GET /api/user/points/write-off-qr
 * 返回二维码内容（含userId和当前积分余额），供代理商扫码核销。
 * 二维码内容为明文JSON，代理商端扫码后调用 /api/agent/points/write-off 核销。
 */
router.get('/write-off-qr', async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return fail(res, '用户不存在');
    }

    const qrContent = JSON.stringify({
      userId: user.id,
      points: user.points,
      ts: Date.now()
    });

    return success(res, {
      qrContent,
      points: user.points,
      userId: user.id,
      message: '请前往最近的服务网点，由专业服务商扫码核销'
    });
  } catch (err) {
    logger.error('生成核销二维码失败:', err);
    return fail(res, '生成核销二维码失败');
  }
});

/**
 * 发放积分（内部方法）
 * @param {string} userId - 用户ID
 * @param {number} points - 积分数量
 * @param {string} source - 积分来源
 * @param {string} description - 描述
 * @param {string|null} referenceId - 关联ID
 * @param {Transaction|null} parentTransaction - 父事务（可选）
 */
/**
 * 发放积分（内部方法）
 * @param {Object} options - 配置项
 *   - noBonus: 是否不计算荣誉等级加成（如管理员调整）
 */
async function addPoints(userId, points, source, description, referenceId = null, parentTransaction = null, options = {}) {
  // V10修复：防御性校验，确保points为正整数
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0 || !Number.isInteger(points)) {
    throw new Error(`addPoints参数非法: points=${points}`);
  }
  if (points > 100000) {
    throw new Error('addPoints参数超出合理范围');
  }
  const t = parentTransaction || await db.sequelize.transaction();
  try {
    // 必须加行级排它锁：积分是 read-modify-write 操作，
    // 无锁时并发调用（例如同一推荐人被多个新用户同时绑定发放拉新奖励）
    // 会各自读到相同的旧值，后写覆盖先写，造成积分丢失。
    // 同一事务内对同一行重复加锁是可重入的，故上层已加锁的调用路径不受影响。
    const user = await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('用户不存在');

    // 根据荣誉等级计算积分加成
    const bonusRate = options.noBonus ? 0 : getHonorBonusRate(user.honor_level);
    const finalPoints = bonusRate > 0 ? Math.round(points * (1 + bonusRate)) : points;

    const newPoints = user.points + finalPoints;
    const newTotalPoints = user.total_points + finalPoints;

    // 更新用户积分
    await user.update({
      points: newPoints,
      total_points: newTotalPoints
    }, { transaction: t });

    // 记录积分历史
    await db.PointsHistory.create({
      user_id: userId,
      type: 'earn',
      points: finalPoints,
      source: source,
      description: bonusRate > 0 ? `${description}（含${Math.round(bonusRate * 100)}%等级加成）` : description,
      reference_id: referenceId,
      balance_after: newPoints
    }, { transaction: t });

    if (!parentTransaction) await t.commit();
    return { points: newPoints, totalPoints: newTotalPoints, earned: finalPoints, bonusRate };
  } catch (err) {
    if (!parentTransaction) await t.rollback();
    throw err;
  }
}

/**
 * 消耗积分（内部方法）
 * @param {string} userId - 用户ID
 * @param {number} points - 积分数量
 * @param {string} source - 积分来源
 * @param {string} description - 描述
 * @param {string|null} referenceId - 关联ID
 * @param {Transaction|null} parentTransaction - 父事务（可选）
 */
async function deductPoints(userId, points, source, description, referenceId = null, parentTransaction = null, type = 'spend') {
  // V10修复：防御性校验，确保points为正整数
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0 || !Number.isInteger(points)) {
    throw new Error(`deductPoints参数非法: points=${points}`);
  }
  if (points > 1000000) {
    throw new Error('deductPoints参数超出合理范围');
  }
  const t = parentTransaction || await db.sequelize.transaction();
  try {
    // 必须加行级排它锁：余额校验与扣减之间若无锁，
    // 并发兑换会同时通过 user.points < points 检查，导致超扣、积分变为负数。
    const user = await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('用户不存在');

    if (user.points < points) {
      throw new Error('积分不足');
    }

    const newPoints = user.points - points;

    // 更新用户积分
    await user.update({
      points: newPoints
    }, { transaction: t });

    // 记录积分历史
    await db.PointsHistory.create({
      user_id: userId,
      type,
      points: -points,
      source: source,
      description: description,
      reference_id: referenceId,
      balance_after: newPoints
    }, { transaction: t });

    if (!parentTransaction) await t.commit();
    return { points: newPoints };
  } catch (err) {
    if (!parentTransaction) await t.rollback();
    throw err;
  }
}

module.exports = { router, addPoints, deductPoints };