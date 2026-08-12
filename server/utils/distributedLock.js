// utils/distributedLock.js - 基于 MySQL GET_LOCK 的分布式锁
//
// 解决多实例部署下 node-schedule 进程内调度重复触发的问题：
//   - 集群内每个实例都会在凌晨2点触发 checkInactiveUsers
//   - 通过 MySQL GET_LOCK 互斥，确保同一时刻只有一个实例执行
//   - 其他实例获取锁失败后直接跳过，不重复执行
//
// MySQL GET_LOCK 特性：
//   1. 同名锁在所有连接中互斥
//   2. 连接断开时自动释放（避免实例崩溃导致死锁）
//   3. timeout=0 表示不等待，立即返回
//   4. 返回 1=成功, 0=超时, NULL=错误
//
// ⚠️ 关键约束：GET_LOCK / RELEASE_LOCK 是**会话（连接）级**的。
//    Sequelize 每次 query 都会从连接池中取任意一条连接，
//    若 acquire 与 release 落在不同连接上，RELEASE_LOCK 只会返回 0，锁不会被释放，
//    该连接归还池中后锁持续被持有，后续所有实例 acquire 均失败 → 定时任务被静默跳过。
//    因此这里用一个"持锁事务"把整个加锁-执行-解锁过程绑定在同一条连接上。
//
// 使用方式（推荐）：
//   const lock = require('./utils/distributedLock');
//   const { executed, result } = await lock.withLock('job:xxx', async () => { ... });
//
// 低阶用法（需自行保证配对释放）：
//   const handle = await lock.acquire('job:xxx', 0);
//   if (!handle) return;
//   try { ... } finally { await lock.release(handle); }

const logger = require('./logger');
const db = require('../models');

/**
 * 解析 GET_LOCK / RELEASE_LOCK 的返回值
 * 不同驱动/版本可能返回 number、string 或 BigInt，统一用 Number 归一化
 */
function toLockResult(rows) {
  if (!rows || !rows[0]) return null;
  const row = rows[0];
  const raw = row.acquired !== undefined ? row.acquired : row.released;
  if (raw === null || raw === undefined) return null;
  return Number(raw);
}

/**
 * 获取分布式锁
 * @param {string} lockName - 锁名（建议用 'job:xxx' 前缀）
 * @param {number} timeoutSeconds - 等待超时秒数：0=不等待，-1=无限等待，>0=等待N秒
 * @returns {Promise<Object|null>} 成功返回锁句柄（须传给 release），失败返回 null
 */
async function acquire(lockName, timeoutSeconds = 0) {
  let holdTx;
  try {
    // 开启一个仅用于"占住同一条连接"的事务。
    // GET_LOCK 不受事务回滚影响，commit/rollback 也不会释放它，
    // 这里借用事务只是为了让后续 RELEASE_LOCK 命中同一条连接。
    holdTx = await db.sequelize.transaction();

    const [rows] = await db.sequelize.query(
      'SELECT GET_LOCK(?, ?) AS acquired',
      { replacements: [lockName, timeoutSeconds], transaction: holdTx }
    );

    if (toLockResult(rows) === 1) {
      logger.info(`分布式锁获取成功: ${lockName}`);
      return { lockName, transaction: holdTx };
    }

    // 未拿到锁，立即归还连接
    await holdTx.commit();
    return null;
  } catch (err) {
    logger.error(`分布式锁获取失败: ${lockName},`, err.message);
    if (holdTx) {
      try { await holdTx.commit(); } catch (_) { /* 连接可能已断开，忽略 */ }
    }
    return null;
  }
}

/**
 * 释放分布式锁
 * @param {Object|string} handle - acquire 返回的锁句柄（传字符串为兼容旧调用，不保证释放成功）
 */
async function release(handle) {
  if (!handle) return;

  // 兼容旧签名 release('job:xxx')：无连接绑定，只能尽力而为
  if (typeof handle === 'string') {
    logger.warn(
      `分布式锁 release 收到字符串锁名（${handle}）：` +
      '未绑定连接，RELEASE_LOCK 可能落在其他连接上而失效，请改用 acquire 返回的句柄'
    );
    try {
      await db.sequelize.query('SELECT RELEASE_LOCK(?) AS released', { replacements: [handle] });
    } catch (err) {
      logger.warn(`分布式锁释放失败: ${handle},`, err.message);
    }
    return;
  }

  const { lockName, transaction } = handle;
  try {
    const [rows] = await db.sequelize.query(
      'SELECT RELEASE_LOCK(?) AS released',
      { replacements: [lockName], transaction }
    );
    const released = toLockResult(rows);
    if (released === 1) {
      logger.info(`分布式锁已释放: ${lockName}`);
    } else {
      // 0 = 锁被其他会话持有；null = 锁不存在。两者都说明状态异常，需要告警而非静默。
      logger.error(
        `分布式锁释放异常: ${lockName}, RELEASE_LOCK 返回 ${released}。` +
        '锁可能未被正确释放，将依赖连接关闭自动回收'
      );
    }
  } catch (err) {
    // 释放失败不阻塞业务（连接断开会自动释放）
    logger.warn(`分布式锁释放失败: ${lockName},`, err.message);
  } finally {
    // 必须归还持锁连接，否则连接池会被逐步耗尽
    try {
      await transaction.commit();
    } catch (err) {
      logger.warn(`分布式锁持锁事务提交失败: ${lockName},`, err.message);
    }
  }
}

/**
 * 包装器：获取锁后执行 fn，执行完自动释放
 * @param {string} lockName - 锁名
 * @param {Function} fn - 异步函数
 * @param {number} timeoutSeconds - 等待超时秒数
 * @returns {Promise<{executed: boolean, result?: any}>} executed=false 表示未获取到锁
 */
async function withLock(lockName, fn, timeoutSeconds = 0) {
  const handle = await acquire(lockName, timeoutSeconds);
  if (!handle) {
    logger.info(`分布式锁已被其他实例占用，跳过执行: ${lockName}`);
    return { executed: false };
  }
  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    await release(handle);
  }
}

module.exports = {
  acquire,
  release,
  withLock
};
