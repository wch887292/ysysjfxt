// routes/questionnaire.js - 健康问卷路由
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { addPoints } = require('./points');
const { recalcHonor } = require('../utils/honor');
const configCache = require('../utils/configCache');

// 兜底默认值（DB 配置缺失时使用，与方案6.1 一致）
const FALLBACK_INVITE_POINTS = {
  register: 50,
  active: 100,
  milestone: 200,
  milestoneCount: 2
};

/**
 * 从 DB 配置读取拉新奖励参数（带缓存，方案6.1 "后台可配"）
 * 缓存失效或 DB 异常时回退到 FALLBACK 默认值，保证服务可用
 * @returns {Promise<Object>}
 */
async function getInviteConfig() {
  try {
    const [pointsRegister, pointsActive, pointsMilestone, milestoneCount] = await Promise.all([
      configCache.get(db, 'invite.points_register'),
      configCache.get(db, 'invite.points_active'),
      configCache.get(db, 'invite.points_milestone'),
      configCache.get(db, 'invite.milestone_count')
    ]);
    return {
      register: typeof pointsRegister === 'number' ? pointsRegister : FALLBACK_INVITE_POINTS.register,
      active: typeof pointsActive === 'number' ? pointsActive : FALLBACK_INVITE_POINTS.active,
      milestone: typeof pointsMilestone === 'number' ? pointsMilestone : FALLBACK_INVITE_POINTS.milestone,
      milestoneCount: typeof milestoneCount === 'number' ? milestoneCount : FALLBACK_INVITE_POINTS.milestoneCount
    };
  } catch (err) {
    logger.warn('读取拉新配置失败，使用默认值:', err.message);
    return FALLBACK_INVITE_POINTS;
  }
}

/**
 * 提交健康问卷
 * POST /api/user/questionnaire
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    // V8修复：严格校验answers类型与大小，防止超大JSON导致DoS
    if (!answers) {
      return fail(res, '缺少问卷答案');
    }
    if (typeof answers !== 'object' || Array.isArray(answers) || answers === null) {
      return fail(res, '问卷答案格式不合法');
    }
    const answersKeys = Object.keys(answers);
    if (answersKeys.length === 0) {
      return fail(res, '问卷答案不能为空');
    }
    if (answersKeys.length > 100) {
      return fail(res, '问卷答案字段过多');
    }
    // 限制序列化后大小 < 10KB
    let answersJson;
    try {
      answersJson = JSON.stringify(answers);
    } catch (e) {
      return fail(res, '问卷答案序列化失败');
    }
    if (answersJson.length > 10240) {
      return fail(res, '问卷答案过大');
    }
    // 校验key与value类型，防止原型污染
    for (const key of answersKeys) {
      if (typeof key !== 'string' || key.length > 50 || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return fail(res, `非法字段: ${key}`);
      }
      const val = answers[key];
      const valType = typeof val;
      if (valType !== 'string' && valType !== 'number' && valType !== 'boolean' && !Array.isArray(val)) {
        return fail(res, `字段值类型不合法: ${key}`);
      }
      if (valType === 'string' && val.length > 500) {
        return fail(res, `字段值过长: ${key}`);
      }
      if (Array.isArray(val) && val.length > 50) {
        return fail(res, `字段值数组过长: ${key}`);
      }
    }

    const user = await db.User.findByPk(userId);
    if (!user) {
      return fail(res, '用户不存在');
    }

    // 规格12.1合规要求：首次提交问卷前必须显式同意隐私政策与数据使用授权
    // consent_accepted 由前端勾选"我已阅读并同意《隐私政策与免责声明》"后传入
    const consentAccepted = req.body.consent_accepted === true || req.body.consentAccepted === true;
    if (!consentAccepted && !user.consent_accepted_at) {
      return fail(res, '请先阅读并同意《隐私政策与免责声明》后再提交问卷');
    }

    // 检查本月评估次数限制（每月1次）
    const limitCheck = checkAssessmentLimit(user);
    if (!limitCheck.allowed) {
      return fail(res, limitCheck.message);
    }

    // 计算风险评分
    const riskScore = calculateRiskScore(answers);
    const riskLevel = riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high';

    // 查询用户是否曾经完成过问卷（用于首次奖励判断）
    const hasCompletedBefore = await db.Questionnaire.findOne({
      where: { user_id: userId, completed: true }
    });

    let questionnaire;

    const t = await db.sequelize.transaction();
    try {
      // 每月创建新的问卷记录，保留历史
      questionnaire = await db.Questionnaire.create({
        user_id: userId,
        completed: true,
        risk_score: riskScore,
        risk_level: riskLevel,
        declaration_acknowledged: true
      }, { transaction: t });

      // 保存答案（批量创建，带 category 分类）
      const answerRecords = Object.entries(answers).map(([questionId, answer]) => ({
        questionnaire_id: questionnaire.id,
        question_id: questionId,
        question_label: getQuestionLabel(questionId),
        category: getQuestionCategory(questionId),
        answer: JSON.stringify(answer)
      }));
      if (answerRecords.length > 0) {
        await db.QuestionnaireAnswer.bulkCreate(answerRecords, { transaction: t });
      }

      // 跨月重置本月评估次数
      const now = new Date();
      const lastAssessment = user.last_assessment_date ? new Date(user.last_assessment_date) : null;
      const shouldResetCount = !lastAssessment ||
        lastAssessment.getFullYear() !== now.getFullYear() ||
        lastAssessment.getMonth() !== now.getMonth();

      // 更新用户健康信息与评估记录
      const updateData = {
        questionnaire_completed: true,
        identity_type: user.identity_type === 'guest' ? 'user' : user.identity_type,
        last_assessment_date: now,
        assessment_count_this_month: shouldResetCount ? 1 : user.assessment_count_this_month + 1,
        last_active_at: now
      };

      // 规格12.1：记录用户隐私授权同意时间（仅首次同意时写入，后续不覆盖）
      if (consentAccepted && !user.consent_accepted_at) {
        updateData.consent_accepted_at = now;
      }

      if (answers.age) updateData.age = parseInt(answers.age);
      if (answers.height) updateData.height = parseFloat(answers.height);
      if (answers.weight) updateData.weight = parseFloat(answers.weight);
      if (answers.height && answers.weight) {
        const heightM = parseFloat(answers.height) / 100;
        updateData.bmi = parseFloat((parseFloat(answers.weight) / (heightM * heightM)).toFixed(1));
      }

      await user.update(updateData, { transaction: t });

      // 首次完成问卷奖励积分
      if (!hasCompletedBefore) {
        await addPoints(userId, 20, 'questionnaire', '完成健康问卷', questionnaire.id, t);
      }

      // 拉新注册奖励：推荐人获得50积分（被推荐人首次完成问卷）
      if (!hasCompletedBefore && user.referrer_id) {
        await rewardReferrerForRegister(user.referrer_id, userId, t);
      }

      // 在事务内重新计算当前用户荣誉等级（避免积分已发但荣誉未更新导致数据不一致）
      await recalcHonor(user, db, t);

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    logger.info(`问卷提交成功: 用户${userId}, 风险评分${riskScore}`);

    // B5修复：事务提交后异步触发危机钩子报告生成，不阻塞响应
    // AI 调用 timeout=15s × 重试1次最坏 30s，若同步等待会远超 3s 响应时间要求
    setImmediate(async () => {
      try {
        const { generateCrisisHookReport, generate7DayPlan } = require('../services/reportGenerator');
        // 关键修复：重新查询带 answers 关联的 questionnaire
        // 上方事务中创建的 questionnaire 是裸记录，questionnaire.answers 为 undefined，
        // 直接传入会导致 buildStructuredInput 拿到空答案数组，AI 报告与用户实际问卷完全脱节
        const fullQuestionnaire = await db.Questionnaire.findByPk(questionnaire.id, {
          include: [{ model: db.QuestionnaireAnswer, as: 'answers' }]
        });
        if (!fullQuestionnaire) {
          logger.error(`问卷${questionnaire.id}重新加载失败，跳过报告生成`);
          return;
        }
        // 解析最近服务网点，用于报告"领取方式/引导到店"段落（规格4.2）
        // 解析逻辑与 routes/report.js resolveServicePoint 一致
        let servicePoint = null;
        if (user.service_provider_id) {
          const sp = await db.ServiceProvider.findByPk(user.service_provider_id);
          if (sp) servicePoint = { name: sp.name, address: sp.address, phone: sp.getDecryptedPhone() || sp.phone_masked || '' };
        }
        if (!servicePoint && user.agent_id) {
          const agent = await db.Agent.findByPk(user.agent_id, { include: [{ model: db.ServiceProvider, as: 'serviceProvider' }] });
          if (agent) {
            const sp = agent.serviceProvider;
            if (sp) servicePoint = { name: sp.name, address: sp.address, phone: sp.getDecryptedPhone() || sp.phone_masked || '' };
            else servicePoint = { name: agent.name, address: agent.address, phone: agent.phone_masked || '' };
          }
        }
        // P0修复：查重——避免与 POST /reports/generate 重复创建 crisis_hook
        // 仅在本月无 crisis_hook 时创建（非会员也查重，防止双路径重复生成）
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const existingCrisisHook = await db.Report.findOne({
          where: {
            user_id: userId,
            report_type: 'crisis_hook',
            created_at: { [db.Sequelize.Op.gte]: monthStart }
          },
          order: [['created_at', 'DESC']]
        });

        if (!existingCrisisHook) {
          const reportData = await generateCrisisHookReport(user, fullQuestionnaire, answers, { servicePoint, generateDate: new Date() });
          await db.Report.create({
            user_id: userId,
            report_type: 'crisis_hook',
            title: reportData.title,
            content: reportData.content,
            risk_score: reportData.riskScore,
            risk_level: reportData.riskLevel,
            visible_to_guest: reportData.visibleToGuest,
            ai_model: reportData.aiModel,
            ai_params: { ...reportData.aiParams, validationErrors: reportData.validationErrors, flagged: reportData.flagged },
            flagged: reportData.flagged,
            validation_errors: reportData.validationErrors,
            review_status: reportData.flagged ? 'pending' : null
          });
          logger.info(`用户${userId}危机钩子报告异步生成完成`);
        } else {
          logger.info(`用户${userId}本月已存在危机钩子报告，跳过重复生成`);
        }

        // P0修复：同时生成7天调理方案（仅会员可见，但生成时机应在问卷提交时）
        // 原 /reports/generate 端点需用户额外手动触发，与方案"AI 生成报告"设计不符
        const existing7DayPlan = await db.Report.findOne({
          where: {
            user_id: userId,
            report_type: '7day_plan',
            created_at: { [db.Sequelize.Op.gte]: monthStart }
          }
        });
        if (!existing7DayPlan) {
          try {
            const planData = await generate7DayPlan(user, fullQuestionnaire, answers);
            await db.Report.create({
              user_id: userId,
              report_type: '7day_plan',
              title: planData.title,
              content: planData.content,
              risk_score: planData.riskScore,
              risk_level: planData.riskLevel,
              visible_to_guest: planData.visibleToGuest,
              ai_model: planData.aiModel,
              ai_params: { ...planData.aiParams, validationErrors: planData.validationErrors, flagged: planData.flagged },
              flagged: planData.flagged,
              validation_errors: planData.validationErrors,
              review_status: planData.flagged ? 'pending' : null
            });
            logger.info(`用户${userId}7天调理方案异步生成完成`);
          } catch (planErr) {
            logger.error(`用户${userId}7天调理方案生成失败:`, planErr);
          }
        }
      } catch (err) {
        logger.error(`用户${userId}报告异步生成失败:`, err);
      }
    });

    // 立即返回给前端，报告在后台继续生成
    return success(res, {
      questionnaire: {
        id: questionnaire.id,
        riskScore: questionnaire.risk_score,
        riskLevel: questionnaire.risk_level,
        completed: questionnaire.completed
      }
    }, '问卷提交成功，报告正在生成中，请稍后查看');

  } catch (err) {
    logger.error('问卷提交失败:', err);
    return fail(res, '提交失败');
  }
});

/**
 * 获取问卷结果
 * GET /api/user/questionnaire/result
 */
router.get('/result', async (req, res) => {
  try {
    const questionnaire = await db.Questionnaire.findOne({
      where: { user_id: req.user.id, completed: true },
      order: [['created_at', 'DESC']],
      include: [{ model: db.QuestionnaireAnswer, as: 'answers' }]
    });

    if (!questionnaire) {
      return fail(res, '尚未完成问卷');
    }

    return success(res, { questionnaire });
  } catch (err) {
    logger.error('获取问卷结果失败:', err);
    return fail(res, '获取结果失败');
  }
});

/**
 * 计算风险评分
 */
function calculateRiskScore(answers) {
  let score = 0;

  // BMI评分
  if (answers.height && answers.weight) {
    const bmi = parseFloat(answers.weight) / ((parseFloat(answers.height) / 100) ** 2);
    if (bmi >= 28) score += 20;
    else if (bmi >= 24) score += 10;
    else if (bmi < 18.5) score += 15;
  }

  // 慢性疾病评分
  if (answers.chronic_diseases) {
    const diseases = Array.isArray(answers.chronic_diseases) ? answers.chronic_diseases : [answers.chronic_diseases];
    if (!diseases.includes('无')) {
      score += diseases.length * 10;
    }
  }

  // 饮食习惯评分
  if (answers.vegetable_intake === '很少') score += 10;
  if (answers.breakfast_habit === '从不吃' || answers.breakfast_habit === '很少吃') score += 8;

  // 运动评分
  if (answers.exercise_frequency === '从不') score += 10;
  else if (answers.exercise_frequency === '偶尔') score += 5;

  // 睡眠评分
  if (answers.sleep_quality === '很差' || answers.sleep_quality === '较差') score += 8;

  return Math.min(score, 100);
}

/**
 * 检查本月评估次数限制
 * 文档3.1：会员每月限1次免费评估；非会员用户无限制
 */
function checkAssessmentLimit(user) {
  // 非会员用户无限制
  if (!user.is_member) {
    return { allowed: true };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 如果用户没有评估记录，允许
  if (!user.last_assessment_date) {
    return { allowed: true };
  }

  const lastDate = new Date(user.last_assessment_date);
  const lastMonth = lastDate.getMonth();
  const lastYear = lastDate.getFullYear();

  // 跨月重置次数
  if (lastYear !== currentYear || lastMonth !== currentMonth) {
    return { allowed: true };
  }

  if (user.assessment_count_this_month >= 1) {
    const nextAvailableDate = new Date(currentYear, currentMonth + 1, 1);
    return {
      allowed: false,
      message: '您本月的评估次数已用完，请于下月再来',
      nextAvailableDate
    };
  }

  return { allowed: true };
}

/**
 * 检查推荐人是否已发放过邀请里程碑奖励（幂等防重）
 * @param {string} referrerId - 推荐人ID
 * @param {Transaction} t - 事务
 * @returns {Promise<boolean>}
 */
async function hasMilestoneReward(referrerId, t) {
  const existing = await db.PointsHistory.findOne({
    where: {
      user_id: referrerId,
      source: 'invite_milestone'
    },
    transaction: t
  });
  return !!existing;
}

/**
 * 奖励推荐人（被推荐人完成首评估）
 * @param {string} referrerId - 推荐人ID
 * @param {string} referredUserId - 被推荐人ID
 * @param {Transaction} t - 事务
 */
async function rewardReferrerForRegister(referrerId, referredUserId, t) {
  // 幂等防重：同一被推荐人只能触发一次 invite_register 奖励
  // 必须在事务内查询，防止并发问卷提交双发积分
  const existingReward = await db.PointsHistory.findOne({
    where: {
      user_id: referrerId,
      source: 'invite_register',
      reference_id: referredUserId
    },
    transaction: t
  });
  if (existingReward) {
    // 已奖励过，直接返回（幂等）
    return { registerPoints: 0, milestonePoints: 0, duplicated: true };
  }

  // 方案6.1：积分值从 DB 配置读取
  const inviteConfig = await getInviteConfig();

  // 发放拉新注册奖励
  const registerResult = await addPoints(
    referrerId,
    inviteConfig.register,
    'invite_register',
    '推荐新用户完成首评估',
    referredUserId,
    t
  );

  // 检查推荐人是否达到里程碑（方案3.2 Lv.5：分享N名新客户注册并完成首评估）
  // milestoneCount 从 DB 配置读取（默认2人）
  // 必须过滤身份类型，避免游客完成问卷被误算为拉新（与 honor.js getReferralCount 保持一致）
  const referralCount = await db.User.count({
    where: {
      referrer_id: referrerId,
      questionnaire_completed: true,
      identity_type: { [db.Sequelize.Op.in]: ['user', 'member'] }
    },
    transaction: t
  });

  let milestoneResult = null;
  if (referralCount >= inviteConfig.milestoneCount && !await hasMilestoneReward(referrerId, t)) {
    milestoneResult = await addPoints(
      referrerId,
      inviteConfig.milestone,
      'invite_milestone',
      `成功推荐${inviteConfig.milestoneCount}名新客户，获得健康使者奖励`,
      referredUserId,
      t
    );
  }

  // 重新计算推荐人荣誉等级（可能获得健康使者等级/拉新能手勋章）
  const referrer = await db.User.findByPk(referrerId, { transaction: t });
  if (referrer) {
    await recalcHonor(referrer, db, t);
  }

  return {
    registerPoints: registerResult.earned,
    milestonePoints: milestoneResult ? milestoneResult.earned : 0
  };
}

/**
 * 奖励推荐人（被推荐人7天活跃）
 * @param {string} referrerId - 推荐人ID
 * @param {string} referredUserId - 被推荐人ID
 */
async function rewardReferrerForActive(referrerId, referredUserId) {
  if (!referrerId || !referredUserId) return null;

  const t = await db.sequelize.transaction();
  try {
    // 检查是否已奖励过
    const existing = await db.PointsHistory.findOne({
      where: {
        user_id: referrerId,
        source: 'invite_active',
        reference_id: referredUserId
      },
      transaction: t
    });
    if (existing) {
      await t.rollback();
      return null;
    }

    // 方案6.1：积分值从 DB 配置读取
    const inviteConfig = await getInviteConfig();

    const result = await addPoints(
      referrerId,
      inviteConfig.active,
      'invite_active',
      '推荐用户连续7天活跃',
      referredUserId,
      t
    );

    await t.commit();
    return { activePoints: result.earned };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * 获取问题标签
 */
/**
 * 问题元数据：label + category（规格8.1 health_assessment 5类分组）
 * diet_habits: 饮食习惯
 * supplements: 营养补充
 * health_baseline: 健康基线
 * medical_history: 病史
 * lifestyle: 生活方式
 */
const QUESTION_META = {
  age: { label: '年龄', category: 'health_baseline' },
  gender: { label: '性别', category: 'health_baseline' },
  height: { label: '身高', category: 'health_baseline' },
  weight: { label: '体重', category: 'health_baseline' },
  chronic_diseases: { label: '慢性疾病', category: 'medical_history' },
  allergies: { label: '食物过敏', category: 'medical_history' },
  meals_per_day: { label: '每日用餐次数', category: 'diet_habits' },
  breakfast_habit: { label: '早餐习惯', category: 'diet_habits' },
  vegetable_intake: { label: '蔬菜摄入量', category: 'diet_habits' },
  staple_food: { label: '主食偏好', category: 'diet_habits' },
  taste_preference: { label: '口味偏好', category: 'diet_habits' },
  exercise_frequency: { label: '运动频率', category: 'lifestyle' },
  sleep_quality: { label: '睡眠质量', category: 'lifestyle' },
  goals: { label: '健康目标', category: 'health_baseline' },
  blood_pressure: { label: '血压情况', category: 'health_baseline' },
  blood_sugar: { label: '血糖情况', category: 'health_baseline' },
  supplements: { label: '营养补充剂', category: 'supplements' }
};

function getQuestionLabel(questionId) {
  const meta = QUESTION_META[questionId];
  return meta ? meta.label : questionId;
}

function getQuestionCategory(questionId) {
  const meta = QUESTION_META[questionId];
  return meta ? meta.category : 'diet_habits';
}

/**
 * 按规格8.1 health_assessment 结构组装问卷答案
 * @param {Array} answers - QuestionnaireAnswer 记录数组
 * @returns {Object} { diet_habits, supplements, health_baseline, medical_history, lifestyle }
 */
function buildHealthAssessment(answers) {
  const result = {
    diet_habits: {},
    supplements: {},
    health_baseline: {},
    medical_history: {},
    lifestyle: {}
  };

  answers.forEach(a => {
    const category = a.category || getQuestionCategory(a.question_id);
    let val;
    try { val = JSON.parse(a.answer); } catch (e) { val = a.answer; }
    result[category][a.question_id] = val;
  });

  return result;
}

module.exports = router;
module.exports.rewardReferrerForActive = rewardReferrerForActive;