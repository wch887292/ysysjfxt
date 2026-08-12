// routes/gift.js - 礼品兑换路由
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { deductPoints } = require('./points');

/**
 * 获取礼品列表
 * GET /api/gifts/list
 */
async function getGiftList(req, res) {
  try {
    const gifts = await db.Gift.findAll({
      where: { status: 'active' },
      order: [['points', 'ASC']],
      // raw: true 返回纯 JS 对象，避免 res.json() 序列化 Model 实例产出 dataValues 嵌套
      raw: true
    });

    // 为没有图片的礼品设置默认图片
    const DEFAULT_IMAGE = '/static/images/gifts/default.jpg';
    gifts.forEach(g => {
      if (!g.image) {
        g.image = DEFAULT_IMAGE;
      }
    });

    return success(res, { gifts });
  } catch (err) {
    logger.error('获取礼品列表失败:', err);
    return fail(res, '获取礼品列表失败');
  }
}

router.get('/list', getGiftList);

/**
 * 兑换礼品
 * POST /api/gifts/exchange
 */
router.post('/exchange', async (req, res) => {
  try {
    const { giftId, idempotencyKey } = req.body;
    const userId = req.user.id;

    if (!giftId) {
      return fail(res, '缺少礼品ID');
    }

    // 幂等键校验（必传，防止双击/网络重试导致的双扣和超卖）
    // 与 agent/points/write-off 同款模式：前端按(user,gift)维度生成稳定幂等键
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return fail(res, '幂等键不合法');
    }

    const t = await db.sequelize.transaction();

    try {
      const gift = await db.Gift.findByPk(giftId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!gift) {
        await t.rollback();
        return fail(res, '礼品不存在');
      }

      if (gift.status !== 'active') {
        await t.rollback();
        return fail(res, '礼品不可兑换');
      }

      // 检查库存
      if (gift.stock !== -1 && gift.stock <= 0) {
        await t.rollback();
        return fail(res, '礼品已兑换完');
      }

      // 检查日期范围
      if (gift.start_date && new Date() < new Date(gift.start_date)) {
        await t.rollback();
        return fail(res, '礼品兑换尚未开始');
      }
      if (gift.end_date && new Date() > new Date(gift.end_date)) {
        await t.rollback();
        return fail(res, '礼品兑换已结束');
      }

      // 检查积分
      const user = await db.User.findByPk(userId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      // 用户可能已被删除/注销，缺少判空会在下一行抛 TypeError 变成 500
      if (!user) {
        await t.rollback();
        return fail(res, '用户不存在或已注销');
      }
      if (user.points < gift.points) {
        await t.rollback();
        return fail(res, '积分不足');
      }

      // P1修复：混合支付校验（方案3.4 线上商城积分+现金）
      // cash_price > 0 的礼品需要先完成微信支付，再凭 paymentOrderId 兑换
      // 当前未接入微信支付商户号，明确拒绝并提示到店兑换，避免静默扣积分
      if (gift.cash_price && gift.cash_price > 0) {
        const paymentOrderId = req.body.paymentOrderId || req.body.payment_order_id;
        if (!paymentOrderId) {
          await t.rollback();
          return fail(res, '该礼品需支付现金部分，请先完成微信支付或到店兑换');
        }
        // TODO: 微信支付商户号配置后，此处校验 paymentOrderId 真实性并记录 cash_paid
        // 当前仅接收参数，实际支付校验需接入微信支付回调
      }

      // 幂等校验——同一幂等键已兑换过则直接返回原记录，避免重复扣分
      // 必须在加锁后执行，才能看到已提交的其他事务记录
      const existed = await db.GiftExchange.findOne({
        where: { idempotency_key: idempotencyKey },
        transaction: t
      });
      if (existed) {
        await t.rollback();
        return success(res, {
          exchange: {
            id: existed.id,
            giftName: gift.name,
            points: existed.points,
            writeOffCode: existed.write_off_code,
            status: existed.status,
            createdAt: existed.created_at
          },
          duplicated: true
        }, '兑换成功（幂等返回）');
      }

      // 生成核销码（使用 crypto.randomUUID 替代 Math.random，避免碰撞风险）
      const writeOffCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();

      // 扣除积分
      await deductPoints(
        userId,
        gift.points,
        'gift_exchange',
        `兑换礼品: ${gift.name}`,
        giftId,
        t
      );

      // 创建兑换记录（写入幂等键，唯一索引兜底并发重复提交）
      // 状态机修复：新建兑换记录应为 'pending'（待核销），代理商扫码核销后才置 'completed'
      // 原代码直接置 'completed' 会导致用户刚兑换、尚未到店核销的订单在历史里显示"已核销"，
      // 且 write_off_date 为 null，语义矛盾
      const exchange = await db.GiftExchange.create({
        user_id: userId,
        gift_id: giftId,
        points: gift.points,
        cash_paid: gift.cash_price || 0,
        payment_order_id: req.body.paymentOrderId || req.body.payment_order_id || null,
        status: 'pending',
        write_off_code: writeOffCode,
        idempotency_key: idempotencyKey
      }, { transaction: t });

      // 更新用户最后活跃时间
      await db.User.update(
        { last_active_at: new Date() },
        { where: { id: userId }, transaction: t }
      );

      // 更新礼品库存和销量（合并为一次更新）
      const updateData = { sold_count: gift.sold_count + 1 };
      if (gift.stock !== -1) {
        updateData.stock = gift.stock - 1;
        if (updateData.stock <= 0) {
          updateData.status = 'sold_out';
        }
      }
      await gift.update(updateData, { transaction: t });

      await t.commit();

      logger.info(`礼品兑换成功: 用户${userId}, 礼品${giftId}, 积分${gift.points}`);

      return success(res, {
        exchange: {
          id: exchange.id,
          giftName: gift.name,
          points: gift.points,
          writeOffCode: writeOffCode,
          status: exchange.status,
          createdAt: exchange.created_at
        }
      }, '兑换成功');

    } catch (err) {
      await t.rollback();
      // 并发重复提交触发唯一索引冲突时，回查已有记录幂等返回
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        try {
          const existed = await db.GiftExchange.findOne({ where: { idempotency_key: idempotencyKey } });
          if (existed) {
            return success(res, {
              exchange: {
                id: existed.id,
                giftName: existed.gift_id ? (await db.Gift.findByPk(existed.gift_id))?.name : undefined,
                points: existed.points,
                writeOffCode: existed.write_off_code,
                status: existed.status,
                createdAt: existed.created_at
              },
              duplicated: true
            }, '兑换成功（幂等返回）');
          }
        } catch (_) { /* 回查失败则按原错误抛出 */ }
      }
      throw err;
    }

  } catch (err) {
    if (err.message === '积分不足') {
      return fail(res, '积分不足');
    }
    logger.error('礼品兑换失败:', err);
    return serverError(res);
  }
});

/**
 * 获取兑换历史
 * GET /api/gifts/history
 */
router.get('/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await db.GiftExchange.findAndCountAll({
      where: { user_id: req.user.id },
      include: [{ model: db.Gift, as: 'gift', attributes: ['name', 'image'] }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      exchanges: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取兑换历史失败:', err);
    return fail(res, '获取兑换历史失败');
  }
});

module.exports = router;
module.exports.getGiftList = getGiftList;