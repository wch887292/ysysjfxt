// services/reportGenerator.js - 健康报告生成服务
const axios = require('axios');
const logger = require('../utils/logger');

// 环境变量默认值（DB配置优先，环境变量兜底）
const ENV_AI_URL = process.env.AI_SERVICE_URL;
const ENV_AI_KEY = process.env.AI_SERVICE_KEY;
const ENV_AI_MODEL = process.env.AI_MODEL || 'doubao-pro-32k';

/**
 * 获取AI文本模型配置（优先从SystemConfig读取，回退环境变量）
 */
async function getTextAIConfig() {
  try {
    const db = require('../models');
    const configCache = require('../utils/configCache');
    const settings = require('../routes/admin').SYSTEM_SETTINGS_SCHEMA || {};

    // 尝试从 system_settings 读取（加密的敏感字段需解密）
    const textUrl = await getSettingValue(db, 'ai_text.service_url');
    const textKey = await getSettingValue(db, 'ai_text.service_key');
    const textModel = await getSettingValue(db, 'ai_text.model');

    return {
      url: textUrl || ENV_AI_URL,
      key: textKey || ENV_AI_KEY,
      model: textModel || ENV_AI_MODEL
    };
  } catch {
    return { url: ENV_AI_URL, key: ENV_AI_KEY, model: ENV_AI_MODEL };
  }
}

/**
 * 从 SystemConfig 读取配置值（敏感字段解密）
 */
async function getSettingValue(db, key) {
  const row = await db.SystemConfig.findOne({ where: { config_key: key } });
  if (!row) return null;
  // 敏感字段加密存储，需解密
  const schema = require('../routes/admin').SYSTEM_SETTINGS_SCHEMA || {};
  const def = schema[key];
  if (def && def.sensitive) {
    try {
      const { decrypt } = require('../utils/encrypt');
      return decrypt(row.config_value);
    } catch {
      return null;
    }
  }
  return row.config_value;
}

// 医疗红线违禁词（规格5.5：仅使用带上下文的正则规则，避免裸词误伤合规免责声明）
// 注意：不得使用裸词列表（如 '诊断'/'治疗'），否则会误伤规格 mandated 的免责声明
// "不作为疾病诊断依据"、"不能替代任何医疗诊断、治疗及医嘱" 等合法表述。
// 每条 pattern 均已验证不会匹配以下 3 条 mandated 免责声明：
//   (A) "不构成任何医疗诊断、治疗或处方"
//   (B) "不作为疾病诊断依据"
//   (C) "不能替代任何医疗诊断、治疗及医嘱"
const FORBIDDEN_PATTERNS = [
  // 诊断类
  { pattern: /确诊/, message: '禁止使用"确诊"表述' },
  { pattern: /判定为/, message: '禁止使用"判定为"表述' },
  { pattern: /患有.{0,10}(?:病|症|炎|癌|瘤)/, message: '禁止使用"患有..."诊断表述' },
  { pattern: /诊断为|诊断结果为/, message: '禁止使用"诊断为"表述' },
  // "病史"仅匹配肯定性诊断表述（您的/你的/有...病史），不匹配"既往病史"等中性问询
  { pattern: /(?:您的|你的|有).{0,6}病史/, message: '禁止使用"病史"诊断表述' },
  // 治疗类（不含裸词"治疗"，会误伤免责声明 C"不能替代...治疗"）
  { pattern: /治愈/, message: '禁止使用"治愈"表述' },
  { pattern: /根治/, message: '禁止使用"根治"表述' },
  { pattern: /疗效/, message: '禁止使用"疗效"表述' },
  { pattern: /药效/, message: '禁止使用"药效"表述' },
  // "用药"仅匹配肯定性医疗建议（建议/推荐/需要...用药），不匹配"用药指导"等中性表述
  { pattern: /(?:建议|推荐|需要|应当|应该).{0,4}用药/, message: '禁止使用"建议用药"表述' },
  // "处方"仅匹配肯定性医疗行为（开具/开处方/处方药），不匹配免责声明 A 的"治疗或处方"否定列举
  { pattern: /(?:开具|开).{0,4}处方|处方药/, message: '禁止使用"处方"表述' },
  { pattern: /治疗.{0,4}疾病/, message: '禁止使用"治疗疾病"表述' },
  // 医疗行为（不含"替代治疗"裸匹配，会误伤免责声明 C"不能替代...治疗"）
  { pattern: /停药/, message: '禁止使用"停药"表述' },
  { pattern: /换药/, message: '禁止使用"换药"表述' },
  { pattern: /减药/, message: '禁止使用"减药"表述' },
  { pattern: /代替.{0,6}药物/, message: '禁止使用"代替药物"表述' },
  { pattern: /替代治疗/, message: '禁止使用"替代治疗"表述' },
  // 效果承诺（用 {0,N} 限定跨度，避免跨句误匹配）
  { pattern: /guaranteed/i, message: '禁止使用"guaranteed"表述' },
  { pattern: /百分百/, message: '禁止使用"百分百"表述' },
  { pattern: /必然.{0,6}(?:改善|好转|有效|治愈)/, message: '禁止使用"必然..."绝对化表述' },
  { pattern: /一定会.{0,6}(?:改善|好转|治愈|有效)/, message: '禁止使用"一定会..."绝对化表述' },
  { pattern: /保证.{0,8}天(?:好转|改善|见效)/, message: '禁止承诺效果' },
  { pattern: /肯定.{0,6}(?:改善|好转|治愈|有效)/, message: '禁止使用"肯定..."绝对化表述' },
  // 恐吓性词汇（用上下文模式避免误伤"严重缺乏""防止恶化"等合理表述）
  // "严重/危险"必须紧邻病情/情况/症状才视为恐吓，避免误伤"严重缺乏""严重不足"等营养学合理表述
  { pattern: /致命/, message: '禁止使用"致命"恐吓性表述' },
  { pattern: /会死/, message: '禁止使用"会死"恐吓性表述' },
  { pattern: /(?:病情|情况|症状).{0,6}(?:恶化|加重)/, message: '禁止使用恐吓性"恶化"表述' },
  { pattern: /(?:病情|情况|症状).{0,6}(?:严重|危险)/, message: '禁止使用"...严重/危险"恐吓性表述' }
];

// ============================================================
// 违禁词库动态加载（方案5.5：硬编码基线 + DB 可维护规则）
// ============================================================
//
// 设计原则：
//   1. FORBIDDEN_PATTERNS（上方硬编码）= 合规基线，不可通过后台删除/禁用
//      这些规则经过精心设计，不会误伤 mandated 免责声明 A/B/C
//   2. DB forbidden_words 表 = 运营/合规团队通过后台维护的额外规则
//      可随时增删，用于应对新出现的违规表述，无需发版
//   3. 实际校验时 = 硬编码基线 ∪ DB active 规则（并集）
//   4. DB 异常或未加载时，仅使用硬编码基线，保证服务可用
//
// 缓存策略（与 promptCache 一致）：
//   - 模块加载时 fire-and-forget 触发首次加载
//   - admin 增删改违禁词后调用 invalidateForbiddenCache() 失效
//   - 下次 checkSensitiveWords 调用时重新加载

let forbiddenCache = { compiled: null, expireAt: 0 };
const FORBIDDEN_CACHE_TTL_MS = 60 * 1000;

/**
 * 从 DB 加载 active 违禁词规则并编译为 RegExp
 * @returns {Promise<Array<{pattern: RegExp, message: string, source: string}>>}
 */
async function loadForbiddenPatternsFromDB() {
  try {
    const db = require('../models');
    const words = await db.ForbiddenWord.findAll({
      where: { status: 'active' },
      attributes: ['pattern', 'message', 'category'],
      raw: true
    });

    const compiled = [];
    for (const w of words) {
      try {
        compiled.push({
          pattern: new RegExp(w.pattern),
          message: w.message,
          source: 'db'
        });
      } catch (e) {
        // 单条规则编译失败不阻塞整体，记录日志即可
        logger.warn(`违禁词规则编译失败，已跳过: pattern=${w.pattern}, error=${e.message}`);
      }
    }
    return compiled;
  } catch (err) {
    logger.warn('从 DB 加载违禁词库失败，仅使用硬编码基线:', err.message);
    return [];
  }
}

/**
 * 获取当前生效的违禁词规则（硬编码基线 + DB active 规则）
 * 优先使用缓存，缓存失效时重新加载
 * @returns {Promise<Array>}
 */
async function getEffectiveForbiddenPatterns() {
  const now = Date.now();
  if (forbiddenCache.compiled && forbiddenCache.expireAt > now) {
    return forbiddenCache.compiled;
  }

  const dbPatterns = await loadForbiddenPatternsFromDB();
  // 硬编码基线标记 source='baseline'，便于审计
  const baseline = FORBIDDEN_PATTERNS.map(p => ({ ...p, source: 'baseline' }));
  const merged = [...baseline, ...dbPatterns];

  forbiddenCache = { compiled: merged, expireAt: now + FORBIDDEN_CACHE_TTL_MS };
  return merged;
}

/**
 * 失效违禁词缓存（admin 增删改违禁词后调用）
 */
function invalidateForbiddenCache() {
  forbiddenCache = { compiled: null, expireAt: 0 };
  logger.info('违禁词库缓存已失效，下次校验将重新加载');
}

// 模块加载时 fire-and-forget 预热违禁词缓存
// 不阻塞模块导出，失败时 checkSensitiveWords 会降级到硬编码基线
getEffectiveForbiddenPatterns().catch(() => { /* 忽略，降级到硬编码 */ });

/**
 * 生成报告并执行第4层自动验证
 * 流程：生成 → 敏感词/医疗红线校验 → 命中则自动重试一次（优先采用违规更少的结果）
 *        → 仍命中则标记 flagged=true，供后台人工审核闭环（第5层）
 */
async function safeGenerate(buildPromptFn, user, questionnaire, answers) {
  const systemPrompt = await buildSystemPrompt();
  const userPrompt = buildPromptFn(user, questionnaire, answers);

  // 加载当前生效的违禁词规则（硬编码基线 + DB active 规则，带缓存）
  const effectivePatterns = await getEffectiveForbiddenPatterns();

  let content = await callAIModel(systemPrompt, userPrompt);
  let validationErrors = checkSensitiveWords(content, effectivePatterns);

  // 第4层处置：命中医疗红线时自动重试一次，洗掉偶发红线表述（如模型顺口说"疗效"）
  if (validationErrors.length > 0) {
    const retryContent = await callAIModel(systemPrompt, userPrompt);
    const retryErrors = checkSensitiveWords(retryContent, effectivePatterns);
    if (retryErrors.length < validationErrors.length) {
      content = retryContent;
      validationErrors = retryErrors;
    }
  }

  // flagged=true 表示经重试仍命中红线，需进入人工审核（第5层），不可直接当作终稿放行
  return {
    content,
    validationErrors,
    flagged: validationErrors.length > 0
  };
}

/**
 * 生成危机钩子报告（简版，用户可见）
 * 按规格4.2组装完整结构：表头 + ⚠️重要提示 + 5个AI章节 + 领取方式(服务网点) + 再次提醒。
 * AI 仅生成正文五个章节；表头/免责声明/领取方式/服务网点由外层组装，
 * 确保结构稳定且服务网点为真实绑定数据而非AI编造。
 * @param {Object} user 用户对象
 * @param {Object} questionnaire 问卷对象
 * @param {Object} answers 答案
 * @param {Object} context 报告上下文 { servicePoint, generateDate }
 */
async function generateCrisisHookReport(user, questionnaire, answers, context = {}) {
  const { servicePoint = null, generateDate = new Date() } = context;
  const { content: aiContent, validationErrors, flagged } = await safeGenerate(buildCrisisHookPrompt, user, questionnaire, answers);

  const content = assembleCrisisHookContent({
    customerName: user.real_name || user.nick_name || '尊敬的客户',
    generateDate: formatDateForReport(generateDate),
    aiContent,
    servicePoint
  });

  return {
    title: '饮食健康风险评估报告',
    content,
    riskScore: questionnaire.risk_score,
    riskLevel: questionnaire.risk_level,
    visibleToGuest: true,
    aiModel: (await getTextAIConfig()).model,
    // 第3层参数完整记录（与 callAIModel 实际调用一致），便于审计与第5层 Prompt 迭代
    aiParams: { temperature: 0.3, top_p: 0.8, top_k: 40, max_tokens: 2000, presence_penalty: 0.2, frequency_penalty: 0.3 },
    validationErrors,
    flagged
  };
}

/**
 * 生成7天调理方案（完整版，仅后台/到店可见）
 * 规格15.1：7天方案 mandated 免责声明由外层 assemble7DayPlanContent 确定性追加，
 * 不依赖 AI 自觉输出（LLM 应用安全原则：不信任模型会遵循策略，需在 sink 前确定性校验）。
 */
async function generate7DayPlan(user, questionnaire, answers) {
  const { content: aiContent, validationErrors, flagged } = await safeGenerate(build7DayPlanPrompt, user, questionnaire, answers);

  const content = assemble7DayPlanContent(aiContent);

  return {
    title: '7天饮食与生活方式调理方案',
    content,
    riskScore: questionnaire.risk_score,
    riskLevel: questionnaire.risk_level,
    visibleToGuest: false,
    aiModel: (await getTextAIConfig()).model,
    aiParams: { temperature: 0.3, top_p: 0.8, top_k: 40, max_tokens: 2000, presence_penalty: 0.2, frequency_penalty: 0.3 },
    validationErrors,
    flagged
  };
}

/**
 * 构建System Prompt（角色设定与约束，规格5.3 第2层Prompt驯化）
 */
// 内置默认 System Prompt（DB 无激活版本时兜底，保证服务可用）
const DEFAULT_SYSTEM_PROMPT = `# 角色设定

你是一位拥有15年临床经验的注册营养师，擅长根据用户的饮食生活习惯分析潜在健康风险。

# 工作原则

1. **真实性原则**：只基于用户提供的真实信息分析，不编造数据
2. **个性化原则**：每个建议必须与用户具体情况直接关联
3. **谨慎性原则**：使用"可能"、"风险增加"等谨慎表述
4. **合规原则**：不做疾病诊断，不承诺治疗效果

# 禁止行为

❌ 编造用户未提供的体检数值
❌ 做出疾病诊断（如"您患有糖尿病"）
❌ 承诺治疗效果（如"7天治愈"）
❌ 使用恐吓性语言（如"会得癌症"）
❌ 使用绝对化表述（如"一定会"、"肯定"）

# 必须包含

✅ 基于用户真实数据的分析
✅ 谨慎的风险表述（"可能"、"风险增加"）
✅ 免责声明
✅ 引导到店领取完整方案的话术`;

// Prompt 缓存（60秒 TTL，避免每次生成报告都查 DB）
let promptCache = { value: null, expireAt: 0 };
const PROMPT_CACHE_TTL_MS = 60 * 1000;

/**
 * 构建系统 Prompt（方案5.1 第2层 Prompt 驯化 + 第5层 Prompt 版本管理）
 *
 * 优先从 DB 读取激活版本（admin 可在后台管理 Prompt 版本），
 * DB 异常或无激活版本时回退到内置默认 Prompt，保证服务可用。
 *
 * @returns {Promise<string>}
 */
async function buildSystemPrompt() {
  // 检查缓存
  const now = Date.now();
  if (promptCache.value && promptCache.expireAt > now) {
    return promptCache.value;
  }

  // 尝试从 DB 读取激活版本
  try {
    const db = require('../models');
    const activePrompt = await db.PromptVersion.findOne({
      where: { prompt_key: 'crisis_hook_system', status: 'active' },
      attributes: ['content'],
      raw: true
    });
    if (activePrompt && activePrompt.content) {
      promptCache = { value: activePrompt.content, expireAt: now + PROMPT_CACHE_TTL_MS };
      return activePrompt.content;
    }
  } catch (err) {
    logger.warn('从 DB 读取激活 Prompt 失败，使用默认 Prompt:', err.message);
  }

  // 回退到默认 Prompt
  promptCache = { value: DEFAULT_SYSTEM_PROMPT, expireAt: now + PROMPT_CACHE_TTL_MS };
  return DEFAULT_SYSTEM_PROMPT;
}

/**
 * 失效 Prompt 缓存（admin 激活新版本后调用）
 */
function invalidatePromptCache() {
  promptCache = { value: null, expireAt: 0 };
}

/**
 * 构建结构化用户健康数据（规格5.2 第1层输入控制）
 * 按规格5.2的结构输出，每个字段带 source 标注：
 *  - "user_provided"：用户提供的真实数据，AI 必须基于此分析
 *  - "not_provided"：用户未提供，AI 不得编造该字段的数值或状态
 *  - "system_calculated"：系统计算值（如风险评分）
 */
function buildStructuredInput(user, questionnaire) {
  const answersArray = (questionnaire && Array.isArray(questionnaire.answers)) ? questionnaire.answers : [];

  // 按问题ID查找答案（优先使用 category 字段分组，规格8.1）
  function findAnswerByQuestionId(questionId) {
    const found = answersArray.find(a => a.question_id === questionId);
    if (!found) return null;
    let val = found.answer;
    try { val = JSON.parse(val); } catch (e) { /* 保留原始字符串 */ }
    return val;
  }

  // 按问题标签关键词查找答案（向后兼容，旧数据可能无 category）
  function findAnswerByLabel(keyword) {
    const found = answersArray.find(a => a.question_label && a.question_label.includes(keyword));
    if (!found) return null;
    let val = found.answer;
    try { val = JSON.parse(val); } catch (e) { /* 保留原始字符串 */ }
    return val;
  }

  // 按分类获取所有答案（规格8.1 health_assessment 5类分组）
  function getAnswersByCategory(category) {
    return answersArray
      .filter(a => a.category === category)
      .reduce((acc, a) => {
        let val;
        try { val = JSON.parse(a.answer); } catch (e) { val = a.answer; }
        acc[a.question_id] = val;
        return acc;
      }, {});
  }

  // basic_info
  const age = user.age;
  let ageRange = '未提供';
  if (age != null && !isNaN(Number(age))) {
    const n = Number(age);
    if (n <= 30) ageRange = '18-30';
    else if (n <= 45) ageRange = '31-45';
    else if (n <= 60) ageRange = '46-60';
    else ageRange = '60+';
  }
  const name = user.real_name || user.nick_name || '未提供';
  const region = findAnswerByQuestionId('region') || findAnswerByLabel('地区') || findAnswerByLabel('城市') || findAnswerByLabel('所在地') || '未提供';

  // health_indicators（带来源标注）
  const bp = findAnswerByQuestionId('blood_pressure') || findAnswerByLabel('血压');
  const bs = findAnswerByQuestionId('blood_sugar') || findAnswerByLabel('血糖');
  const bmi = user.bmi;

  function withSource(value) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      return { status: 'unknown', value: null, source: 'not_provided' };
    }
    return { status: 'provided', value, source: 'user_provided' };
  }

  // diet_habits — 优先使用 category 分组，回退到 label 查找
  const dietHabitsByCategory = getAnswersByCategory('diet_habits');
  const stapleFood = dietHabitsByCategory.staple_food || findAnswerByLabel('主食');
  const tastePref = dietHabitsByCategory.taste_preference || findAnswerByLabel('口味');
  function toArray(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    return [String(v)];
  }

  // 按规格8.1 health_assessment 5类分组输出
  return {
    basic_info: { name, age_range: ageRange, region },
    health_indicators: {
      blood_pressure: withSource(bp),
      blood_sugar: withSource(bs),
      bmi: withSource(bmi)
    },
    diet_habits: {
      staple_food: toArray(stapleFood),
      taste_preference: toArray(tastePref),
      ...dietHabitsByCategory
    },
    health_assessment: {
      diet_habits: getAnswersByCategory('diet_habits'),
      supplements: getAnswersByCategory('supplements'),
      health_baseline: getAnswersByCategory('health_baseline'),
      medical_history: getAnswersByCategory('medical_history'),
      lifestyle: getAnswersByCategory('lifestyle')
    },
    risk_assessment: {
      risk_score: questionnaire.risk_score,
      risk_level: questionnaire.risk_level,
      source: 'system_calculated'
    }
  };
}

/**
 * 构建危机钩子报告 Prompt
 * 仅要求AI生成正文五个章节，表头/免责声明/领取方式/服务网点由外层按规格4.2组装，
 * 确保结构稳定且服务网点为真实数据而非AI编造。
 * 输入数据使用规格5.2的结构化JSON + 来源标注，杜绝AI编造未提供数据。
 */
function buildCrisisHookPrompt(user, questionnaire, answers) {
  const structuredInput = buildStructuredInput(user, questionnaire);

  return `请根据以下用户信息生成《饮食健康风险评估报告（简版）》的正文五个章节。

## 用户健康数据（结构化，带来源标注）
${JSON.stringify(structuredInput, null, 2)}

**数据来源说明：**
- \`source: "user_provided"\` 表示用户提供的真实数据，必须基于此分析
- \`source: "not_provided"\` 表示用户未提供，不得编造该字段的数值或状态
- \`source: "system_calculated"\` 表示系统计算值

## 输出要求
请严格按以下章节顺序输出，每个章节使用 Markdown 二级标题（## ）。仅输出这五个章节正文，不要输出报告标题、客户姓名、评估日期、免责声明、领取方式、服务网点地址电话、再次提醒等其他内容（这些由系统组装）。

## 一、您的饮食健康现状
（基于问卷的饮食现状分析）

## 二、潜在健康风险分析
（潜在健康风险分析）

## 三、健康影响评估
（健康影响评估）

## 四、改善建议概述
（改善建议概述）

## 五、您的专属调理方案已生成
（一句引流话术，提示完整7天调理方案已生成、需到店由专业服务商解读，不要包含具体地址电话）

注意：不要编造用户未提供的数据，不要做出疾病诊断，不要承诺治疗效果。`;
}

/**
 * 构建7天调理方案 Prompt
 * 输入数据使用规格5.2的结构化JSON + 来源标注，杜绝AI编造未提供数据。
 */
function build7DayPlanPrompt(user, questionnaire, answers) {
  const structuredInput = buildStructuredInput(user, questionnaire);

  return `请根据以下用户信息生成一份《7天饮食与生活方式调理方案（完整版）》。

## 用户健康数据（结构化，带来源标注）
${JSON.stringify(structuredInput, null, 2)}

**数据来源说明：**
- \`source: "user_provided"\` 表示用户提供的真实数据，必须基于此分析
- \`source: "not_provided"\` 表示用户未提供，不得编造该字段的数值或状态
- \`source: "system_calculated"\` 表示系统计算值

## 方案结构要求
1. 方案说明与免责声明
2. 7天每日饮食建议（早餐/午餐/晚餐/加餐）
3. 生活方式建议（运动、睡眠、饮水）
4. 注意事项
5. 后续跟进建议

注意：本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。不要编造用户未提供的数据。`;
}

/**
 * 调用AI模型
 */
async function callAIModel(systemPrompt, userPrompt) {
  try {
    const aiConfig = await getTextAIConfig();
    if (aiConfig.url && aiConfig.key) {
      const response = await axios.post(aiConfig.url, {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        top_p: 0.8,
        top_k: 40,
        max_tokens: 2000,
        presence_penalty: 0.2,
        frequency_penalty: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${aiConfig.key}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      }
      if (response.data && response.data.content) {
        return response.data.content;
      }
    }

    // 本地模拟生成
    return simulateReport(systemPrompt, userPrompt);
  } catch (err) {
    logger.error('AI报告生成失败:', err.message);
    return simulateReport(systemPrompt, userPrompt);
  }
}

/**
 * 本地模拟报告（开发/测试环境）
 * 危机钩子报告仅返回正文五个章节（表头/免责声明/领取方式由 assembleCrisisHookContent 组装）；
 * 7天调理方案返回完整方案内容。
 */
function simulateReport(systemPrompt, userPrompt) {
  // 用唯一标识区分：7天方案 Prompt 含"7天饮食与生活方式调理方案"
  const is7Day = userPrompt.includes('7天饮食与生活方式调理方案');

  if (is7Day) {
    return `# 7天饮食与生活方式调理方案\n\n## 方案说明\n根据您提供的饮食生活习惯，为您制定以下7天调理方案。本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。\n\n## 7天每日饮食建议\n- 第1天：增加蔬菜摄入，减少油腻食物\n- 第2天：规律三餐，早餐增加蛋白质\n- 第3天：晚餐提前，控制食量\n- 第4天：增加水果，减少甜食\n- 第5天：多喝水，少喝含糖饮料\n- 第6天：粗细搭配，增加全谷物\n- 第7天：总结调整，形成习惯\n\n## 生活方式建议\n- 运动：每天快走30分钟\n- 睡眠：保证7-8小时\n- 饮水：每天1500-2000ml\n\n## 注意事项\n在采纳任何建议前，尤其涉及健康问题时，请务必咨询专业医师。`;
  }

  // 危机钩子报告：仅返回正文五个章节
  return `## 一、您的饮食健康现状\n根据您提供的信息，您的饮食习惯存在一定可改善空间。\n\n## 二、潜在健康风险分析\n- 饮食结构可能不够均衡\n- 部分营养素摄入可能不足\n\n## 三、健康影响评估\n长期来看，改善饮食结构可能有助于降低部分健康风险。\n\n## 四、改善建议概述\n1. 增加蔬菜和全谷物摄入\n2. 减少高油高盐食物\n3. 规律三餐，适量运动\n\n## 五、您的专属调理方案已生成\n您的专属7天饮食调理方案已生成，请前往最近的服务网点，由专业服务商为您解读完整方案。`;
}

/**
 * 敏感词/医疗红线检查（规格5.5）
 * 校验规则 = 硬编码基线 FORBIDDEN_PATTERNS ∪ DB active 违禁词规则
 * 仅使用带上下文的正则规则，避免裸词误伤合规免责声明。
 *
 * 兼容性：若 patterns 参数未传（如外部直接调用），则同步使用硬编码基线
 *        reportGenerator 内部调用时传入 getEffectiveForbiddenPatterns() 结果
 */
function checkSensitiveWords(output, patterns = null) {
  const errors = [];

  // 未传入动态规则时，降级到硬编码基线（保证同步调用兼容性）
  const rules = patterns || FORBIDDEN_PATTERNS;

  rules.forEach(({ pattern, message }) => {
    if (pattern.test(output)) {
      errors.push(`[医疗红线] ${message}`);
    }
  });

  return errors;
}

/**
 * 格式化报告日期为 YYYY-MM-DD
 */
function formatDateForReport(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 构建服务网点信息块（用于"领取方式"段落，规格4.2 {name} {address} {phone}）
 */
function buildServicePointBlock(servicePoint) {
  if (!servicePoint) {
    return '暂无绑定服务网点，请联系您的服务商或代理商。';
  }
  const parts = [servicePoint.name, servicePoint.address, servicePoint.phone]
    .filter((v) => v && String(v).trim());
  return parts.length ? parts.join(' ') : '暂无绑定服务网点，请联系您的服务商或代理商。';
}

/**
 * 按规格4.2组装危机钩子报告完整内容
 * 结构：报告标题 → 表头(客户姓名/评估日期/报告类型) → ⚠️重要提示 → AI正文五章 →
 *       领取方式 + 最近服务网点 → 再次提醒
 */
function assembleCrisisHookContent({ customerName, generateDate, aiContent, servicePoint }) {
  return [
    '# 饮食健康风险评估报告',
    '',
    `**客户姓名：** ${customerName}  `,
    `**评估日期：** ${generateDate}  `,
    '**报告类型：** 饮食健康风险评估（简版）',
    '',
    '---',
    '',
    '## ⚠️ 重要提示',
    '',
    '本报告为饮食健康风险评估，基于您提供的信息进行 AI 分析生成。',
    '报告结果仅供参考，不作为疾病诊断依据。',
    '如需详细解读，请咨询服务商或专业医师。',
    '',
    '---',
    '',
    String(aiContent || '').trim(),
    '',
    '**领取方式：**',
    '📍 请前往最近的服务网点，由专业服务商为您解读完整方案。',
    '',
    '**最近服务网点：**',
    buildServicePointBlock(servicePoint),
    '',
    '---',
    '',
    '**再次提醒：** 本报告为饮食健康风险评估，不作为疾病诊断依据。'
  ].join('\n');
}

/**
 * 按规格15.1组装7天调理方案完整内容
 * 确定性追加 mandated 免责声明：不依赖 AI 自觉输出，避免模型遗漏导致合规缺口。
 * 幂等设计：若 AI 已包含免责声明关键句，则不重复追加，避免内容冗余。
 *
 * mandated 免责声明（规格15.1【7 天调理方案声明】）：
 * "本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。
 *  方案仅用于促进健康饮食调整，不作为疾病治疗依据。
 *  在采纳任何建议前，尤其涉及健康问题时，请务必咨询专业医师。"
 */
const SEVEN_DAY_DISCLAIMER = [
  '---',
  '',
  '**免责声明：**',
  '本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。',
  '方案仅用于促进健康饮食调整，不作为疾病治疗依据。',
  '在采纳任何建议前，尤其涉及健康问题时，请务必咨询专业医师。'
].join('\n');

function assemble7DayPlanContent(aiContent) {
  const body = String(aiContent || '').trim();
  // 幂等：AI 已包含 mandated 关键句则不再追加（避免重复免责声明）
  const hasDisclaimer = body.includes('不能替代任何医疗诊断、治疗及医嘱') &&
                       body.includes('不作为疾病治疗依据');
  return hasDisclaimer ? body : `${body}\n\n${SEVEN_DAY_DISCLAIMER}`;
}

module.exports = {
  generateCrisisHookReport,
  generate7DayPlan,
  checkSensitiveWords,
  assemble7DayPlanContent,
  invalidatePromptCache,
  invalidateForbiddenCache,
  getEffectiveForbiddenPatterns
};
