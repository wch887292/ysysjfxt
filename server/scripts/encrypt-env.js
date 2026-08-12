// scripts/encrypt-env.js
// 将明文 .env 三重加密为 .env.enc（仅持三把密钥者可还原）
//
// 用法：
//   VAULT_MASTER_KEY=<生产注入的32+位密钥> node scripts/encrypt-env.js [输入.env] [输出.env.enc]
//
// 说明：
//   - 三把密钥：VAULT_MASTER_KEY(部署注入) + keys/vault.key(自动生成0600) + 机器指纹
//   - 不传参数时默认读 .env 输出 .env.enc
//   - 非生产且未设 VAULT_MASTER_KEY 时使用 dev 回退密钥（切勿用于真实生产凭据）
'use strict';

const fs = require('fs');
const path = require('path');
const vault = require('../utils/secretVault');

const input = process.argv[2] || path.join(__dirname, '..', '.env');
const output = process.argv[3] || path.join(__dirname, '..', '.env.enc');

if (!process.env.VAULT_MASTER_KEY && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️ 未设置 VAULT_MASTER_KEY 且非生产环境，将使用 dev 回退密钥（不可用于真实生产凭据）');
}
if (process.env.NODE_ENV === 'production' && !process.env.VAULT_MASTER_KEY) {
  console.error('❌ 生产环境必须设置 VAULT_MASTER_KEY 后再加密 .env');
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error('❌ 输入文件不存在:', input);
  process.exit(1);
}

const content = fs.readFileSync(input, 'utf8');
const lines = content.split(/\r?\n/);
const out = [];
let count = 0;

for (const line of lines) {
  if (/^\s*#/.test(line) || line.trim() === '') {
    out.push(line); // 保留注释与空行
    continue;
  }
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) {
    out.push(line);
    continue;
  }
  const key = m[1];
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  // 仅加密"疑似密钥/密码"的字段（含 SECRET/PASSWORD/KEY/TOKEN 关键字的变量）
  if (/secret|password|key|token/i.test(key)) {
    const enc = vault.encryptSecret(val);
    out.push(`${key}=${enc}`);
    count++;
  } else {
    out.push(line); // 非敏感字段保持明文（如 PORT/DB_HOST/TZ）
  }
}

fs.writeFileSync(output, out.join('\n') + '\n', { mode: 0o600 });
console.log(`✅ 已将 ${count} 项密钥三重加密写入: ${output}`);
console.log('   部署时请将 .env.enc 随包发布，并在运行环境注入 VAULT_MASTER_KEY；');
console.log('   确认 .env.enc 可解密后，再从服务器移除明文 .env。');
