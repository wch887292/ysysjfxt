// utils/configCache.js - 系统配置缓存（方案6.1 "后台可配"）
//
// 设计要点：
// 1. 内存缓存 + TTL（60秒），避免签到等高频接口每次查 DB
// 2. 默认值兜底：DB 配置缺失或异常时回退到 DEFAULTS，保证服务可用
// 3. 启动时预加载：warmUp() 在 app.js 启动后调用，避免首次请求慢
// 4. 主动失效：updateConfig 后调用 invalidate() 立即清缓存
// 5. 按 category 批量加载：getCategory('sign_in') 一次返回该分类所有配置

const logger = require('./logger');

// 缓存 TTL（毫秒）
const CACHE_TTL_MS = 60 * 1000;

// 内存缓存：key=category, value={ data, expireAt }
const cache = new Map();

// 配置项默认值（DB 缺失时兜底，保证服务可用）
// 与原硬编码值保持一致，迁移期间行为不变
const DEFAULTS = {
  // 签到相关（方案6.1）
  'sign_in.base_points': { value: 5, type: 'number', category: 'sign_in', description: '每日签到基础积分' },
  'sign_in.milestones': { value: { 7: 10, 30: 30, 100: 100 }, type: 'json', category: 'sign_in', description: '连续签到里程碑奖励（天数:积分）' },

  // 打卡相关（方案6.1）
  'clock_in.daily_limit': { value: 3, type: 'number', category: 'clock_in', description: '每日打卡次数上限' },
  'clock_in.points_icon': { value: 10, type: 'number', category: 'clock_in', description: '图标打卡基础积分' },
  'clock_in.points_image': { value: 10, type: 'number', category: 'clock_in', description: '图片打卡基础积分' },
  'clock_in.points_follow_plan': { value: 20, type: 'number', category: 'clock_in', description: '遵循饮食计划奖励积分' },

  // 课程相关（方案6.1）
  'course.points': { value: 10, type: 'number', category: 'course', description: '课程学习积分（进度≥阈值时发放）' },
  'course.progress_threshold': { value: 80, type: 'number', category: 'course', description: '课程积分发放进度阈值（%）' },

  // 拉新相关（方案6.1）
  'invite.points_invite': { value: 20, type: 'number', category: 'invite', description: '拉新基础积分（新用户绑定推荐人时立即发放）' },
  'invite.points_register': { value: 50, type: 'number', category: 'invite', description: '拉新注册奖励（被推荐人完成首评估）' },
  'invite.points_active': { value: 100, type: 'number', category: 'invite', description: '拉新活跃奖励（被推荐人7天真实活跃）' },
  'invite.points_milestone': { value: 200, type: 'number', category: 'invite', description: '分享N名新客户里程碑奖励' },
  'invite.milestone_count': { value: 2, type: 'number', category: 'invite', description: '里程碑触发所需新客户数' },

  // 评估相关（方案3.4）
  'assessment.monthly_limit': { value: 1, type: 'number', category: 'assessment', description: '会员每月免费评估次数上限' }
};

/**
 * 解析配置值（根据 value_type 转换）
 */
function parseValue(rawValue, type) {
  if (rawValue === null || rawValue === undefined) return null;
  switch (type) {
    case 'number': {
      const n = Number(rawValue);
      return Number.isNaN(n) ? 0 : n;
    }
    case 'boolean':
      return rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1';
    case 'json':
      if (typeof rawValue === 'object') return rawValue;
      try { return JSON.parse(rawValue); } catch { return null; }
    case 'string':
    default:
      return String(rawValue);
  }
}

/**
 * 从 DB 加载指定 category 的所有配置
 */
async function loadCategoryFromDB(db, category) {
  const rows = await db.SystemConfig.findAll({
    where: { category },
    attributes: ['config_key', 'config_value', 'value_type']
  });
  const result = {};
  for (const row of rows) {
    result[row.config_key] = parseValue(row.config_value, row.value_type);
  }
  return result;
}

/**
 * 获取指定 category 下所有配置（含默认值兜底）
 * @param {Object} db - 数据库实例
 * @param {string} category - 配置分类，如 'sign_in'
 * @returns {Promise<Object>} 配置键值对
 */
async function getCategory(db, category) {
  // 检查缓存
  const cached = cache.get(category);
  if (cached && cached.expireAt > Date.now()) {
    return cached.data;
  }

  // 从 DB 加载
  let dbConfig = {};
  try {
    dbConfig = await loadCategoryFromDB(db, category);
  } catch (err) {
    logger.warn(`加载配置分类 ${category} 失败，使用默认值:`, err.message);
    // DB 异常时，缓存已有的旧值或回退默认值
    if (cached) return cached.data;
  }

  // 合并默认值（DB 配置覆盖默认值）
  const merged = {};
  for (const [key, def] of Object.entries(DEFAULTS)) {
    if (def.category === category) {
      merged[key] = def.value;
    }
  }
  Object.assign(merged, dbConfig);

  // 写入缓存
  cache.set(category, { data: merged, expireAt: Date.now() + CACHE_TTL_MS });
  return merged;
}

/**
 * 获取单个配置项（含默认值兜底）
 * 优先从缓存读取，避免高频接口每次查 DB
 * @param {Object} db
 * @param {string} key - 配置键，如 'sign_in.milestones'
 * @returns {Promise<*>} 配置值
 */
async function get(db, key) {
  const def = DEFAULTS[key];
  if (!def) {
    logger.warn(`未知配置键: ${key}`);
    return null;
  }
  const all = await getCategory(db, def.category);
  return all[key] !== undefined ? all[key] : def.value;
}

/**
 * 主动失效缓存（配置更新后调用）
 * @param {string} [category] - 指定分类，不传则清空全部
 */
function invalidate(category) {
  if (category) {
    cache.delete(category);
  } else {
    cache.clear();
  }
}

/**
 * 启动时预热缓存（避免首次请求慢）
 */
async function warmUp(db) {
  const categories = [...new Set(Object.values(DEFAULTS).map(d => d.category))];
  await Promise.all(
    categories.map(cat =>
      getCategory(db, cat).catch(err =>
        logger.warn(`预热配置 ${cat} 失败:`, err.message)
      )
    )
  );
  logger.info(`系统配置缓存预热完成（${categories.length} 个分类）`);
}

/**
 * 获取所有默认值（供初始化脚本写入 DB）
 */
function getDefaults() {
  return DEFAULTS;
}

module.exports = {
  get,
  getCategory,
  invalidate,
  warmUp,
  getDefaults,
  parseValue
};
