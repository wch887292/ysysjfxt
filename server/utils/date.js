// utils/date.js - 日期工具（业务时区固定为 Asia/Shanghai，避免服务器时区偏移）
//
// 设计原则：
//   - 业务时区统一为 Asia/Shanghai (UTC+8)，不依赖服务器本地时区
//   - 所有"今日0点"/"N天前0点"边界用 UTC 数学运算计算北京0点
//   - 即使服务器部署在 UTC 时区，"满N天"边界也与北京用户感知一致
//
// 关键概念：
//   北京0点对应的 UTC 时间 = Date.UTC(北京年,月,日) - 8*3600*1000
//   例：北京 2026-07-30 00:00:00 = UTC 2026-07-29 16:00:00

const BUSINESS_TZ = 'Asia/Shanghai';
const BUSINESS_TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/**
 * 获取业务时区（北京时间）的"今日0点"，返回 UTC Date 对象
 * 不依赖服务器本地时区，确保满N天边界稳定。
 * @param {Date} date 参考时间，默认当前
 * @returns {Date} 北京0点对应的 UTC Date
 */
function getBusinessDayStart(date = new Date()) {
  // 将 UTC 时间平移到北京时间，用 UTC 取年月日构造北京0点，再平移回 UTC
  const beijingMs = date.getTime() + BUSINESS_TZ_OFFSET_MS;
  const beijingDate = new Date(beijingMs);
  const year = beijingDate.getUTCFullYear();
  const month = beijingDate.getUTCMonth();
  const day = beijingDate.getUTCDate();
  // Date.UTC 得到北京0点对应的 epoch 毫秒，再减去偏移得到 UTC 时间
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - BUSINESS_TZ_OFFSET_MS);
}

/**
 * 获取业务时区"N天前0点"（北京时间），返回 UTC Date 对象
 * 用于"满N天未活跃"等日历边界判定。
 * @param {number} days 天数
 * @param {Date} date 参考时间，默认当前
 * @returns {Date} N天前北京0点对应的 UTC Date
 */
function getBusinessDaysAgo(days, date = new Date()) {
  const todayStart = getBusinessDayStart(date);
  return new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * 获取今日日期字符串（YYYY-MM-DD，北京时区）
 */
function getTodayString() {
  return formatBusinessDate(new Date());
}

/**
 * 将 Date 格式化为业务时区日期字符串（YYYY-MM-DD）
 * 不依赖服务器本地时区。
 */
function formatBusinessDate(date) {
  const beijingDate = new Date(new Date(date).getTime() + BUSINESS_TZ_OFFSET_MS);
  const year = beijingDate.getUTCFullYear();
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 判断两个日期是否在同一业务月（北京时区）
 * 用于月度次数限制的"本月"判断，避免服务器UTC时区偏移
 * @param {Date} dateA
 * @param {Date} dateB
 * @returns {boolean}
 */
function isSameBusinessMonth(dateA, dateB) {
  const a = new Date(dateA.getTime() + BUSINESS_TZ_OFFSET_MS);
  const b = new Date(dateB.getTime() + BUSINESS_TZ_OFFSET_MS);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * 获取下月1号（北京时区）的Date对象，用于"次数重置日期"
 * @param {Date} date 参考时间，默认当前
 * @returns {Date} 下月1号0点（北京时区）对应的UTC Date
 */
function getNextBusinessMonthStart(date = new Date()) {
  const beijingMs = date.getTime() + BUSINESS_TZ_OFFSET_MS;
  const beijingDate = new Date(beijingMs);
  const year = beijingDate.getUTCFullYear();
  const month = beijingDate.getUTCMonth();
  // 北京下月1号0点 = UTC时间
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0) - BUSINESS_TZ_OFFSET_MS);
}

/**
 * 获取本月1号0点（北京时区）的Date对象
 * 用于月度报告查询范围（如报告生成次数检查）
 * @param {Date} date 参考时间，默认当前
 * @returns {Date} 本月1号0点（北京时区）对应的UTC Date
 */
function getBusinessMonthStart(date = new Date()) {
  const beijingMs = date.getTime() + BUSINESS_TZ_OFFSET_MS;
  const beijingDate = new Date(beijingMs);
  const year = beijingDate.getUTCFullYear();
  const month = beijingDate.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0) - BUSINESS_TZ_OFFSET_MS);
}

// 向后兼容旧签名 formatLocalDate
const formatLocalDate = formatBusinessDate;

module.exports = {
  BUSINESS_TZ,
  getBusinessDayStart,
  getBusinessDaysAgo,
  getTodayString,
  formatBusinessDate,
  formatLocalDate,
  isSameBusinessMonth,
  getNextBusinessMonthStart,
  getBusinessMonthStart
};
