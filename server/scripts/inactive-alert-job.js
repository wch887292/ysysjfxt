// scripts/inactive-alert-job.js - 流失预警定时任务
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// 业务时区安全网：cron 与"满N天"边界依赖此时区
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}
const schedule = require('node-schedule');
const db = require('../models');
const logger = require('../utils/logger');
const distributedLock = require('../utils/distributedLock');
const dateUtils = require('../utils/date');

const INACTIVE_DAYS = 3;

// 分布式锁名（多实例部署下确保只有一个实例执行）
const LOCK_NAME = 'job:inactive_alert';

/**
 * 检查用户今天是否已经生成过流失预警
 * "今日"边界按业务时区（Asia/Shanghai）0点计算，不依赖服务器本地时区
 */
async function hasAlertedToday(userId, alertType) {
  const todayStart = dateUtils.getBusinessDayStart();

  const count = await db.InactiveAlert.count({
    where: {
      user_id: userId,
      alert_type: alertType,
      created_at: { [db.Sequelize.Op.gte]: todayStart }
    }
  });

  return count > 0;
}

/**
 * 通知代理商
 */
async function notifyAgent(user, transaction, daysInactive = INACTIVE_DAYS) {
  if (!user.agent_id) return;

  const alreadyAlerted = await hasAlertedToday(user.id, 'agent_notified');
  if (alreadyAlerted) return;

  await db.InactiveAlert.create({
    user_id: user.id,
    agent_id: user.agent_id,
    service_provider_id: user.service_provider_id || null,
    days_inactive: daysInactive,
    alert_type: 'agent_notified',
    notified_at: new Date()
  }, { transaction });

  logger.info(`流失预警已通知代理商: 用户${user.id}, 代理商${user.agent_id}`);
}

/**
 * 通知服务商
 */
async function notifyServiceProvider(user, transaction, daysInactive = INACTIVE_DAYS) {
  if (!user.service_provider_id) return;

  const alreadyAlerted = await hasAlertedToday(user.id, 'provider_notified');
  if (alreadyAlerted) return;

  await db.InactiveAlert.create({
    user_id: user.id,
    agent_id: user.agent_id || null,
    service_provider_id: user.service_provider_id,
    days_inactive: daysInactive,
    alert_type: 'provider_notified',
    notified_at: new Date()
  }, { transaction });

  logger.info(`流失预警已通知服务商: 用户${user.id}, 服务商${user.service_provider_id}`);
}

/**
 * 检测3天无活跃会员（核心逻辑，不加锁）
 * 多实例部署下由 withLock 保证只有一个实例执行
 */
async function doCheckInactiveUsers() {
  logger.info('开始执行流失预警检测...');

  // "满3天"边界按业务时区（北京）0点计算，不依赖服务器本地时区
  const threeDaysAgo = dateUtils.getBusinessDaysAgo(INACTIVE_DAYS);

  // 查询3天无活跃的会员
  const inactiveUsers = await db.User.findAll({
    where: {
      is_member: true,
      status: 'active',
      last_active_at: { [db.Sequelize.Op.lt]: threeDaysAgo }
    },
    attributes: ['id', 'nick_name', 'agent_id', 'service_provider_id', 'last_active_at']
  });

  logger.info(`发现 ${inactiveUsers.length} 位3天未活跃会员`);

  for (const user of inactiveUsers) {
    const t = await db.sequelize.transaction();
    try {
      // 真实流失天数：基于时间戳差值计算（纯毫秒运算，与时区无关）
      const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : null;
      const daysInactive = lastActive
        ? Math.floor((Date.now() - lastActive) / 86400000)
        : INACTIVE_DAYS;

      // 通知代理商
      await notifyAgent(user, t, daysInactive);

      // 通知服务商
      await notifyServiceProvider(user, t, daysInactive);

      // 如果没有通知任何人，创建系统记录（同样做当日去重，避免孤儿会员每天刷一条记录）
      if (!user.agent_id && !user.service_provider_id) {
        const systemAlerted = await hasAlertedToday(user.id, 'system');
        if (!systemAlerted) {
          await db.InactiveAlert.create({
            user_id: user.id,
            days_inactive: daysInactive,
            alert_type: 'system',
            notified_at: new Date()
          }, { transaction: t });
        }
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      logger.error(`处理用户${user.id}流失预警失败:`, err);
    }
  }

  logger.info('流失预警检测完成');
}

/**
 * 检测3天无活跃会员（带分布式锁，多实例部署安全）
 * 集群下所有实例都会触发，但 GET_LOCK 互斥确保只有一个实例真正执行
 */
async function checkInactiveUsers() {
  try {
    const { executed } = await distributedLock.withLock(LOCK_NAME, doCheckInactiveUsers, 0);
    if (!executed) {
      logger.info('流失预警任务已被其他实例执行，跳过');
    }
  } catch (err) {
    logger.error('流失预警检测失败:', err);
  }
}

/**
 * 启动定时任务
 *
 * 多实例部署说明：
 *   1. 所有实例默认都会启动 node-schedule（进程内调度）
 *   2. 凌晨2点（北京时间）所有实例同时触发，通过 GET_LOCK 互斥，只有一个实例真正执行
 *   3. 如需进一步减少无效触发，可设置环境变量 ENABLE_SCHEDULER=false
 *      让非主实例完全不启动调度（适用于运维明确区分主从实例的场景）
 *   4. 推荐组合：主实例 ENABLE_SCHEDULER=true（默认），从实例 ENABLE_SCHEDULER=false
 *
 * 时区说明：
 *   - cron 显式指定 tz: 'Asia/Shanghai'，与业务时区一致
 *   - 即使服务器 OS 时区为 UTC，也会在北京 02:00 触发
 *   - 与 "满N天" 边界（北京0点）对齐，避免边界偏移
 */
function startInactiveAlertJob() {
  // 环境变量控制：ENABLE_SCHEDULER=false 时本实例不启动调度
  if (process.env.ENABLE_SCHEDULER === 'false') {
    logger.info('ENABLE_SCHEDULER=false，本实例不启动流失预警定时任务（多实例部署的从实例）');
    return;
  }

  // 每日凌晨2点（北京时间）执行
  // 显式 tz 避免服务器 OS 时区为 UTC 时在北京 10:00 才触发
  schedule.scheduleJob({ rule: '0 2 * * *', tz: dateUtils.BUSINESS_TZ }, checkInactiveUsers);
  logger.info(`流失预警定时任务已启动，每日凌晨2点执行（时区=${dateUtils.BUSINESS_TZ}，多实例部署下由 GET_LOCK 保证唯一执行）`);
}

// 如果直接运行此脚本，立即执行一次并启动定时任务
if (require.main === module) {
  checkInactiveUsers().then(() => {
    startInactiveAlertJob();
  });
}

module.exports = {
  checkInactiveUsers,
  startInactiveAlertJob
};
