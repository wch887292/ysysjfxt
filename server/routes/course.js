// routes/course.js - 课程学习积分路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, serverError } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const { getTodayString } = require('../utils/date');
const { recalcHonor } = require('../utils/honor');
const { getSurpriseMessage } = require('../utils/surprise');
const configCache = require('../utils/configCache');

// 兜底默认值（DB 配置缺失时使用，与方案6.1 一致）
const FALLBACK_COURSE_POINTS = 10;
const FALLBACK_PROGRESS_THRESHOLD = 80;

/**
 * 从 DB 配置读取课程积分参数（带缓存，方案6.1 "后台可配"）
 * 缓存失效或 DB 异常时回退到 FALLBACK 默认值，保证服务可用
 * @returns {Promise<{coursePoints: number, progressThreshold: number}>}
 */
async function getCourseConfig() {
  try {
    const [coursePoints, progressThreshold] = await Promise.all([
      configCache.get(db, 'course.points'),
      configCache.get(db, 'course.progress_threshold')
    ]);
    return {
      coursePoints: typeof coursePoints === 'number' ? coursePoints : FALLBACK_COURSE_POINTS,
      progressThreshold: typeof progressThreshold === 'number' ? progressThreshold : FALLBACK_PROGRESS_THRESHOLD
    };
  } catch (err) {
    logger.warn('读取课程配置失败，使用默认值:', err.message);
    return { coursePoints: FALLBACK_COURSE_POINTS, progressThreshold: FALLBACK_PROGRESS_THRESHOLD };
  }
}

/**
 * 课程列表数据（文档阅读模式）
 * 注：当前无独立 Course 模型表，前端展示需由此常量提供
 */
const COURSES = [
  {
    id: 1,
    title: '均衡饮食入门',
    description: '了解每日营养搭配原则，掌握三餐合理分配技巧，吃出健康好身体。',
    coverImage: 'https://picsum.photos/seed/course1/600/400',
    duration: '约5分钟阅读',
    status: 'published',
    sortOrder: 1,
    content: `均衡饮食是健康生活的基石。根据《中国居民膳食指南（2022）》的建议，每日饮食应包含以下五大类食物：

一、谷薯类
每天摄入谷类200~300克，其中全谷物和杂豆类50~150克；薯类50~100克。推荐选择糙米、燕麦、小米、全麦面包等全谷物食品，它们富含膳食纤维和B族维生素。

二、蔬菜水果类
每天摄入蔬菜300~500克，水果200~350克。尽量选择不同颜色的蔬菜水果，深色蔬菜（如菠菜、西兰花、胡萝卜）应占一半以上。蔬菜水果富含维生素、矿物质和抗氧化物质，有助于降低慢性病风险。

三、动物性食物
每天摄入鱼、禽、蛋、瘦肉共120~200克。优先选择鱼和禽类，适量摄入红肉。每周至少吃两次水产品，每天一个鸡蛋。动物性食物提供优质蛋白质和必需脂肪酸。

四、奶类及豆类
每天摄入奶及奶制品300~500克，大豆及坚果类25~35克。牛奶是钙的最佳来源，豆制品如豆腐、豆浆富含植物蛋白。

五、油盐糖
每天烹调油不超过25~30克，食盐不超过5克，添加糖不超过25克。减少高油高盐高糖加工食品的摄入。

三餐分配建议：早、中、晚餐的能量比例约为3:4:3。早餐要吃好，午餐要吃饱，晚餐要吃少。细嚼慢咽，每餐用时不少于20分钟。

记住一个简单的口诀：每天一斤蔬菜半斤水果，一把坚果一袋奶，主食粗细搭配，鱼肉蛋类适量。`
  },
  {
    id: 2,
    title: '减盐减糖实操',
    description: '高盐高糖饮食的健康风险与日常减盐减糖的实用方法，守护心血管健康。',
    coverImage: 'https://picsum.photos/seed/course2/600/400',
    duration: '约6分钟阅读',
    status: 'published',
    sortOrder: 2,
    content: `高盐高糖饮食是高血压、糖尿病、心血管疾病的重要诱因。掌握以下减盐减糖技巧，让饮食更健康：

【减盐篇】

世界卫生组织建议成人每日食盐摄入量不超过5克（约一个啤酒瓶盖的量）。中国居民平均每日食盐摄入量约10.5克，超标一倍以上。

实用减盐技巧：
1. 烹饪时使用限盐勺，定量用盐
2. 菜肴出锅前再放盐，咸味感知更强
3. 多用葱、姜、蒜、醋、柠檬汁等天然调味品替代盐和酱油
4. 少吃加工食品（火腿肠、方便面、咸菜、薯片等）
5. 购买食品时查看营养成分表，选择钠含量低的产品
6. 减少在外就餐次数，餐馆菜肴通常含盐量较高

【减糖篇】

添加糖是指人工加入食品中的糖类，包括白砂糖、红糖、冰糖、果葡糖浆等。建议每日添加糖摄入量不超过25克。

实用减糖技巧：
1. 少喝含糖饮料，一瓶500毫升可乐含糖约53克，远超推荐量
2. 喝白开水、淡茶或无糖饮品代替甜饮料
3. 少吃甜点、蛋糕、饼干等高糖食品
4. 烹饪时少放糖，可用水果天然甜味替代
5. 选购食品时留意"无糖"标识，注意是否含代糖

坚持减盐减糖，可在2~4周内逐渐适应清淡口味，血压和血糖水平将得到明显改善。`
  },
  {
    id: 3,
    title: '蔬果摄入指南',
    description: '每天应吃多少蔬菜水果？不同颜色蔬果的营养价值与搭配建议详解。',
    coverImage: 'https://picsum.photos/seed/course3/600/400',
    duration: '约5分钟阅读',
    status: 'published',
    sortOrder: 3,
    content: `蔬菜水果是维生素、矿物质、膳食纤维和植物化学物的主要来源，对维持健康至关重要。

【每日摄入量】

根据《中国居民膳食指南（2022）》：
- 蔬菜：每天300~500克，其中深色蔬菜应占一半以上
- 水果：每天200~350克，相当于1~2个中等大小的苹果

【不同颜色蔬果的营养价值】

红色蔬果（番茄、红椒、西瓜、草莓）：
富含番茄红素和维生素C，有助于抗氧化、保护心血管健康。

橙黄色蔬果（胡萝卜、南瓜、玉米、橙子）：
富含β-胡萝卜素和维生素C，有助于保护视力、增强免疫力。

绿色蔬果（菠菜、西兰花、油菜、猕猴桃）：
富含叶酸、维生素K、叶绿素和膳食纤维，有助于造血功能和骨骼健康。

紫色蔬果（紫甘蓝、茄子、蓝莓、葡萄）：
富含花青素，有助于抗氧化、延缓衰老、改善记忆力。

白色蔬果（白萝卜、蘑菇、洋葱、大蒜）：
富含硫化物和多糖，有助于抗菌消炎、调节免疫力。

【搭配建议】
1. 每餐至少包含2~3种不同颜色的蔬菜
2. 先洗后切、急火快炒、现做现吃，减少营养流失
3. 蔬菜水果不能互相替代，两者都要吃
4. 尽量吃完整蔬果，少喝果汁（榨汁会损失膳食纤维）
5. 每周至少摄入25种以上不同食物，保证营养全面`
  },
  {
    id: 4,
    title: '控制热量小技巧',
    description: '学会看懂食物热量，掌握日常饮食控热窍门，轻松管理体重。',
    coverImage: 'https://picsum.photos/seed/course4/600/400',
    duration: '约6分钟阅读',
    status: 'published',
    sortOrder: 4,
    content: `控制热量摄入是体重管理的核心。了解食物热量并掌握日常控热技巧，助你轻松维持健康体重。

【热量基础知识】

成人每日热量需求因年龄、性别、体重和活动量而异：
- 轻体力活动成年女性：约1800~2000千卡/天
- 轻体力活动成年男性：约2200~2400千卡/天
- 减重期间建议每日减少300~500千卡摄入

【常见食物热量参考】

一碗米饭（200克）：约232千卡
一个鸡蛋（50克）：约72千卡
一个苹果（200克）：约106千卡
一杯全脂牛奶（250ml）：约163千卡
一块炸鸡（100克）：约279千卡
一罐可乐（330ml）：约142千卡

【控热小技巧】

1. 餐前喝一杯水或清汤，增加饱腹感
2. 使用小碗小盘，视觉上减少分量
3. 先吃蔬菜再吃主食和肉类，控制总摄入量
4. 细嚼慢咽，每口咀嚼20~30次，给大脑足够时间接收饱腹信号
5. 少油少糖烹饪，多采用蒸、煮、炖、凉拌方式
6. 减少高热量零食（薯片、饼干、巧克力），用水果、坚果替代
7. 记录每日饮食，借助APP追踪热量摄入
8. 规律作息，避免熬夜（熬夜会降低基础代谢率并增加饥饿感）

【注意事项】

控制热量不等于节食！过度节食会导致营养不良、基础代谢率下降，反而更容易反弹。建议在保证营养均衡的前提下适度控制热量，配合规律运动，每周减重0.5~1公斤为宜。`
  },
  {
    id: 5,
    title: '老年人营养要点',
    description: '针对中老年人的营养需求与饮食注意事项，补充蛋白质与钙质的实用建议。',
    coverImage: 'https://picsum.photos/seed/course5/600/400',
    duration: '约6分钟阅读',
    status: 'published',
    sortOrder: 5,
    content: `随着年龄增长，老年人的身体机能和营养需求发生变化，科学合理的饮食对维持健康至关重要。

【核心营养需求】

一、优质蛋白质
老年人蛋白质合成能力下降，每日推荐摄入量应达到1.0~1.2克/公斤体重。优质蛋白来源包括：鸡蛋、牛奶、鱼肉、瘦肉、豆腐等。建议每日摄入1个鸡蛋、300毫升牛奶、50~75克鱼禽瘦肉。

二、钙与维生素D
老年人骨质疏松风险高，每日钙推荐摄入量为1000毫克。补钙首选食补：牛奶及奶制品（300毫升牛奶约含钙300毫克）、豆腐、小鱼干、深绿色蔬菜。同时注意补充维生素D（可通过日晒或遵医嘱补充剂），促进钙吸收。

三、膳食纤维
促进肠道蠕动，预防便秘。推荐每日摄入25~30克膳食纤维，来源包括：全谷物、杂豆类、蔬菜、水果、菌菇类。

四、B族维生素
特别是维生素B12和叶酸，对维持神经系统功能和预防贫血很重要。来源：动物肝脏、蛋类、绿叶蔬菜、豆类。

【饮食建议】

1. 少量多餐，每日可分5~6餐进食，每餐七八分饱
2. 食物宜软烂易消化，多用蒸、煮、炖、烩的烹饪方式
3. 保证充足饮水，每日1500~1700毫升（温热白开水为佳）
4. 控制油盐糖摄入，烹饪用油不超过25克/天，食盐不超过5克/天
5. 适当晒太阳，每日15~30分钟，促进维生素D合成

【注意事项】

老年人应定期体检，关注营养状况。如进食困难、体重明显下降或存在慢性病，建议咨询专业营养师或医生制定个性化饮食方案。`
  },
  {
    id: 6,
    title: '三餐定时定量',
    description: '规律进餐对健康的重要性，如何科学安排一日三餐的时间与分量。',
    coverImage: 'https://picsum.photos/seed/course6/600/400',
    duration: '约5分钟阅读',
    status: 'published',
    sortOrder: 6,
    content: `规律进餐是维持消化系统健康、稳定血糖和体重的基础。科学安排三餐时间与分量，让身体形成健康节奏。

【三餐的理想时间安排】

早餐：7:00~8:00
早餐是一天中最重要的一餐，经过一夜的空腹，需要及时补充能量。早餐时间不宜过晚，最好在起床后1小时内完成。

午餐：12:00~13:00
午餐承上启下，应提供全天能量的30%~40%。午餐时间要规律，避免推迟到下午两三点才吃。

晚餐：18:00~19:00
晚餐应尽量在睡前3~4小时完成，避免太晚进食影响睡眠和消化。

【三餐分量分配原则】

按能量比例：早餐30%、午餐40%、晚餐30%

早餐要吃饱：包含主食（全麦面包、燕麦粥）、蛋白质（鸡蛋、牛奶）、蔬果
午餐要吃好：主食＋优质蛋白＋足量蔬菜，保证营养全面
晚餐要吃少：以清淡为主，减少高油高脂食物，主食适当减量

【加餐建议】

两餐之间如感到饥饿，可适当加餐：
- 上午10:00：一个水果或一小把坚果
- 下午15:00~16:00：一杯酸奶或几片全麦饼干
- 避免睡前加餐，如需进食可选择温热牛奶

【注意事项】

1. 不要暴饮暴食，每餐七八分饱为宜
2. 不要跳过任何一餐，尤其是早餐（长期不吃早餐增加胆结石、心血管疾病风险）
3. 进餐时保持心情愉快，专注吃饭，避免边吃边看手机
4. 建立固定的进餐时间表，让身体形成生物钟
5. 如果因特殊情况错过正常进餐时间，可先少量进食垫胃，避免过度饥饿后暴食`
  }
];

/**
 * 获取课程列表
 * GET /api/user/courses/list
 * 返回所有已发布课程，按 sort_order ASC 排序
 */
router.get('/list', (req, res) => {
  const list = COURSES
    .filter((c) => c.status === 'published')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      coverImage: c.coverImage,
      duration: c.duration,
      content: c.content
    }));
  return success(res, { courses: list });
});

/**
 * 更新课程学习进度
 * POST /api/user/courses/progress
 */
router.post('/progress', async (req, res) => {
  // 注意：以下变量必须声明在 try 之外。
  // catch 分支需要在唯一索引冲突时复用它们做补偿更新，
  // 若声明在 try 内部，catch 属于独立块作用域会抛 ReferenceError，导致请求永久挂起。
  const userId = req.user.id;
  // 规格9.3 tolerant reader：同时接受 snake_case 和 camelCase
  const courseId = req.body.course_id || req.body.courseId;
  const courseName = req.body.course_name || req.body.courseName;
  const rawProgress = req.body.progress;
  const today = getTodayString();

  if (!courseId) {
    return fail(res, '缺少课程ID');
  }
  // 严格数值校验：字符串 "abc" 在 < / > 比较中恒为 false，会绕过区间判断并写入 NaN
  const progress = Number(rawProgress);
  if (rawProgress === undefined || rawProgress === null || rawProgress === '' ||
      !Number.isFinite(progress) || progress < 0 || progress > 100) {
    return fail(res, '学习进度需在0-100之间');
  }

  try {

    // 方案6.1：积分值与进度阈值从 DB 配置读取（getCourseConfig）
    const { coursePoints: COURSE_POINTS, progressThreshold: PROGRESS_THRESHOLD } = await getCourseConfig();

    // 查找或创建今日学习记录
    let record = await db.CourseRecord.findOne({
      where: { user_id: userId, course_id: courseId, study_date: today }
    });

    if (!record) {
      record = await db.CourseRecord.create({
        user_id: userId,
        course_id: courseId,
        course_name: courseName || '',
        progress: parseInt(progress),
        points_earned: 0,
        study_date: today
      });
    } else {
      // 更新为最大进度
      const newProgress = Math.max(record.progress, parseInt(progress));
      await record.update({ progress: newProgress, course_name: courseName || record.course_name });
      record.progress = newProgress;
    }

    // 达到阈值且未获得过积分，发放积分
    // 按 (user_id, course_id) 维度防重：查询该用户该课程的所有记录中是否已发放过积分
    let pointsEarned = 0;
    let message = '学习进度已记录';

    if (record.progress >= PROGRESS_THRESHOLD) {
      const t = await db.sequelize.transaction();
      try {
        // 关键修复：事务开始即对 User 行加锁，串行化同一用户的并发请求
        // 不同日期的 CourseRecord 行锁不互斥，仅锁 record 无法防止跨日并发双发
        // 与 clockIn.js 第112/261行、signIn.js 的用户行锁模式保持一致
        await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

        // 防重检查必须在事务内 + 行锁，防止并发请求双发积分
        // 查询该用户该课程是否已有积分发放记录（跨日防重，维度为 user+course）
        const existingRewarded = await db.CourseRecord.findOne({
          where: {
            user_id: userId,
            course_id: courseId,
            points_earned: { [db.Sequelize.Op.gt]: 0 }
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (!existingRewarded) {
          // 对当前记录行加锁，防止并发更新同一行
          const lockedRecord = await db.CourseRecord.findByPk(record.id, {
            transaction: t,
            lock: t.LOCK.UPDATE
          });

          if (lockedRecord && lockedRecord.points_earned === 0) {
            await lockedRecord.update({ points_earned: COURSE_POINTS }, { transaction: t });

            const pointsResult = await addPoints(
              userId,
              COURSE_POINTS,
              'course_learning',
              `学习课程${courseId}达到${lockedRecord.progress}%`,
              lockedRecord.id,
              t
            );

            await db.User.update(
              { last_active_at: new Date() },
              { where: { id: userId }, transaction: t }
            );

            // 重新计算荣誉等级与勋章（可能获得学习达人勋章）
            const user = await db.User.findByPk(userId, { transaction: t });
            await recalcHonor(user, db, t);

            pointsEarned = pointsResult.earned;
            message = `学习进度达到 ${PROGRESS_THRESHOLD}%，获得 ${pointsResult.earned} 积分奖励！`;
          }
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // 更新最后活跃时间（非积分场景也更新）
    if (pointsEarned === 0) {
      await db.User.update(
        { last_active_at: new Date() },
        { where: { id: userId } }
      );
    }

    return success(res, {
      record: {
        id: record.id,
        courseId: record.course_id,
        courseName: record.course_name,
        progress: record.progress,
        pointsEarned: record.points_earned,
        studyDate: record.study_date
      },
      pointsEarned,
      message,
      surpriseMessage: pointsEarned > 0 ? getSurpriseMessage(pointsEarned) : null,
      // 规格9.3 snake_case 字段
      points_earned: pointsEarned
    }, '进度更新成功');
  } catch (err) {
    // P1-9: 并发创建冲突时，唯一索引拒绝第二条，改为更新已有记录
    if (err.name === 'SequelizeUniqueConstraintError') {
      // 补偿更新自身也可能失败，必须独立捕获，否则异常逃逸导致响应永不返回
      try {
        const where = { user_id: userId, course_id: courseId, study_date: today };
        const existing = await db.CourseRecord.findOne({ where });
        // 与正常路径保持一致：进度只增不减，避免并发回写造成进度倒退
        const newProgress = existing
          ? Math.max(existing.progress || 0, Math.trunc(progress))
          : Math.trunc(progress);
        await db.CourseRecord.update(
          { progress: newProgress, course_name: courseName || (existing && existing.course_name) || '' },
          { where }
        );
        return success(res, { message: '学习进度已记录' }, '进度更新成功');
      } catch (retryErr) {
        logger.error('课程进度冲突补偿更新失败:', retryErr);
        return serverError(res);
      }
    }
    logger.error('更新课程进度失败:', err);
    return serverError(res);
  }
});

/**
 * 获取课程学习历史
 * GET /api/user/courses/history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    // 分页参数须做上限与非法值兜底：
    // 原实现直接 parseInt，?pageSize=9999999 可拖库，?pageSize=abc 会得到 limit: NaN
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await db.CourseRecord.findAndCountAll({
      where: { user_id: userId },
      order: [['study_date', 'DESC'], ['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      records: rows,
      total: count,
      hasMore: offset + rows.length < count
    });
  } catch (err) {
    logger.error('获取课程历史失败:', err);
    return serverError(res);
  }
});

module.exports = router;
