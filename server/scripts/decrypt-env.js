// scripts/decrypt-env.js
// 仅持三把密钥者可还原 .env.enc 为明文（用于运维排查，输出到屏幕或 .env.decrypted）
//
// 用法：
//   VAULT_MASTER_KEY=<同加密时注入的密钥> node scripts/decrypt-env.js [输入.env.enc] [输出文件?]
//
// 安全：解密结果含明文凭据，请勿提交、勿留存于生产服务器；查看后及时删除输出文件。
'use strict';

const fs = require('fs');
const path = require('path');
const vault = require('../utils/secretVault');

const input = process.argv[2] || path.join(__dirname, '..', '.env.enc');
const output = process.argv[3] || null;

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
    out.push(line);
    continue;
  }
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) {
    out.push(line);
    continue;
  }
  const key = m[1];
  let val = m[2].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (vault.isEncrypted(val)) {
    try {
      const dec = vault.decryptSecret(val);
      out.push(`${key}=${dec}`);
      count++;
    } catch (e) {
      out.push(`${key}=<解密失败: ${e.message}>`);
    }
  } else {
    out.push(line);
  }
}

const text = out.join('\n') + '\n';
if (output) {
  fs.writeFileSync(output, text, { mode: 0o600 });
  console.log(`✅ 已解密 ${count} 项到: ${output}（含明文，请妥善保管并及时删除）`);
} else {
  console.log(`✅ 解密结果（共 ${count} 项密钥，含明文）：\n`);
  console.log(text);
}
