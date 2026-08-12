// routes/report.js - 健康报告路由（危机钩子报告 + 7天调理方案）
const express = require('express');
const router = express.Router();
const db = require('../models');
const { success, fail, serverError, forbidden } = require('../utils/response');
const logger = require('../utils/logger');
const { generateCrisisHookReport, generate7DayPlan } = require('../services/reportGenerator');
const { adminOnly } = require('../middleware/auth');
const { isSameBusinessMonth, getNextBusinessMonthStart, getBusinessMonthStart } = require('../utils/date');

/**
 * 解析用户最近服务网点信息（用于危机钩子报告"领取方式/引导到店"段落，规格4.2）
 * 解析优先级：
 *  1) 用户直接绑定的服务商门店 (service_provider_id) → ServiceProvider
 *  2) 用户绑定的代理商所属服务商门店 (agent_id → Agent.serviceProvider)
 *  3) 代理商自身信息 (agent_id → Agent，电话使用脱敏号)
 *  4) 均无则返回 null（报告会显示"暂无绑定服务网点"提示）
 */
async function resolveServicePoint(user) {
  if (!user) return null;

  // 优先：用户直接绑定的服务商门店
  if (user.service_provider_id) {
    const sp = await db.ServiceProvider.findByPk(user.service_provider_id);
    if (sp) {
      return {
        name: sp.name,
        address: sp.address,
        phone: sp.getDecryptedPhone() || sp.phone_masked || ''
      };
    }
  }

  // 回退：代理商所属服务商门店
  if (user.agent_id) {
    const agent = await db.Agent.findByPk(user.agent_id, {
      include: [{ model: db.ServiceProvider, as: 'serviceProvider' }]
    });
    if (agent) {
      const sp = agent.serviceProvider;
      if (sp) {
        return {
          name: sp.name,
          address: sp.address,
          phone: sp.getDecryptedPhone() || sp.phone_masked || ''
        };
      }
      // 代理商自身（Agent 模型无解密方法，使用脱敏号）
      return {
        name: agent.name,
        address: agent.address,
        phone: agent.phone_masked || ''
      };
    }
  }

  return null;
}

/**
 * 生成报告
 * POST /api/user/reports/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user.id;

    // 检查本月是否已生成过报告（与评估次数限制一致）
    const user = await db.User.findByPk(userId);
    if (!user) {
      return fail(res, '用户不存在');
    }

    const questionnaire = await db.Questionnaire.findOne({
      where: { user_id: userId, completed: true },
      include: [{ model: db.QuestionnaireAnswer, as: 'answers' }]
    });

    if (!questionnaire) {
      return fail(res, '请先完成健康问卷');
    }

    // 组装答案
    const answers = {};
    questionnaire.answers.forEach(ans => {
      try {
        answers[ans.question_id] = JSON.parse(ans.answer);
      } catch (e) {
        answers[ans.question_id] = ans.answer;
      }
    });

    const t = await db.sequelize.transaction();
    try {
      // P1-11: 对用户行加锁，防止并发绕过每月报告限制
      await db.User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      // 会员每月限1次报告生成（事务内检查，防止并发），非会员无限制
      // 使用北京时区月度边界（避免服务器UTC时区偏移）
      if (user.is_member) {
        const monthStart = getBusinessMonthStart();
        const existingReport = await db.Report.findOne({
          where: {
            user_id: userId,
            generate_date: {
              [db.Sequelize.Op.gte]: monthStart
            }
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (existingReport) {
          await t.rollback();
          return fail(res, '本月已生成过报告，请下月再来');
        }
      }

      // 生成危机钩子报告（用户可见）
      // 解析最近服务网点，用于报告"领取方式/引导到店"段落（规格4.2）
      const servicePoint = await resolveServicePoint(user);
      const crisisReportData = await generateCrisisHookReport(user, questionnaire, answers, {
        servicePoint,
        generateDate: new Date()
      });
      const crisisReport = await db.Report.create({
        user_id: userId,
        report_type: 'crisis_hook',
        title: crisisReportData.title,
        content: crisisReportData.content,
        risk_score: crisisReportData.riskScore,
        risk_level: crisisReportData.riskLevel,
        visible_to_guest: crisisReportData.visibleToGuest,
        ai_model: crisisReportData.aiModel,
        // 复用 ai_params JSON 列持久化第4层验证结果，供后台 admin/list 筛选待复核报告（第5层入口）
        ai_params: { ...crisisReportData.aiParams, validationErrors: crisisReportData.validationErrors, flagged: crisisReportData.flagged },
        // 第5层闭环：独立列便于索引查询（flagged=true 自动进入待复核队列）
        flagged: crisisReportData.flagged,
        validation_errors: crisisReportData.validationErrors,
        review_status: crisisReportData.flagged ? 'pending' : null
      }, { transaction: t });

      // 生成7天调理方案（仅后台可见）
      const planData = await generate7DayPlan(user, questionnaire, answers);
      const planReport = await db.Report.create({
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
      }, { transaction: t });

      await t.commit();

      logger.info(`报告生成成功: 用户${userId}`);

      return success(res, {
        crisisHookReport: {
          id: crisisReport.id,
          title: crisisReport.title,
          content: crisisReport.content,
          riskScore: crisisReport.risk_score,
          riskLevel: crisisReport.risk_level,
          generateDate: crisisReport.generate_date,
          validationErrors: crisisReportData.validationErrors,
          flagged: crisisReportData.flagged
        },
        sevenDayPlan: {
          id: planReport.id,
          title: planReport.title,
          riskScore: planReport.risk_score,
          riskLevel: planReport.risk_level,
          generateDate: planReport.generate_date,
          validationErrors: planData.validationErrors,
          flagged: planData.flagged
        }
      }, '报告生成成功');
    } catch (err) {
      await t.rollback();
      throw err;
    }

  } catch (err) {
    logger.error('报告生成失败:', err);
    return serverError(res);
  }
});

/**
 * 获取用户可见的危机钩子报告
 * GET /api/user/reports/crisis-hook
 * 可见性：游客(guest)/用户(user)/会员(member) 均可见自己的 crisis_hook；
 * 代理商/服务商/管理员 可见全部（含7day_plan）。
 * 此路由仅返回当前登录用户本人的 crisis_hook 报告，按 user_id 过滤，不再按身份或 visible_to_guest 过滤。
 */
router.get('/crisis-hook', async (req, res) => {
  try {
    const report = await db.Report.findOne({
      where: {
        user_id: req.user.id,
        report_type: 'crisis_hook'
      },
      order: [['generate_date', 'DESC']]
    });

    if (!report) {
      return fail(res, '暂无报告');
    }

    return success(res, {
      id: report.id,
      title: report.title,
      content: report.content,
      riskScore: report.risk_score,
      riskLevel: report.risk_level,
      generateDate: report.generate_date
    });
  } catch (err) {
    logger.error('获取报告失败:', err);
    return serverError(res);
  }
});

/**
 * 获取7天调理方案
 * GET /api/user/reports/7day-plan/:userId
 * 可见性（按规格4.1：7天调理方案仅会员/后台可见）：
 *  - 管理员：可查看所有用户的方案
 *  - 代理商/服务商：仅可查看名下客户的方案（后台/到店查看）
 *  - 会员本人：可查看自己的方案（req.user.id === targetUserId 且 identity_type === 'member'）
 *  - 非会员 user 身份：无权查看完整方案
 */
router.get('/7day-plan/:userId', async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUser = req.user;

    // 本人查看自己的方案：按规格4.1，仅会员身份允许（user 身份不可见 7day_plan）
    // 注意：id 为 UUID 字符串，不能用 Number() 比较（会得到 NaN 永远不相等）
    const isSelfViewing = String(currentUser.id) === String(targetUserId)
      && currentUser.identity_type === 'member';

    // 权限检查：管理员可查看所有，代理商/服务商只能查看名下客户，本人可查看自己的方案
    if (!isSelfViewing && currentUser.role !== 'admin') {
      const targetUser = await db.User.findByPk(targetUserId);
      if (!targetUser) {
        return fail(res, '用户不存在');
      }
      // P0修复：原代码 targetUser.agent_id && targetUser.agent_id === currentUser.agent_id
      // 仅校验 targetUser.agent_id 为真，未校验 currentUser.agent_id。
      // 当 currentUser.agent_id 为 null 且 targetUser.agent_id 也为 null 时虽因短路安全，
      // 但当 currentUser.agent_id 为 null（JWT 缺失）而 targetUser.agent_id 为非空值时，
      // 虽不匹配但逻辑意图不明确。改为双侧都必须 truthy 才允许访问。
      const isAgent = currentUser.agent_id && targetUser.agent_id
        && targetUser.agent_id === currentUser.agent_id;
      const isProvider = currentUser.service_provider_id && targetUser.service_provider_id
        && targetUser.service_provider_id === currentUser.service_provider_id;
      if (!isAgent && !isProvider) {
        return forbidden(res, '无权查看该用户的完整方案');
      }
    }

    const report = await db.Report.findOne({
      where: {
        user_id: targetUserId,
        report_type: '7day_plan'
      },
      order: [['generate_date', 'DESC']]
    });

    if (!report) {
      return fail(res, '暂无调理方案');
    }

    return success(res, {
      id: report.id,
      title: report.title,
      content: report.content,
      riskScore: report.risk_score,
      riskLevel: report.risk_level,
      generateDate: report.generate_date
    });
  } catch (err) {
    logger.error('获取调理方案失败:', err);
    return serverError(res);
  }
});

/**
 * 会员本人查看自己的7天调理方案
 * GET /api/user/reports/my-7day-plan
 * 直接从 req.user.id 取 user_id 查询，无需传 userId 参数。
 * 按规格4.1：7天调理方案仅会员可见，非会员 user 身份无权查看（引导开通会员）。
 */
router.get('/my-7day-plan', async (req, res) => {
  try {
    // 修复：JWT payload 仅含 id/openid/role/identity_type 等基础字段，
    // 不含 is_member/last_report_view_date/report_view_count_this_month 等动态字段，
    // 必须查 DB 获取完整用户对象，否则月度次数限制完全失效
    const currentUser = await db.User.findByPk(req.user.id);
    if (!currentUser) {
      return fail(res, '用户不存在');
    }

    // 按规格4.1：仅会员身份可查看自己的完整方案
    if (currentUser.identity_type !== 'member') {
      return forbidden(res, '完整调理方案仅会员可查看，请先开通会员');
    }

    // 方案3.3：会员每月限1次查看完整报告（与评估次数独立计数）
    // 修复：原代码直接基于 JWT 旧值 +1 更新，无事务无行锁，存在竞态
    // 改为事务内对 User 行加锁后读取、判定、写回，与 /generate 路由模式一致
    const now = new Date();
    const t = await db.sequelize.transaction();
    try {
      const lockedUser = await db.User.findByPk(currentUser.id, { transaction: t, lock: t.LOCK.UPDATE });
      const lastView = lockedUser.last_report_view_date ? new Date(lockedUser.last_report_view_date) : null;
      const sameMonth = lastView && isSameBusinessMonth(lastView, now);
      if (sameMonth && (lockedUser.report_view_count_this_month || 0) >= 1) {
        await t.rollback();
        const nextAvailable = getNextBusinessMonthStart(now);
        return fail(res, `您本月查看完整报告的次数已用完，请于 ${nextAvailable.toLocaleDateString()} 后再来`);
      }
      // 次数计数（跨月重置）
      const shouldReset = !lastView || !isSameBusinessMonth(lastView, now);
      await lockedUser.update({
        last_report_view_date: now,
        report_view_count_this_month: shouldReset ? 1 : (lockedUser.report_view_count_this_month || 0) + 1
      }, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    const report = await db.Report.findOne({
      where: {
        user_id: currentUser.id,
        report_type: '7day_plan'
      },
      order: [['generate_date', 'DESC']]
    });

    if (!report) {
      return fail(res, '暂无调理方案');
    }

    return success(res, {
      id: report.id,
      title: report.title,
      content: report.content,
      riskScore: report.risk_score,
      riskLevel: report.risk_level,
      generateDate: report.generate_date
    });
  } catch (err) {
    logger.error('获取本人调理方案失败:', err);
    return serverError(res);
  }
});

/**
 * 会员下载自己的报告 PDF
 * GET /api/user/reports/download/:reportId
 * 方案3.3：报告下载每月限1次（与评估/查看次数独立计数）
 * 可见性按规格4.1：crisis_hook 所有用户可下载；7day_plan 仅会员可下载。
 */
router.get('/download/:reportId', async (req, res) => {
  try {
    // 修复：与 my-7day-plan 同理，JWT 不含 is_member/last_report_download_date 等动态字段
    const currentUser = await db.User.findByPk(req.user.id);
    if (!currentUser) {
      return fail(res, '用户不存在');
    }
    const reportId = req.params.reportId;

    // 先查询报告，再按报告类型校验可见性（避免次数先扣后失败）
    const report = await db.Report.findOne({
      where: { id: reportId, user_id: currentUser.id }
    });
    if (!report) return fail(res, '报告不存在');

    // 自助下载仅限 user/member 身份（后台走管理端路径）
    if (!['user', 'member'].includes(currentUser.identity_type)) {
      return forbidden(res, '无权下载报告');
    }
    // 按规格4.1：7天调理方案仅会员可下载，非会员 user 无权下载
    if (report.report_type === '7day_plan' && currentUser.identity_type !== 'member') {
      return forbidden(res, '完整调理方案仅会员可下载，请先开通会员');
    }

    // 方案3.3：会员每月限1次下载
    // 修复：原代码基于 JWT 旧值 +1 无事务无行锁，存在竞态；改为事务内加锁
    const now = new Date();
    const t = await db.sequelize.transaction();
    try {
      const lockedUser = await db.User.findByPk(currentUser.id, { transaction: t, lock: t.LOCK.UPDATE });
      const lastDl = lockedUser.last_report_download_date ? new Date(lockedUser.last_report_download_date) : null;
      const sameMonth = lastDl && isSameBusinessMonth(lastDl, now);
      if (sameMonth && (lockedUser.report_download_count_this_month || 0) >= 1) {
        await t.rollback();
        const nextAvailable = getNextBusinessMonthStart(now);
        return fail(res, `您本月下载报告的次数已用完，请于 ${nextAvailable.toLocaleDateString()} 后再来`);
      }
      const shouldReset = !lastDl || !isSameBusinessMonth(lastDl, now);
      await lockedUser.update({
        last_report_download_date: now,
        report_download_count_this_month: shouldReset ? 1 : (lockedUser.report_download_count_this_month || 0) + 1
      }, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // 生成简易 PDF（无外部依赖，用 HTML 文本格式返回，前端可用 wx.downloadFile 或新开 webview）
    // 真正 PDF 生成建议后续接入 pdfkit/puppeteer；这里先用纯文本报告内容作为下载内容
    const pdfContent = [
      '元生AI生态健康饮食积分系统 - 健康报告',
      '=====================================',
      `报告编号: ${report.id}`,
      `报告标题: ${report.title}`,
      `生成日期: ${report.generate_date || report.createdAt}`,
      `风险评分: ${report.risk_score}`,
      `风险等级: ${report.risk_level}`,
      '',
      '报告内容:',
      '-------------------------------------',
      typeof report.content === 'string' ? report.content : JSON.stringify(report.content, null, 2),
      '',
      '免责声明: 本报告不构成医疗诊断，请咨询专业医师。',
      '====================================='
    ].join('\n');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.txt"`);
    return res.send(pdfContent);
  } catch (err) {
    logger.error('下载报告失败:', err);
    return serverError(res);
  }
});

/**
 * 管理员：获取所有报告列表
 * GET /api/admin/reports
 */
router.get('/admin/list', adminOnly, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, reportType, userId } = req.query;
    const where = {};
    if (reportType) where.report_type = reportType;
    if (userId) where.user_id = userId;

    const { count, rows } = await db.Report.findAndCountAll({
      where,
      include: [{ model: db.User, as: 'user', attributes: ['id', 'nick_name', 'phone_masked'] }],
      order: [['generate_date', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    return success(res, { list: rows, total: count });
  } catch (err) {
    logger.error('获取报告列表失败:', err);
    return serverError(res);
  }
});

// ============================================================
// AI 第5层闭环：用户反馈（方案5.1 优化层）
// ============================================================

/**
 * 用户提交报告反馈
 * POST /api/user/reports/:id/feedback
 * body: { feedbackType: 'like'|'dislike'|'issue', issueCategory?, content? }
 *
 * 幂等：同一用户对同一报告只能提交一次反馈（DB 唯一索引兜底）
 */
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id: reportId } = req.params;
    const userId = req.user.id;
    const { feedbackType, issueCategory, content } = req.body;

    // 参数校验
    const validTypes = ['like', 'dislike', 'issue'];
    if (!validTypes.includes(feedbackType)) {
      return fail(res, 'feedbackType 必须为 like/dislike/issue');
    }
    if (feedbackType === 'issue' && !content) {
      return fail(res, '问题反馈必须填写 content');
    }
    if (content && content.length > 500) {
      return fail(res, '反馈内容不能超过 500 字');
    }

    // 校验报告存在且属于当前用户（或 admin）
    const report = await db.Report.findByPk(reportId);
    if (!report) {
      return fail(res, '报告不存在');
    }
    if (report.user_id !== userId && req.user.role !== 'admin') {
      return fail(res, '无权对此报告反馈');
    }

    // 创建反馈（唯一索引兜底重复提交）
    try {
      const feedback = await db.ReportFeedback.create({
        report_id: reportId,
        user_id: userId,
        feedback_type: feedbackType,
        issue_category: issueCategory || null,
        content: content || null
      });

      // 若用户报告"医疗越界"，自动将报告标记为 flagged + pending（即使第4层未命中）
      if (feedbackType === 'issue' && issueCategory === 'medical_redline' && !report.flagged) {
        await report.update({
          flagged: true,
          review_status: 'pending',
          validation_errors: [...(report.validation_errors || []), '[用户反馈] 疑似医疗越界']
        });
        logger.warn(`用户${userId}反馈报告${reportId}疑似医疗越界，已自动标记 flagged`);
      }

      logger.info(`用户反馈提交: report=${reportId}, type=${feedbackType}, user=${userId}`);
      return success(res, { feedbackId: feedback.id }, '反馈提交成功');
    } catch (createErr) {
      // 唯一索引冲突：用户已对此报告反馈过
      if (createErr.name === 'SequelizeUniqueConstraintError') {
        return fail(res, '您已对此报告提交过反馈');
      }
      throw createErr;
    }
  } catch (err) {
    logger.error('提交报告反馈失败:', err);
    return serverError(res);
  }
});

/**
 * 获取用户对报告的反馈（供前端展示"已反馈"状态）
 * GET /api/user/reports/:id/feedback
 */
router.get('/:id/feedback', async (req, res) => {
  try {
    const { id: reportId } = req.params;
    const userId = req.user.id;

    const feedback = await db.ReportFeedback.findOne({
      where: { report_id: reportId, user_id: userId }
    });

    return success(res, { feedback });
  } catch (err) {
    logger.error('获取报告反馈失败:', err);
    return serverError(res);
  }
});

module.exports = router;
