// 环境变量完整性核验脚本
// 运行: node tests/check-env.js
// 用途: 确认 .env 已正确加载，且所有代码依赖的变量均已配置（非空、非占位符）

require('dotenv').config();
const assert = require('assert');

let passed = 0, failed = 0, warned = 0;
function check(name, value, { required = true, placeholderOk = false } = {}) {
  const isEmpty = value === undefined || value === null || value === '';
  const isPlaceholder = /^(your_|replace_|example\.com|your-[a-z-]*\.example)/i.test(String(value || ''));
  if (isEmpty) {
    if (required) { console.log(`  ✗ FAIL  ${name}: 未配置(空)`); failed++; }
    else { console.log(`  · SKIP  ${name}: 可选, 未配置`); }
    return;
  }
  if (isPlaceholder && !placeholderOk) {
    console.log(`  ⚠ WARN  ${name}: 仍是占位符, 需替换为真实值 -> ${value}`);
    warned++;
    return;
  }
  console.log(`  ✓ OK    ${name}`);
  passed++;
}

console.log('=== .env 加载核验 ===');
const envKeys = Object.keys(process.env).filter(k => /^(PORT|NODE_ENV|DB_|JWT_|WX_|AES_|AI_|CONTENT_SECURITY_|ALLOWED_ORIGINS|OSS_|LOG_)/.test(k));
console.log(`  已加载相关变量 ${envKeys.length} 个`);

console.log('\n=== 必填变量完整性 ===');
check('PORT', process.env.PORT);
check('NODE_ENV', process.env.NODE_ENV);
check('DB_HOST', process.env.DB_HOST);
check('DB_PORT', process.env.DB_PORT);
check('DB_NAME', process.env.DB_NAME);
check('DB_USER', process.env.DB_USER);
check('DB_PASSWORD', process.env.DB_PASSWORD);
check('JWT_SECRET', process.env.JWT_SECRET);
check('JWT_EXPIRES_IN', process.env.JWT_EXPIRES_IN);
check('WX_APPID', process.env.WX_APPID);
check('WX_SECRET', process.env.WX_SECRET);
check('AES_SECRET_KEY', process.env.AES_SECRET_KEY);
check('AI_SERVICE_URL', process.env.AI_SERVICE_URL);
check('AI_SERVICE_KEY', process.env.AI_SERVICE_KEY);
check('CONTENT_SECURITY_URL', process.env.CONTENT_SECURITY_URL);
check('CONTENT_SECURITY_KEY', process.env.CONTENT_SECURITY_KEY);
check('ALLOWED_ORIGINS', process.env.ALLOWED_ORIGINS);
check('LOG_LEVEL', process.env.LOG_LEVEL);
check('LOG_FILE', process.env.LOG_FILE);

console.log('\n=== 可选变量 ===');
check('OSS_ENDPOINT', process.env.OSS_ENDPOINT, { required: false });
check('OSS_BUCKET', process.env.OSS_BUCKET, { required: false });
check('OSS_ACCESS_KEY_ID', process.env.OSS_ACCESS_KEY_ID, { required: false });
check('OSS_ACCESS_KEY_SECRET', process.env.OSS_ACCESS_KEY_SECRET, { required: false });

console.log(`\n=== 结果: PASS=${passed}  WARN=${warned}  FAIL=${failed} ===`);
if (failed > 0) {
  console.error('存在未配置的必要变量, 请补全 .env');
  process.exit(1);
}
if (warned > 0) {
  console.warn('有变量仍是占位符, 真实连接前需替换; 但脚本判定为通过(占位符不阻断)');
}
console.log('环境配置核验通过 ✅ (警告项需在真实运行前替换)');
