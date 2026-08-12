#!/usr/bin/env node
/**
 * 生成正式版本许可证密钥（3层循环加密防破解版）
 *
 * 加密架构:
 *   第1层 RSA-4096 PKCS1 v1.5 密钥包装（非对称外层）
 *   第2层 AES-256-GCM 载荷加密（对称中间层，PBKDF2密钥派生）
 *   第3层 ECDSA P-384 数字签名（非对称内层）
 *
 * 支持两种模式:
 *   1. v2 3层加密密钥（推荐）- 格式: v2:base64:base64:base64:base64
 *   2. v1 兼容密钥（旧格式）
 *
 * 用法:
 *   # v2: 通用密钥（不绑定机器）
 *   node scripts/generate-license.js --customer "客户名称" --years 1
 *
 *   # v2: 一机一码（绑定机器指纹，推荐）
 *   node scripts/generate-license.js --customer "客户名称" --years 1 --fp "服务器机器指纹"
 *
 *   # v2: 从远程服务器获取机器指纹并生成
 *   node scripts/generate-license.js --customer "客户名称" --years 1 --remote https://rry.klai.top
 *
 *   # v2: 永久授权 + 域名绑定 + 机器绑定
 *   node scripts/generate-license.js --customer "客户" --years 99 --domain rry.klai.top --fp "abc123..."
 *
 *   # v1: 旧版密钥（兼容）
 *   node scripts/generate-license.js --customer "客户" --v1
 *
 * 参数:
 *   --customer  客户名称（必填）
 *   --years     有效年数（默认 1）
 *   --domain    绑定域名（可选）
 *   --type      许可证类型: permanent / annual（默认 permanent）
 *   --fp        机器指纹（从服务器 /api/license/fingerprint 获取，绑定特定机器）
 *   --remote    远程服务器地址（自动获取机器指纹）
 *   --v1        生成v1兼容密钥（旧格式，不推荐）
 *   --key-dir   私钥目录（默认 ../.dev-keys）
 */
const { generateLicenseKey, generateV1LicenseKey } = require('../utils/license');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const val = argv[i + 1];
    args[key] = val;
  }
  return args;
}

function fetchRemoteFingerprint(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url + '/api/license/fingerprint', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data && json.data.fullFingerprint) {
            resolve(json.data.fullFingerprint);
          } else {
            reject(new Error('服务器返回的指纹数据格式无效'));
          }
        } catch (e) {
          reject(new Error('解析服务器响应失败: ' + e.message));
        }
      });
    }).on('error', (e) => {
      reject(new Error('连接服务器失败: ' + e.message));
    });
  });
}

function readPrivateKeys(keyDir) {
  const rsaPath = path.join(keyDir, 'rsa-private.pem');
  const ecdsaPath = path.join(keyDir, 'ecdsa-private.pem');

  if (!fs.existsSync(rsaPath)) {
    throw new Error(`RSA私钥文件不存在: ${rsaPath}\n请先运行 node scripts/generate-crypto-keys.js 生成密钥对`);
  }
  if (!fs.existsSync(ecdsaPath)) {
    throw new Error(`ECDSA私钥文件不存在: ${ecdsaPath}\n请先运行 node scripts/generate-crypto-keys.js 生成密钥对`);
  }

  return {
    rsaPrivateKey: fs.readFileSync(rsaPath, 'utf-8'),
    ecdsaPrivateKey: fs.readFileSync(ecdsaPath, 'utf-8')
  };
}

async function main() {
  const args = parseArgs();

  if (!args.customer) {
    console.log('');
    console.log('用法: node scripts/generate-license.js --customer "客户名称" --years 1');
    console.log('');
    console.log('参数:');
    console.log('  --customer  客户名称（必填）');
    console.log('  --years     有效年数（默认 1）');
    console.log('  --domain    绑定域名（可选）');
    console.log('  --type      许可证类型: permanent / annual（默认 permanent）');
    console.log('  --fp        机器指纹（从服务器获取，绑定特定机器，推荐使用）');
    console.log('  --remote    远程服务器地址（自动获取机器指纹）');
    console.log('  --v1        生成v1兼容密钥（旧格式，不推荐）');
    console.log('  --key-dir   私钥目录（默认 ../.dev-keys）');
    console.log('');
    console.log('示例:');
    console.log('  # v2: 通用密钥（不绑定机器，3层加密）');
    console.log('  node scripts/generate-license.js --customer "腾讯云" --years 1');
    console.log('');
    console.log('  # v2: 一机一码（绑定机器指纹，推荐）');
    console.log('  node scripts/generate-license.js --customer "张三" --years 3 --fp "a1b2c3d4..."');
    console.log('');
    console.log('  # v2: 从远程服务器获取指纹并生成');
    console.log('  node scripts/generate-license.js --customer "张三" --years 1 --remote https://rry.klai.top');
    console.log('');
    console.log('  # v1: 旧版密钥（兼容旧系统）');
    console.log('  node scripts/generate-license.js --customer "测试" --years 1 --v1');
    console.log('');
    process.exit(1);
  }

  let machineFingerprint = args.fp || '';

  // 如果指定了远程服务器，自动获取机器指纹
  if (args.remote && !machineFingerprint) {
    console.log('正在从远程服务器获取机器指纹...');
    try {
      machineFingerprint = await fetchRemoteFingerprint(args.remote);
      console.log('机器指纹获取成功:', machineFingerprint.substring(0, 32) + '...');
    } catch (err) {
      console.error('获取机器指纹失败:', err.message);
      process.exit(1);
    }
  }

  const isV1 = args.v1 === 'true' || args.v1 === '1';

  if (isV1) {
    // ==========================================
    // v1 兼容密钥（旧格式）
    // ==========================================
    const result = generateV1LicenseKey({
      customer: args.customer,
      validYears: parseInt(args.years || '1', 10),
      domain: args.domain || '',
      type: args.type || 'permanent',
      machineFingerprint
    });

    console.log('');
    console.log('========================================');
    console.log('  v1 兼容许可证密钥已生成');
    console.log('========================================');
    console.log('');
    console.log('客户名称:', result.licenseData.customer);
    console.log('产品:', result.licenseData.product);
    console.log('签发时间:', result.licenseData.issuedAt);
    console.log('有效期至:', result.licenseData.validUntil);
    console.log('绑定域名:', result.licenseData.domain || '不限制');
    console.log('许可证类型:', result.licenseData.type);
    console.log('机器绑定:', result.licenseData.machineFingerprint ? '是 (一机一码)' : '否 (通用密钥)');
    console.log('加密版本: v1 (HMAC-SHA256 + SHA256 Checksum)');
    console.log('');
    console.log('--- 许可证密钥（发送给客户激活）---');
    console.log('');
    console.log(result.licenseKey);
    console.log('');
    console.log('--- 激活方式 ---');
    console.log('');
    console.log('  curl -X POST https://rry.klai.top/api/license/activate \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log(`    -d '{"licenseKey": "${result.licenseKey}"}'`);
    console.log('');
    return;
  }

  // ==========================================
  // v2 3层循环加密密钥（默认）
  // ==========================================
  const keyDir = path.resolve(__dirname, args['key-dir'] || '..', '.dev-keys');
  let keys;
  try {
    keys = readPrivateKeys(keyDir);
  } catch (err) {
    console.error('读取私钥失败:', err.message);
    process.exit(1);
  }

  console.log('正在生成 v2 3层循环加密许可证密钥...');
  console.log('  RSA 4096 PKCS1 v1.5 密钥包装（第1层）');
  console.log('  AES-256-GCM 载荷加密（第2层）');
  console.log('  ECDSA P-384 数字签名（第3层）');
  console.log('');

  const result = generateLicenseKey({
    customer: args.customer,
    validYears: parseInt(args.years || '1', 10),
    domain: args.domain || '',
    type: args.type || 'permanent',
    machineFingerprint,
    rsaPrivateKey: keys.rsaPrivateKey,
    ecdsaPrivateKey: keys.ecdsaPrivateKey
  });

  console.log('========================================');
  console.log('  v2 3层循环加密许可证密钥已生成');
  console.log('========================================');
  console.log('');
  console.log('客户名称:', result.licenseData.customer);
  console.log('产品:', result.licenseData.product);
  console.log('签发时间:', result.licenseData.issuedAt);
  console.log('有效期至:', result.licenseData.validUntil);
  console.log('绑定域名:', result.licenseData.domain || '不限制');
  console.log('许可证类型:', result.licenseData.type);
  console.log('机器绑定:', result.licenseData.machineFingerprint ? '是 (一机一码)' : '否 (通用密钥)');
  if (result.licenseData.machineFingerprint) {
    console.log('机器指纹:', result.licenseData.machineFingerprint.substring(0, 32) + '...');
  }
  console.log('加密版本: v2 (RSA-4096 + AES-256-GCM + ECDSA P-384)');
  console.log('ECDSA签名:', result.ecdsaSignature.substring(0, 32) + '...');
  console.log('');
  console.log('--- 许可证密钥（发送给客户激活）---');
  console.log('');
  console.log(result.licenseKey);
  console.log('');
  console.log('--- 激活方式 ---');
  console.log('');
  console.log('方式1 - API 调用:');
  console.log(`  curl -X POST https://rry.klai.top/api/license/activate \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"licenseKey": "${result.licenseKey}"}'`);
  console.log('');
  console.log('方式2 - 管理后台:');
  console.log('  登录管理后台 → 授权管理 → 输入密钥 → 激活');
  console.log('');
  console.log('方式3 - 获取服务器机器指纹:');
  console.log('  curl https://rry.klai.top/api/license/fingerprint');
  console.log('');
  console.log('方式4 - 查看授权状态:');
  console.log('  curl https://rry.klai.top/api/license/status');
  console.log('');
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});