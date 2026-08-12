'use strict';
/**
 * 饮食积分系统 · 模拟测试（免 DB / 免网络）
 * 覆盖：鉴权链路、路由崩溃修复、AI 第4层医疗红线检测、
 *       以及防"修复回退"的源码级回归断言（打卡超标 / 流失预警去重 / 核销幂等 / AI safeGenerate）。
 * 运行：在 server/ 目录下 `node tests/sim-smoke.test.js`
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const req = (rel) => require(path.join(ROOT, rel));

let pass = 0, fail = 0;
const log = [];
function test(name, fn) {
  try { fn(); pass++; log.push('  PASS  ' + name); }
  catch (e) { fail++; log.push('  FAIL  ' + name + '  ->  ' + e.message); }
}

// ===================== 运行时断言（免 DB） =====================

test('[修复2] auth.EFFECTIVE_JWT_SECRET 已导出且非空', () => {
  const auth = req('middleware/auth');
  assert.strictEqual(typeof auth.EFFECTIVE_JWT_SECRET, 'string');
  assert.ok(auth.EFFECTIVE_JWT_SECRET.length > 0, '密钥不应为空');
});

test('[修复2] generateToken 生成的令牌可被 EFFECTIVE_JWT_SECRET 验证（/validate 不再永远失败）', () => {
  const auth = req('middleware/auth');
  const token = auth.generateToken({ id: 1, openid: 'oX', role: 'user', agent_id: null, service_provider_id: null });
  const decoded = jwt.verify(token, auth.EFFECTIVE_JWT_SECRET);
  assert.strictEqual(decoded.id, 1);
  assert.strictEqual(decoded.role, 'user');
});

test('[修复1] routes/points 导出 { router, addPoints, deductPoints }（对象误当中间件已修复）', () => {
  const pts = req('routes/points');
  assert.strictEqual(typeof pts.router, 'function', 'router 应为函数');
  assert.strictEqual(typeof pts.addPoints, 'function', 'addPoints 应为函数');
  assert.strictEqual(typeof pts.deductPoints, 'function', 'deductPoints 应为函数');
});

['routes/clockIn', 'routes/agent', 'routes/points', 'services/reportGenerator', 'utils/honor', 'models/PointsWriteOff']
  .forEach((m) => {
    test('模块加载冒烟: ' + m, () => { req(m); });
  });

test('[第4层] checkSensitiveWords 命中医疗红线', () => {
  const rg = req('services/reportGenerator');
  const hit = rg.checkSensitiveWords('本品可治愈糖尿病并为您开具处方');
  assert.ok(Array.isArray(hit) && hit.length > 0, '应检测到违规内容');
});

test('[第4层] checkSensitiveWords 正常饮食建议不报错', () => {
  const rg = req('services/reportGenerator');
  const ok = rg.checkSensitiveWords('建议每日增加蔬菜与优质蛋白摄入，保持规律作息');
  assert.strictEqual(ok.length, 0, '正常建议不应触发红线');
});

// ===================== 源码级回归断言（防修复被悄悄回退） =====================

const clockInSrc = read('routes/clockIn.js');
test('[修复·打卡超标] 已删除蔬菜/水果/水加成', () => {
  assert.ok(!/vegetable:\s*\d/.test(clockInSrc), '仍存在蔬菜加成');
  assert.ok(!/fruit:\s*\d/.test(clockInSrc), '仍存在水果加成');
  assert.ok(!/water:\s*\d/.test(clockInSrc), '仍存在水加成');
});
test('[方案6.1] 打卡基础分 icon=10、遵循计划 followPlan=20、每日上限=3（已迁移至 DB 配置）', () => {
  // 验证兜底默认值（DB 配置缺失时使用，与方案6.1 一致）
  const icon = clockInSrc.match(/icon:\s*(\d+)/);
  const fp = clockInSrc.match(/followPlan:\s*(\d+)/);
  const lim = clockInSrc.match(/FALLBACK_DAILY_LIMIT\s*=\s*(\d+)/);
  assert.ok(icon && Number(icon[1]) === 10, 'icon 兜底值应为 10');
  assert.ok(fp && Number(fp[1]) === 20, 'followPlan 兜底值应为 20');
  assert.ok(lim && Number(lim[1]) === 3, 'FALLBACK_DAILY_LIMIT 兜底值应为 3');
  // 验证已迁移至 configCache（方案6.1 "后台可配"，防止回退为硬编码）
  assert.ok(/configCache\.get/.test(clockInSrc), '应通过 configCache.get 读取配置');
  assert.ok(/clock_in\.daily_limit/.test(clockInSrc), '应读取 clock_in.daily_limit 配置键');
});

const jobSrc = read('scripts/inactive-alert-job.js');
test('[修复·流失预警] system 分支已加当日去重守卫', () => {
  assert.ok(/hasAlertedToday\([^)]*['"]system['"]/.test(jobSrc), 'system 分支缺去重守卫');
});

const agentSrc = read('routes/agent.js');
test('[修复·核销幂等] 三层防护已落地（行锁 + 幂等键 + 唯一冲突回查）', () => {
  assert.ok(/LOCK\.UPDATE/.test(agentSrc), '缺行锁 LOCK.UPDATE');
  assert.ok(/idempotency_key/.test(agentSrc), '缺 idempotency_key 列');
  assert.ok(/SequelizeUniqueConstraintError/.test(agentSrc), '缺唯一约束冲突回查');
});

const rgSrc = read('services/reportGenerator.js');
test('[修复·AI第4层] safeGenerate 重试 + flagged 标记已落地', () => {
  assert.ok(/async function safeGenerate/.test(rgSrc), '缺 safeGenerate');
  assert.ok(/flagged/.test(rgSrc), '缺 flagged 标记');
});

// ===================== 规格15.1 违禁词库回归（防误伤 + 防漏检） =====================

test('[规格15.1] 免责声明A（表单首页）不触发红线', () => {
  const rg = req('services/reportGenerator');
  const A = '本问卷信息仅用于制定个性化饮食与生活方式建议，不构成任何医疗诊断、治疗或处方。所有健康决策请咨询专业医师。我们承诺对您的信息严格保密。';
  assert.strictEqual(rg.checkSensitiveWords(A).length, 0, '表单首页声明被误伤');
});

test('[规格15.1] 免责声明B（危机钩子报告）不触发红线', () => {
  const rg = req('services/reportGenerator');
  const B = '本报告为饮食健康风险评估，基于您提供的信息进行 AI 分析生成。报告结果仅供参考，不作为疾病诊断依据。如需详细解读，请咨询服务商或专业医师。';
  assert.strictEqual(rg.checkSensitiveWords(B).length, 0, '危机钩子报告声明被误伤');
});

test('[规格15.1] 免责声明C（7天调理方案）不触发红线', () => {
  const rg = req('services/reportGenerator');
  const C = '本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。方案仅用于促进健康饮食调整，不作为疾病治疗依据。在采纳任何建议前，尤其涉及健康问题时，请务必咨询专业医师。';
  assert.strictEqual(rg.checkSensitiveWords(C).length, 0, '7天方案声明被误伤');
});

test('[规格15.1] 组装后的危机钩子报告全文（含声明B）不触发红线', () => {
  const rg = req('services/reportGenerator');
  // 模拟 assembleCrisisHookContent 组装后的完整文本（含免责声明 + 正文章节）
  const full = '# 饮食健康风险评估报告\n\n## ⚠️ 重要提示\n本报告为饮食健康风险评估，基于您提供的信息进行 AI 分析生成。报告结果仅供参考，不作为疾病诊断依据。如需详细解读，请咨询服务商或专业医师。\n\n## 一、您的饮食健康现状\n您的饮食习惯存在一定可改善空间。\n\n## 四、改善建议概述\n增加蔬菜和全谷物摄入，减少高油高盐食物。\n\n**再次提醒：** 本报告为饮食健康风险评估，不作为疾病诊断依据。';
  assert.strictEqual(rg.checkSensitiveWords(full).length, 0, '组装后危机钩子报告被误伤');
});

// 各分类违禁词必须被检出（防漏检 / 防回退）
test('[规格15.1·诊断类] 确诊/判定为/患有...病 均被检出', () => {
  const rg = req('services/reportGenerator');
  assert.ok(rg.checkSensitiveWords('已确诊为糖尿病').length > 0, '漏检"确诊"');
  assert.ok(rg.checkSensitiveWords('判定为高血压').length > 0, '漏检"判定为"');
  assert.ok(rg.checkSensitiveWords('您患有糖尿病').length > 0, '漏检"患有...病"');
  assert.ok(rg.checkSensitiveWords('诊断为脂肪肝').length > 0, '漏检"诊断为"');
});

test('[规格15.1·治疗类] 治愈/根治/疗效/药效/处方/治疗疾病 均被检出', () => {
  const rg = req('services/reportGenerator');
  assert.ok(rg.checkSensitiveWords('7天治愈糖尿病').length > 0, '漏检"治愈"');
  assert.ok(rg.checkSensitiveWords('根治您的胃病').length > 0, '漏检"根治"');
  assert.ok(rg.checkSensitiveWords('本方案疗效显著').length > 0, '漏检"疗效"');
  assert.ok(rg.checkSensitiveWords('药效非常好').length > 0, '漏检"药效"');
  assert.ok(rg.checkSensitiveWords('为您开具处方').length > 0, '漏检"处方"');
  assert.ok(rg.checkSensitiveWords('可治疗糖尿病等疾病').length > 0, '漏检"治疗疾病"');
});

test('[规格15.1·医疗行为] 停药/换药/减药/代替药物/替代治疗 均被检出', () => {
  const rg = req('services/reportGenerator');
  assert.ok(rg.checkSensitiveWords('建议您停药').length > 0, '漏检"停药"');
  assert.ok(rg.checkSensitiveWords('可以换药').length > 0, '漏检"换药"');
  assert.ok(rg.checkSensitiveWords('自行减药').length > 0, '漏检"减药"');
  assert.ok(rg.checkSensitiveWords('可代替药物使用').length > 0, '漏检"代替药物"');
  assert.ok(rg.checkSensitiveWords('作为替代治疗').length > 0, '漏检"替代治疗"');
});

test('[规格15.1·效果承诺] guaranteed/百分百/必然.../一定会.../保证...天/肯定... 均被检出', () => {
  const rg = req('services/reportGenerator');
  assert.ok(rg.checkSensitiveWords('guaranteed results').length > 0, '漏检"guaranteed"');
  assert.ok(rg.checkSensitiveWords('百分百有效').length > 0, '漏检"百分百"');
  assert.ok(rg.checkSensitiveWords('必然改善您的体质').length > 0, '漏检"必然..."');
  assert.ok(rg.checkSensitiveWords('一定会好转').length > 0, '漏检"一定会..."');
  assert.ok(rg.checkSensitiveWords('保证7天见效').length > 0, '漏检"保证...天"');
  assert.ok(rg.checkSensitiveWords('肯定能治愈').length > 0, '漏检"肯定..."');
});

test('[规格15.1·恐吓性] 致命/会死/病情恶化/您...严重危险 均被检出', () => {
  const rg = req('services/reportGenerator');
  assert.ok(rg.checkSensitiveWords('这是致命的').length > 0, '漏检"致命"');
  assert.ok(rg.checkSensitiveWords('再这样会死').length > 0, '漏检"会死"');
  assert.ok(rg.checkSensitiveWords('病情会恶化').length > 0, '漏检"病情恶化"');
  assert.ok(rg.checkSensitiveWords('您的情况很严重很危险').length > 0, '漏检"您...严重/危险"');
});

test('[规格15.1·防误伤] 合理表述"严重缺乏""防止恶化"不触发红线', () => {
  const rg = req('services/reportGenerator');
  // "严重缺乏"不含"您/你...严重"，不应触发；"防止恶化"无"病情/情况"前缀，不应触发
  assert.strictEqual(rg.checkSensitiveWords('您的膳食纤维严重缺乏').length, 0, '"严重缺乏"被误伤');
  assert.strictEqual(rg.checkSensitiveWords('建议规律作息以防止恶化').length, 0, '"防止恶化"被误伤');
});

// assemble7DayPlanContent：确定性追加 + 幂等
test('[规格15.1] assemble7DayPlanContent 缺免责声明时确定性追加', () => {
  const rg = req('services/reportGenerator');
  const out = rg.assemble7DayPlanContent('# 7天方案\n\n第1天：多吃蔬菜');
  assert.ok(out.includes('不能替代任何医疗诊断、治疗及医嘱'), '未追加 mandated 免责声明');
  assert.ok(out.includes('不作为疾病治疗依据'), '免责声明不完整');
  assert.ok(out.includes('请务必咨询专业医师'), '免责声明不完整');
});

test('[规格15.1] assemble7DayPlanContent 已含免责声明时不重复追加（幂等）', () => {
  const rg = req('services/reportGenerator');
  const withDisclaimer = '# 7天方案\n\n本方案为饮食与生活方式建议，不能替代任何医疗诊断、治疗及医嘱。方案仅用于促进健康饮食调整，不作为疾病治疗依据。在采纳任何建议前，尤其涉及健康问题时，请务必咨询专业医师。';
  const out = rg.assemble7DayPlanContent(withDisclaimer);
  const count = (out.match(/不能替代任何医疗诊断、治疗及医嘱/g) || []).length;
  assert.strictEqual(count, 1, '免责声明被重复追加，破坏幂等性');
});

console.log('\n========== 饮食积分系统 · 模拟测试 ==========');
console.log(log.join('\n'));
console.log('\n结果：通过 ' + pass + ' / 失败 ' + fail + '\n');
process.exit(fail > 0 ? 1 : 0);
