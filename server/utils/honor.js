// utils/honor.js - 荣誉等级与勋章计算
const { Op } = require('sequelize');
const { getTodayString, formatLocalDate } = require('./date');

const HONOR_LEVELS = {
  newcomer: '健康新人',
  expert: '健康达人',
  star: '健康之星',
  ambassador: '健康大使',
  messenger: '健康使者'
};

// 荣誉等级积分加成比例
const HONOR_BONUS_RATES = {
  newcomer: 0,
  expert: 0.10,
  star: 0.20,
  ambassador: 0.30,
  messenger: 0.40
};

/**
 * 获取荣誉等级积分加成比例
 */
function getHonorBonusRate(honorLevel) {
  return HONOR_BONUS_RATES[honorLevel] || 0;
}

/**
 * 计算用户连续打卡天数
 */
async function getConsecutiveClockInDays(userId, ClockInRecord, transaction = null) {
  const records = await ClockInRecord.findAll({
    where: { user_id: userId },
    attributes: ['clock_in_date'],
    group: ['clock_in_date'],
    order: [['clock_in_date', 'DESC']],
    raw: true,
    transaction
  });

  if (records.length === 0) return 0;

  const today = new Date(getTodayString());
  let consecutive = 0;
  let checkDate = new Date(today);

  // 如果今天没打卡，从昨天开始算
  const dateSet = new Set(records.map(r => r.clock_in_date));
  if (!dateSet.has(formatLocalDate(today))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (dateSet.has(formatLocalDate(checkDate))) {
    consecutive++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return consecutive;
}

/**
 * 计算用户累计打卡天数
 */
async function getTotalClockInDays(userId, ClockInRecord, transaction = null) {
  const count = await ClockInRecord.count({
    where: { user_id: userId },
    col: 'clock_in_date',
    distinct: true,
    transaction
  });
  return count;
}

/**
 * 计算用户成功拉新人数（完成首评估的推荐用户）
 */
async function getReferralCount(userId, User, transaction = null) {
  if (!userId) return 0;
  return await User.count({
    where: {
      referrer_id: userId,
      questionnaire_completed: true,
      identity_type: { [Op.in]: ['user', 'member'] }
    },
    transaction
  });
}

/**
 * 计算用户累计学习课程数（进度>=80%且已获得积分）
 */
async function getCourseCount(userId, CourseRecord, transaction = null) {
  if (!CourseRecord) return 0;
  return await CourseRecord.count({
    where: {
      user_id: userId,
      points_earned: { [Op.gt]: 0 }
    },
    distinct: true,
    col: 'course_id',
    transaction
  });
}

/**
 * 根据规则重新计算并更新荣誉等级与勋章
 */
async function recalcHonor(user, db, transaction = null) {
  const { ClockInRecord, User, CourseRecord } = db;

  const consecutiveDays = await getConsecutiveClockInDays(user.id, ClockInRecord, transaction);
  const totalDays = await getTotalClockInDays(user.id, ClockInRecord, transaction);
  const referralCount = await getReferralCount(user.id, User, transaction);
  const courseCount = await getCourseCount(user.id, CourseRecord, transaction);

  let newLevel = user.honor_level;
  const newBadges = new Set(user.badges || []);

  // 等级规则（方案3.2：Lv.2连续7天/Lv.3连续30天/Lv.4累计90天/Lv.5拉新2人）
  // 注意 Lv.4 方案字面为"累计打卡 90 天"，区别于 Lv.2/Lv.3 的"连续打卡"
  if (referralCount >= 2) {
    newLevel = 'messenger';
  } else if (totalDays >= 90) {
    newLevel = 'ambassador';
  } else if (consecutiveDays >= 30) {
    newLevel = 'star';
  } else if (consecutiveDays >= 7) {
    newLevel = 'expert';
  }

  // 勋章规则
  if (consecutiveDays >= 100) newBadges.add('坚持之星');
  if (referralCount >= 5) newBadges.add('拉新能手');
  if (courseCount >= 10) newBadges.add('学习达人');

  if (newLevel !== user.honor_level || JSON.stringify([...newBadges]) !== JSON.stringify(user.badges || [])) {
    await user.update({
      honor_level: newLevel,
      badges: [...newBadges]
    }, { transaction });
  }

  return {
    honorLevel: newLevel,
    badges: [...newBadges],
    consecutiveDays,
    totalDays,
    referralCount,
    courseCount
  };
}

module.exports = {
  HONOR_LEVELS,
  getHonorBonusRate,
  recalcHonor,
  getConsecutiveClockInDays,
  getTotalClockInDays,
  getReferralCount
};
