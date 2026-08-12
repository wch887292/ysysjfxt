// scripts/verify_vault.js (临时验证脚本，运行后可删)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'vault_verify_' + Date.now());
fs.mkdirSync(TMP, { recursive: true });
process.env.VAULT_KEY_FILE = path.join(TMP, 'vault.key');
process.env.VAULT_INSTANCE_FILE = path.join(TMP, 'instance.id');
process.env.NODE_ENV = 'production';
process.env.AES_SECRET_KEY = 'test_aes_key_32bytes_long_at_least_32_x';
const CORRECT = 'test_master_key_1234567890abcdef_32bytes';
process.env.VAULT_MASTER_KEY = CORRECT;

const vault = require(path.join(__dirname, '..', 'utils', 'secretVault'));
const { encrypt: legacyEncrypt } = require(path.join(__dirname, '..', 'utils', 'encrypt'));

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.error('  ❌', msg); }
}

console.log('1) 直接 round-trip（已知明文）');
const secret = 'DbP@ssw0rd!2026_生产库密码';
const enc = vault.encryptSecret(secret);
assert(vault.isEncrypted(enc), '密文带 ENV3: 前缀');
const dec = vault.decryptSecret(enc);
assert(dec === secret, '三重解密还原 == 原文');

console.log('2) 密钥独立性：K1(VAULT_MASTER_KEY) 错误必须解密失败');
vault._resetKeyCache();
process.env.VAULT_MASTER_KEY = 'WRONG_KEY_different________';
let failed = false;
try { vault.decryptSecret(enc); } catch (e) { failed = true; }
assert(failed, '错误 K1 → 解密抛错（无单钥可解密）');
process.env.VAULT_MASTER_KEY = CORRECT;
vault._resetKeyCache();
assert(vault.decryptSecret(enc) === secret, '恢复正确 K1 → 解密成功');

console.log('3) 向后兼容：旧单层 AES-256-GCM 密文仍可解密');
const legacy = legacyEncrypt('legacy-secret-123');
assert(vault.decryptSecret(legacy) === 'legacy-secret-123', '旧密文经 vault 解密一致');

console.log('4) 真实 .env 全量密钥字段 round-trip（仅临时目录，不碰生产 .env）');
const realEnv = path.join(__dirname, '..', '.env');
const lines = fs.readFileSync(realEnv, 'utf8').split(/\r?\n/);
let secretCount = 0;
for (const line of lines) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const key = m[1];
  let val = m[2].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (/secret|password|key|token/i.test(key)) {
    const e = vault.encryptSecret(val);
    const d = vault.decryptSecret(e);
    assert(d === val, `字段 ${key} 还原一致`);
    secretCount++;
  }
}
console.log(`   共校验 ${secretCount} 个密钥字段`);

console.log('5) 集成：encrypt-env.js → .env.enc → decrypt-env.js');
const encFile = path.join(TMP, '.env.enc');
const outFile = path.join(TMP, '.env.out');
const { execSync } = require('child_process');
const node = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe';
execSync(`"${node}" "${path.join(__dirname, 'encrypt-env.js')}" "${realEnv}" "${encFile}"`, { stdio: 'ignore', env: process.env });
execSync(`"${node}" "${path.join(__dirname, 'decrypt-env.js')}" "${encFile}" "${outFile}"`, { stdio: 'ignore', env: process.env });
const outLines = fs.readFileSync(outFile, 'utf8').split(/\r?\n/);
let integOk = 0;
for (const line of outLines) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const key = m[1];
  let val = m[2];
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (/secret|password|key|token/i.test(key)) {
    // 在真实 .env 中找到对应原始值比对
    const orig = lines.find(l => l.startsWith(key + '='));
    let oval = orig ? orig.slice(key.length + 1).trim() : '';
    if (oval.startsWith('"') && oval.endsWith('"')) oval = oval.slice(1, -1);
    if (val === oval) integOk++; else { fail++; console.error('  ❌ 集成字段不一致:', key); }
  }
}
assert(integOk === secretCount, `集成还原 ${integOk}/${secretCount} 个密钥字段全部一致`);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
