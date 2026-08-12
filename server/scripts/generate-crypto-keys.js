#!/usr/bin/env node
/**
 * 生成RSA 4096 + ECDSA P-384 密钥对
 * 用于3层循环加密授权系统
 *
 * 用法:
 *   node scripts/generate-crypto-keys.js
 *
 * 输出:
 *   - .dev-keys/rsa-private.pem    RSA 4096 私钥（用于签名密钥包装）
 *   - .dev-keys/rsa-public.pem     RSA 4096 公钥（嵌入代码验证）
 *   - .dev-keys/ecdsa-private.pem  ECDSA P-384 私钥（用于签名许可证数据）
 *   - .dev-keys/ecdsa-public.pem   ECDSA P-384 公钥（嵌入代码验证）
 *   - console输出公钥的JS代码片段，可直接复制到license.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '..', '.dev-keys');

// 确保目录存在
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
}

console.log('正在生成 RSA 4096 密钥对...');
const { publicKey: rsaPublic, privateKey: rsaPrivate } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(path.join(KEYS_DIR, 'rsa-private.pem'), rsaPrivate, { mode: 0o600 });
fs.writeFileSync(path.join(KEYS_DIR, 'rsa-public.pem'), rsaPublic, { mode: 0o600 });
console.log('  → RSA 私钥已保存: .dev-keys/rsa-private.pem');
console.log('  → RSA 公钥已保存: .dev-keys/rsa-public.pem');

console.log('正在生成 ECDSA P-384 密钥对...');
const { publicKey: ecPublic, privateKey: ecPrivate } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-384',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(path.join(KEYS_DIR, 'ecdsa-private.pem'), ecPrivate, { mode: 0o600 });
fs.writeFileSync(path.join(KEYS_DIR, 'ecdsa-public.pem'), ecPublic, { mode: 0o600 });
console.log('  → ECDSA 私钥已保存: .dev-keys/ecdsa-private.pem');
console.log('  → ECDSA 公钥已保存: .dev-keys/ecdsa-public.pem');

console.log('');
console.log('========================================');
console.log('  密钥对生成完成');
console.log('========================================');
console.log('');
console.log('请将以下公钥嵌入到 license.js 中:');
console.log('');

// 输出RSA公钥的JS代码片段
const rsaPublicKeySingleLine = rsaPublic.replace(/\n/g, '\\n');
console.log('// RSA 4096 公钥 (用于RSA-OAEP密钥包装解密)');
console.log(`const RSA_PUBLIC_KEY = '${rsaPublicKeySingleLine}';`);
console.log('');

// 输出ECDSA公钥的JS代码片段
const ecPublicKeySingleLine = ecPublic.replace(/\n/g, '\\n');
console.log('// ECDSA P-384 公钥 (用于ECDSA签名验证)');
console.log(`const ECDSA_PUBLIC_KEY = '${ecPublicKeySingleLine}';`);
console.log('');

console.log('⚠  私钥文件 (.dev-keys/) 请妥善保管，不要提交到代码仓库');
console.log('⚠  生成许可证时需要使用私钥，请确保 generate-license.js 能读取到');