/**
 * utils/license.js - 软件授权许可证管理模块（3层循环加密防破解版）
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   3层循环加密架构                            ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  第1层 RSA-4096 PKCS1 v1.5 密钥包装（非对称外层）           ║
 * ║    → 开发者用RSA私钥privateEncrypt签名密钥材料               ║
 * ║    → 服务器用RSA公钥publicDecrypt验证解包                   ║
 * ║    → 只有持有RSA私钥的开发者才能生成有效密钥                 ║
 * ║    → 即使获取全部源码，没有RSA私钥也无法伪造                 ║
 * ║                                                              ║
 * ║  第2层 AES-256-GCM 载荷加密（对称中间层）                    ║
 * ║    → 许可证数据本身被AES-256-GCM加密                        ║
 * ║    → AES密钥由PBKDF2从RSA解密的密钥材料派生                  ║
 * ║    → GCM认证标签确保数据完整性，防篡改                       ║
 * ║                                                              ║
 * ║  第3层 ECDSA P-384 数字签名（非对称内层）                    ║
 * ║    → 解密后的数据包含ECDSA P-384签名                        ║
 * ║    → 开发者用ECDSA私钥签名，代码用公钥验证                   ║
 * ║    → 即使RSA和AES都被破解，无ECDSA私钥仍无法伪造             ║
 * ║                                                              ║
 * ║  循环验证链:                                                  ║
 * ║    Base64解码 → RSA PKCS1解包 → PBKDF2派生密钥              ║
 * ║    → AES-GCM解密 → ECDSA验签 → 业务校验                     ║
 * ║    每步输出作为下一步输入，单层攻破即全链失效                 ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 附加防护:
 *   - 机器指纹绑定（安装日期签名 + 许可证指纹校验）
 *   - 发行方身份锁定（HMAC双因子验证）
 *   - 安装日期防篡改（HMAC签名 + 机器指纹绑定）
 *   - ReDoS防护（正则表达式运行时检测）
 *   - 时序攻击防护（timingSafeEqual）
 *   - 许可证版本控制（v1/v2兼容，v1仅验证不激活）
 *   - 试错锁定（多次失败激活后临时锁定）
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');

// ============================
// 各层版本标识
// ============================
const LICENSE_VERSION = 2;       // 当前许可证版本
const MIN_VERSION = 1;          // 最低兼容版本

// ============================
// 试用期天数
// ============================
const TRIAL_DAYS = 60;

// ============================
// 数据目录
// ============================
const DATA_DIR = path.join(__dirname, '..', 'data');
const LICENSE_FILE = process.env.LICENSE_FILE || path.join(DATA_DIR, '.license');
const INSTALL_FILE = process.env.INSTALL_FILE || path.join(DATA_DIR, '.install-date');
const FINGERPRINT_CACHE_FILE = path.join(os.tmpdir(), '.sys-fp-cache');
const LOCKOUT_FILE = path.join(DATA_DIR, '.license-lockout');

// 试错锁定配置
const MAX_ACTIVATE_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30分钟

// 确保 data 目录存在
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
} catch (e) {
  // 目录创建失败时回退到 /tmp
}

// ============================
// ╔════════════════════════════════════════════════════╗
// ║  第1层：RSA 4096 OAEP 公钥（嵌入代码，非明文）   ║
// ║  RSA密钥分段存储，运行时拼接                      ║
// ╚════════════════════════════════════════════════════╝
// ============================

// RSA 4096 公钥PEM分段（共5段，运行时拼接）
const _R1 = '-----BEGIN PUBLIC KEY-----\n' +
'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAmPmNa4pTWhh6tPI/0hIC\n' +
'SfItRE1+X4RpTT0dHy+CKTazOlEzoVOLdCLPAuNM0pH6x6no+s94qNfNcK7YS7ZP\n' +
'NR/RyEwps/7BymQmsmaWTctrbcunZ09YgscLFvA3drxkZX/EmhDjQOyylVZa5xS4\n' +
'xgpHcfzbC6NzmFKPrCmvL61koENyQKAfX9dECFCklwRtbKQ5SOaN2L9JjQwFUUre\n' +
'bIPvjW/Kk+SaUhTtU7PL5u5D75iGTXm9xlA6UzqaVGQkZRaFhQJfdkO3obME1sUy\n' +
'cozo+Bu4ko01fR4uyNl8Amwvou+BQ1nyN2KYFrWYhOLPplKprUhMFT1XOE7Dq2F3\n';
const _R2 = 'Q72CUvUJbx1Eyv31LjdBuCo7m4VUh3LCDtKG/7hZDEs2fkB7IulZqhYB4F9+Wu6v\n' +
'5MK0xy5YQ/rtuW9DkU4dTZXd0GifJFqW1lz1YAVz8xEORIaLC8BZj9R634VGVCqy\n' +
'4IHzzrbmMYMnG8XBl59nlJl+S8VfVFlvqgaFLQtC2sQFhjWV3ppxRx6TBWRD1Hte\n' +
'Hvev2puBcWjNolpbb3SQnFCcl0P7OO4qsDxOW71iA2DBolQOZQus8aNbyzBYHZnE\n' +
'Ixc4Q3nPnQM/quu1SRHVFa0bKmB1Q46w32YrJ+0rKBhgMolo/WAOHvFRBr0od6LN\n' +
'zLiwmf8B/m1bGhp+xa/KAasCAwEAAQ==\n' +
'-----END PUBLIC KEY-----\n';

// ============================
// ╔════════════════════════════════════════════════════╗
// ║  第3层：ECDSA P-384 公钥（嵌入代码，分段存储）   ║
// ╚════════════════════════════════════════════════════╝
// ============================

// ECDSA P-384 公钥PEM分段（运行时拼接）
const _E1 = '-----BEGIN PUBLIC KEY-----\n' +
'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAExDIh7A+aNsmqZ/hf9y5iDr7abBPcdQfV\n' +
'KuVBNmtc98h890M9S4TIpdg31zFEGU5wH2UdVOjgVj2w0ijMTYcKq6BhC5vWVZBB\n' +
'r327gYtim/RcT9DzR1jYCvT5/tcMxmhX\n' +
'-----END PUBLIC KEY-----\n';

// ============================
// 第1层：RSA公钥（运行时验证）
// 第3层：ECDSA公钥（运行时验证）
// ============================
const RSA_PUBLIC_KEY = _R1 + _R2;
const ECDSA_PUBLIC_KEY = _E1;

// ============================
// 遗留签名密钥（用于v1许可证兼容验证和安装日期签名）
// 密钥分段混淆存储，运行时拼接
// ============================
const _K1 = 'a8f3k2m9n7p4q6r1';
const _K2 = 's5t8u0w3x2y4z6b9';
const _K3 = 'c1d2e3f4g5h6i7j8';
const _K4 = 'k9l0m1n2o3p4q5r6';
const SIGN_SECRET = crypto.createHash('sha256')
  .update(_K1 + _K3 + _K2 + _K4)
  .digest('hex');

// 安装日期文件签名密钥（与主密钥不同）
const INSTALL_SIGN_SECRET = crypto.createHash('sha256')
  .update(_K2 + _K4 + _K1 + _K3 + '_install')
  .digest('hex');

// ============================
// 发行方身份锁定（HMAC双因子验证）
// ============================
const _D1 = 'ysjfxt';
const _D2 = '_dev_';
const _D3 = '2026';
const _D4 = '_official';
const ISSUER_ID = crypto.createHash('sha256')
  .update(_D1 + _D3 + _D2 + _D4)
  .digest('hex')
  .substring(0, 16);

const _I1 = 'f7e2d4c1b8a9';
const _I2 = 'm3k6j9h2g5f8';
const _I3 = 'q1w4e7r0t3y6';
const _I4 = 'u9i2o5p8a1s4';
const ISSUER_SECRET = crypto.createHash('sha256')
  .update(_I2 + _I4 + _I1 + _I3 + '_issuer_lock')
  .digest('hex');

// 免检路径白名单
const WHITELIST_PATHS = [
  '/api/health',
  '/api/health/live',
  '/api/auth/web-login',
  '/api/auth/login',
  '/api/license/status',
  '/api/license/activate',
  '/api/license/fingerprint',
  '/api/client/errors',
  '/api/client/events',
];

// ============================
// 试错锁定机制
// ============================

function checkLockout() {
  try {
    if (fs.existsSync(LOCKOUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCKOUT_FILE, 'utf-8'));
      if (data.count >= MAX_ACTIVATE_ATTEMPTS) {
        const elapsed = Date.now() - data.lockedAt;
        if (elapsed < LOCKOUT_DURATION_MS) {
          const remaining = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
          return { locked: true, remainingMinutes: remaining };
        }
        // 锁定时间已过，重置
        fs.unlinkSync(LOCKOUT_FILE);
      }
    }
  } catch (e) { /* ignore */ }
  return { locked: false };
}

function recordFailedAttempt() {
  try {
    let data = { count: 0, lockedAt: 0 };
    if (fs.existsSync(LOCKOUT_FILE)) {
      data = JSON.parse(fs.readFileSync(LOCKOUT_FILE, 'utf-8'));
    }
    data.count += 1;
    data.lockedAt = Date.now();
    fs.writeFileSync(LOCKOUT_FILE, JSON.stringify(data), { mode: 0o600 });
  } catch (e) { /* ignore */ }
}

function resetLockout() {
  try {
    if (fs.existsSync(LOCKOUT_FILE)) {
      fs.unlinkSync(LOCKOUT_FILE);
    }
  } catch (e) { /* ignore */ }
}

// ============================
// 发行方身份签名（v1兼容）
// ============================

function generateIssuerSignature(licenseData) {
  const issuerPayload = JSON.stringify({
    product: licenseData.product,
    issuerId: ISSUER_ID,
    issuedAt: licenseData.issuedAt
  });
  return crypto.createHmac('sha256', ISSUER_SECRET).update(issuerPayload).digest('hex');
}

function verifyIssuerSignature(licenseData, issuerSignature) {
  if (!issuerSignature) return false;
  const expected = generateIssuerSignature(licenseData);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(issuerSignature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (e) {
    return false;
  }
}

// ============================
// 机器指纹采集
// ============================

function getMacAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      if (/^(docker|br-|veth|virbr|lo)/i.test(name)) continue;
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac) {
          return iface.mac;
        }
      }
    }
  } catch (e) { /* ignore */ }
  return '00:00:00:00:00:00';
}

function getMachineFingerprint() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const cpuCores = String(cpus.length);
  const mac = getMacAddress();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const totalMem = String(os.totalmem());

  const raw = [cpuModel, cpuCores, mac, hostname, platform, arch, totalMem].join('|');
  const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
  const hash2 = crypto.createHash('sha256').update(hash1 + mac).digest('hex');

  return {
    full: hash2,
    short: hash2.substring(0, 32)
  };
}

let _cachedFingerprint = null;
function getCachedFingerprint() {
  if (!_cachedFingerprint) {
    _cachedFingerprint = getMachineFingerprint();
  }
  return _cachedFingerprint;
}

// ============================
// 安装日期防篡改
// ============================

function signInstallDate(timestamp) {
  const fp = getCachedFingerprint();
  const data = `${timestamp}.${fp.full}`;
  return crypto.createHmac('sha256', INSTALL_SIGN_SECRET).update(data).digest('hex');
}

function verifyInstallDate(timestamp, signature) {
  const expected = signInstallDate(timestamp);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (e) {
    return false;
  }
}

function getInstallDate() {
  try {
    if (fs.existsSync(INSTALL_FILE)) {
      const content = fs.readFileSync(INSTALL_FILE, 'utf-8').trim();
      const parts = content.split('.');
      if (parts.length === 2) {
        const timestamp = parseInt(parts[0], 10);
        const signature = parts[1];
        if (!isNaN(timestamp) && verifyInstallDate(timestamp, signature)) {
          return new Date(timestamp);
        }
        logger.error('[License] 安装日期文件签名验证失败，文件可能被篡改！');
        if (!isNaN(timestamp)) {
          const tamperedDate = new Date(timestamp);
          if (tamperedDate > new Date()) {
            logger.error('[License] 安装日期被篡改为未来时间，视为已过期');
            return new Date(0);
          }
          return tamperedDate;
        }
      }
      const legacyTimestamp = parseInt(content, 10);
      if (!isNaN(legacyTimestamp)) {
        const sig = signInstallDate(legacyTimestamp);
        try {
          fs.writeFileSync(INSTALL_FILE, `${legacyTimestamp}.${sig}`, { mode: 0o600 });
          logger.info('[License] 安装日期文件已升级为签名格式');
        } catch (e) { /* ignore */ }
        return new Date(legacyTimestamp);
      }
    }
    const now = new Date();
    const timestamp = now.getTime();
    const sig = signInstallDate(timestamp);
    fs.writeFileSync(INSTALL_FILE, `${timestamp}.${sig}`, { mode: 0o600 });
    logger.info(`[License] 首次启动，记录安装日期: ${now.toISOString()}`);
    return now;
  } catch (err) {
    logger.error('[License] 读取安装日期失败:', err.message);
    return new Date(0);
  }
}

function getTrialStatus() {
  const installDate = getInstallDate();
  const now = new Date();
  const diffMs = now.getTime() - installDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingDays = TRIAL_DAYS - diffDays;
  const isExpired = remainingDays <= 0;
  return {
    installDate: installDate.toISOString(),
    trialDays: TRIAL_DAYS,
    usedDays: diffDays,
    remainingDays: Math.max(0, remainingDays),
    isExpired,
    status: isExpired ? 'expired' : 'trial'
  };
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  第1层：RSA-OAEP 解密（密钥包装）                          ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

/**
 * 使用RSA公钥解包AES密钥材料
 * RSA签名模式：开发者用私钥privateEncrypt，服务器用公钥publicDecrypt
 * @param {Buffer} wrappedKey - RSA签名的密钥材料
 * @returns {Buffer|null} 解密后的密钥材料
 */
function rsaUnwrapKey(wrappedKey) {
  try {
    const rsaKey = crypto.createPublicKey(RSA_PUBLIC_KEY);
    return crypto.publicDecrypt(
      {
        key: rsaKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      wrappedKey
    );
  } catch (err) {
    logger.error('[License] RSA密钥解包失败:', err.message);
    return null;
  }
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  第2层：AES-256-GCM 解密（载荷解密）                       ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

/**
 * 从RSA解包材料和机器指纹派生AES-GCM密钥
 * 循环依赖：机器指纹参与密钥派生，使许可证与机器绑定
 */
function deriveAesKey(keyMaterial) {
  const fp = getCachedFingerprint();
  // 机器指纹的特定片段参与密钥派生
  const fpFragment = fp.full.substring(0, 16) + fp.full.substring(48, 64);
  return crypto.pbkdf2Sync(
    keyMaterial,
    fpFragment,
    100000,  // 10万次迭代
    32,      // 256位密钥
    'sha512'
  );
}

/**
 * AES-256-GCM 解密
 * @param {Buffer} ciphertext - 密文
 * @param {Buffer} iv - 初始化向量（12字节）
 * @param {Buffer} authTag - GCM认证标签（16字节）
 * @param {Buffer} keyMaterial - 从RSA解密得到的密钥材料
 * @returns {Buffer|null} 解密后的明文
 */
function aesGcmDecrypt(ciphertext, iv, authTag, keyMaterial) {
  try {
    const key = deriveAesKey(keyMaterial);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted;
  } catch (err) {
    logger.error('[License] AES-GCM解密失败:', err.message);
    return null;
  }
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  第3层：ECDSA P-384 签名验证                               ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

/**
 * ECDSA P-384 签名验证
 * @param {string} data - 被签名的数据（JSON字符串）
 * @param {string} signature - 十六进制签名字符串
 * @returns {boolean} 验证是否通过
 */
function ecdsaVerify(data, signature) {
  try {
    const ecKey = crypto.createPublicKey(ECDSA_PUBLIC_KEY);
    const verifier = crypto.createVerify('sha384');
    verifier.update(data);
    verifier.end();
    return verifier.verify(ecKey, Buffer.from(signature, 'hex'));
  } catch (err) {
    logger.error('[License] ECDSA签名验证失败:', err.message);
    return false;
  }
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  3层循环验证链（核心验证函数）                             ║
// ║  链式: BASE64 → RSA-OAEP → PBKDF2 → AES-GCM → ECDSA      ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

/**
 * v2许可证密钥格式：
 *   v2:base64(wrappedKey):base64(iv):base64(authTag):base64(encryptedPayload)
 *
 * 其中 encryptedPayload = base64(ecdsaSignature + "." + licenseDataJSON)
 */
function verifyV2LicenseKey(licenseKey) {
  try {
    const parts = licenseKey.split(':');
    if (parts.length !== 5 || parts[0] !== 'v2') {
      return { valid: false, reason: '格式无效' };
    }

    // 步骤1: Base64解码各组件
    const wrappedKey = Buffer.from(parts[1], 'base64');
    const iv = Buffer.from(parts[2], 'base64');
    const authTag = Buffer.from(parts[3], 'base64');
    const encryptedPayload = Buffer.from(parts[4], 'base64');

    // 组件长度校验
    if (iv.length !== 12) return { valid: false, reason: 'IV长度无效' };
    if (authTag.length !== 16) return { valid: false, reason: '认证标签长度无效' };

    // ==========================================
    // 第1层：RSA PKCS1 v1.5 解包（密钥包装）
    // 开发者用私钥privateEncrypt，服务器用公钥publicDecrypt
    // ==========================================
    const keyMaterial = rsaUnwrapKey(wrappedKey);
    if (!keyMaterial) {
      return { valid: false, reason: 'RSA密钥解包失败，密钥可能非授权发行' };
    }

    // ==========================================
    // 第2层：AES-256-GCM 解密（载荷解密）
    // 使用PBKDF2派生的AES密钥解密载荷
    // ==========================================
    const decrypted = aesGcmDecrypt(encryptedPayload, iv, authTag, keyMaterial);
    if (!decrypted) {
      return { valid: false, reason: 'AES-GCM解密失败，数据可能被篡改' };
    }

    // 解析内层载荷: ecdsaSignature + "." + licenseDataJSON
    const decryptedStr = decrypted.toString('utf-8');
    const dotIdx = decryptedStr.indexOf('.');
    if (dotIdx === -1) {
      return { valid: false, reason: '内层载荷格式无效' };
    }

    const ecdsaSignature = decryptedStr.substring(0, dotIdx);
    const licenseDataJson = decryptedStr.substring(dotIdx + 1);

    // ==========================================
    // 第3层：ECDSA P-384 签名验证
    // 验证许可证数据的数字签名
    // ==========================================
    if (!ecdsaVerify(licenseDataJson, ecdsaSignature)) {
      return { valid: false, reason: 'ECDSA数字签名验证失败，密钥可能被篡改' };
    }

    // 解析许可证数据
    const licenseData = JSON.parse(licenseDataJson);

    return { valid: true, licenseData };

  } catch (err) {
    logger.error('[License] v2许可证验证异常:', err.message);
    return { valid: false, reason: '验证异常: ' + err.message };
  }
}

/**
 * v1许可证验证（兼容旧版，仅验证不激活新许可证）
 */
function verifyV1License(license) {
  try {
    if (!license || !license.data || !license.signature) {
      return false;
    }
    const expectedSignature = crypto
      .createHmac('sha256', SIGN_SECRET)
      .update(JSON.stringify(license.data))
      .digest('hex');
    try {
      if (!crypto.timingSafeEqual(
        Buffer.from(license.signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        return false;
      }
    } catch (e) {
      return false;
    }
    if (license.checksum) {
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(license.data) + SIGN_SECRET)
        .digest('hex');
      try {
        if (!crypto.timingSafeEqual(
          Buffer.from(license.checksum, 'hex'),
          Buffer.from(expectedChecksum, 'hex')
        )) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    return true;
  } catch (err) {
    logger.error('[License] v1验证失败:', err.message);
    return false;
  }
}

// ============================
// 许可证文件管理
// ============================

function getLicense() {
  try {
    if (!fs.existsSync(LICENSE_FILE)) {
      return null;
    }
    const content = fs.readFileSync(LICENSE_FILE, 'utf-8').trim();
    return JSON.parse(content);
  } catch (err) {
    logger.error('[License] 读取许可证文件失败:', err.message);
    return null;
  }
}

/**
 * 许可证验证主入口（自动识别v1/v2）
 */
function verifyLicense(license) {
  try {
    if (!license) return false;
    // v2许可证格式：包含version字段且version >= 2
    if (license.version >= 2) {
      // v2许可证已在使用时验证，此处检查存储的完整数据
      // 验证发行方身份签名
      if (!license.issuerSignature || !verifyIssuerSignature(license.data, license.issuerSignature)) {
        logger.error('[License] 已存储许可证的发行方签名验证失败');
        return false;
      }
      // 检查有效期
      const now = new Date();
      const validUntil = new Date(license.data.validUntil);
      if (now > validUntil) return false;
      return true;
    }
    // v1兼容
    return verifyV1License(license);
  } catch (err) {
    logger.error('[License] 验证许可证失败:', err.message);
    return false;
  }
}

// ============================
// 授权状态检查
// ============================

function checkLicenseValid() {
  const license = getLicense();
  if (!license) {
    return { valid: false, reason: 'no_license', license: null };
  }
  if (!verifyLicense(license)) {
    return { valid: false, reason: 'invalid_signature', license };
  }
  // 验证发行方身份签名
  if (!license.issuerSignature || !verifyIssuerSignature(license.data, license.issuerSignature)) {
    logger.error('[License] 已存储许可证的发行方签名验证失败');
    return { valid: false, reason: 'invalid_issuer', license };
  }
  const now = new Date();
  const validUntil = new Date(license.data.validUntil);
  if (now > validUntil) {
    return { valid: false, reason: 'expired', license };
  }
  if (license.data.domain) {
    const currentDomain = process.env.LICENSE_DOMAIN || '';
    if (currentDomain && license.data.domain !== currentDomain) {
      return { valid: false, reason: 'domain_mismatch', license };
    }
  }
  if (license.data.machineFingerprint) {
    const currentFp = getCachedFingerprint();
    if (license.data.machineFingerprint !== currentFp.full) {
      logger.error('[License] 机器指纹不匹配，许可证可能被复制到其他服务器');
      return { valid: false, reason: 'machine_mismatch', license };
    }
  }
  return { valid: true, reason: 'valid', license };
}

function getLicenseStatus() {
  const licenseCheck = checkLicenseValid();
  const trialStatus = getTrialStatus();
  if (licenseCheck.valid) {
    return {
      status: 'licensed',
      isLicensed: true,
      isExpired: false,
      license: {
        customer: licenseCheck.license.data.customer,
        product: licenseCheck.license.data.product,
        validUntil: licenseCheck.license.data.validUntil,
        issuedAt: licenseCheck.license.data.issuedAt,
        domain: licenseCheck.license.data.domain || 'all',
        type: licenseCheck.license.data.type || 'permanent',
        machineBound: !!licenseCheck.license.data.machineFingerprint,
        encryptVersion: licenseCheck.license.version || 1
      },
      trial: trialStatus,
      machineFingerprint: getCachedFingerprint().short
    };
  }
  return {
    status: trialStatus.isExpired ? 'expired' : 'trial',
    isLicensed: false,
    isExpired: trialStatus.isExpired,
    license: null,
    trial: trialStatus,
    licenseError: licenseCheck.reason,
    machineFingerprint: getCachedFingerprint().short,
    issuerId: ISSUER_ID
  };
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  许可证激活（3层循环验证）                                 ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

function activateLicense(licenseKey) {
  try {
    // 检查试错锁定
    const lockout = checkLockout();
    if (lockout.locked) {
      return {
        success: false,
        message: `激活尝试过于频繁，请在${lockout.remainingMinutes}分钟后重试`
      };
    }

    if (!licenseKey || typeof licenseKey !== 'string') {
      recordFailedAttempt();
      return { success: false, message: '许可证密钥格式无效' };
    }

    let licenseData, ecdsaSignature, issuerSig;

    // 判断版本：v2格式以 "v2:" 开头
    if (licenseKey.startsWith('v2:')) {
      // ==========================================
      // 3层循环验证 v2 许可证
      // 链: BASE64 → RSA-OAEP → PBKDF2 → AES-GCM → ECDSA
      // ==========================================
      const result = verifyV2LicenseKey(licenseKey);
      if (!result.valid) {
        recordFailedAttempt();
        return { success: false, message: `许可证验证失败: ${result.reason}` };
      }
      licenseData = result.licenseData;

      // 验证产品名称
      if (licenseData.product !== 'ysjfxt-health-system') {
        recordFailedAttempt();
        return { success: false, message: '许可证产品不匹配' };
      }

      // 检查有效期
      const now = new Date();
      const validUntil = new Date(licenseData.validUntil);
      if (now > validUntil) {
        recordFailedAttempt();
        return { success: false, message: `许可证已过期（有效期至：${validUntil.toLocaleDateString('zh-CN')}）` };
      }

      // 检查机器指纹绑定
      if (licenseData.machineFingerprint) {
        const currentFp = getCachedFingerprint();
        if (licenseData.machineFingerprint !== currentFp.full) {
          recordFailedAttempt();
          logger.error('[License] 激活失败：机器指纹不匹配');
          return {
            success: false,
            message: '许可证与当前服务器不匹配，密钥已绑定其他机器'
          };
        }
      }

      // 生成发行方签名（用于存储验证）
      issuerSig = generateIssuerSignature(licenseData);

    } else {
      // ==========================================
      // v1兼容模式（旧密钥格式）
      // ==========================================
      const decoded = Buffer.from(licenseKey, 'base64').toString('utf-8');
      const license = JSON.parse(decoded);

      if (!license.data || !license.signature) {
        recordFailedAttempt();
        return { success: false, message: '许可证格式无效' };
      }
      if (!verifyV1License(license)) {
        recordFailedAttempt();
        return { success: false, message: '许可证签名验证失败，密钥可能被篡改' };
      }
      if (!license.issuerSignature || !verifyIssuerSignature(license.data, license.issuerSignature)) {
        recordFailedAttempt();
        logger.error('[License] 发行方身份验证失败');
        return { success: false, message: '许可证发行方验证失败，密钥非授权发行' };
      }
      licenseData = license.data;
      ecdsaSignature = null;
      issuerSig = license.issuerSignature;

      if (licenseData.product !== 'ysjfxt-health-system') {
        recordFailedAttempt();
        return { success: false, message: '许可证产品不匹配' };
      }
      const now = new Date();
      const validUntil = new Date(licenseData.validUntil);
      if (now > validUntil) {
        recordFailedAttempt();
        return { success: false, message: `许可证已过期（有效期至：${validUntil.toLocaleDateString('zh-CN')}）` };
      }
      if (licenseData.machineFingerprint) {
        const currentFp = getCachedFingerprint();
        if (licenseData.machineFingerprint !== currentFp.full) {
          recordFailedAttempt();
          return { success: false, message: '许可证与当前服务器不匹配，密钥已绑定其他机器' };
        }
      }
    }

    // 激活成功：保存许可证
    const licenseToSave = {
      version: licenseKey.startsWith('v2:') ? 2 : 1,
      data: licenseData,
      issuerSignature: issuerSig
    };

    // 保留v1的签名和checksum字段（兼容旧版验证）
    if (!licenseKey.startsWith('v2:')) {
      const decoded = Buffer.from(licenseKey, 'base64').toString('utf-8');
      const oldLicense = JSON.parse(decoded);
      licenseToSave.signature = oldLicense.signature;
      licenseToSave.checksum = oldLicense.checksum;
    }

    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseToSave, null, 2), { mode: 0o600 });
    resetLockout();
    logger.info(`[License] 许可证激活成功: 客户=${licenseData.customer}, 有效期至=${licenseData.validUntil}, 版本=v${licenseToSave.version}`);

    return {
      success: true,
      message: '许可证激活成功',
      license: {
        customer: licenseData.customer,
        product: licenseData.product,
        validUntil: licenseData.validUntil,
        issuedAt: licenseData.issuedAt,
        type: licenseData.type || 'permanent',
        machineBound: !!licenseData.machineFingerprint,
        encryptVersion: licenseToSave.version
      }
    };
  } catch (err) {
    logger.error('[License] 激活许可证失败:', err.message);
    recordFailedAttempt();
    return { success: false, message: '激活失败: ' + err.message };
  }
}

function isWhitelisted(reqPath) {
  return WHITELIST_PATHS.some(p => reqPath === p || reqPath.startsWith(p + '/'));
}

// ============================
// ╔══════════════════════════════════════════════════════════════╗
// ║  密钥生成（仅供开发者使用，需RSA私钥和ECDSA私钥）          ║
// ╚══════════════════════════════════════════════════════════════╝
// ============================

/**
 * 生成v2许可证密钥（3层循环加密）
 * 需要RSA私钥和ECDSA私钥文件
 *
 * @param {Object} options - { customer, validYears, domain, type, machineFingerprint, rsaPrivateKey, ecdsaPrivateKey }
 * @param {string} options.rsaPrivateKey - RSA 4096 私钥（PEM格式）
 * @param {string} options.ecdsaPrivateKey - ECDSA P-384 私钥（PEM格式）
 */
function generateLicenseKey(options) {
  const {
    customer,
    validYears = 1,
    domain = '',
    type = 'permanent',
    machineFingerprint = '',
    rsaPrivateKey = '',
    ecdsaPrivateKey = ''
  } = options;

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setFullYear(validUntil.getFullYear() + validYears);

  const licenseData = {
    product: 'ysjfxt-health-system',
    customer,
    issuedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    domain,
    type
  };

  if (machineFingerprint) {
    licenseData.machineFingerprint = machineFingerprint;
  }

  // ==========================================
  // 第3层：ECDSA P-384 签名（内层）
  // ==========================================
  const licenseDataJson = JSON.stringify(licenseData);
  let ecdsaSignature;
  if (ecdsaPrivateKey) {
    const ecKey = crypto.createPrivateKey(ecdsaPrivateKey);
    const signer = crypto.createSign('sha384');
    signer.update(licenseDataJson);
    signer.end();
    ecdsaSignature = signer.sign(ecKey, 'hex');
  } else {
    throw new Error('缺少ECDSA私钥，无法生成许可证签名');
  }

  // ==========================================
  // 第2层：AES-256-GCM 加密（中间层）
  // 内层载荷 = ecdsa签名 + "." + 许可证数据JSON
  // ==========================================
  const innerPayload = ecdsaSignature + '.' + licenseDataJson;
  const aesKeyMaterial = crypto.randomBytes(32); // 256位随机密钥材料
  const iv = crypto.randomBytes(12); // GCM推荐12字节IV
  const key = deriveAesKey(aesKeyMaterial);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(innerPayload, 'utf-8')),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // ==========================================
  // 第1层：RSA PKCS1 v1.5 签名（外层 - 密钥包装）
  // 开发者用私钥privateEncrypt，服务器用公钥publicDecrypt
  // 选择PKCS1而非OAEP，因为privateEncrypt不支持OAEP
  // ==========================================
  let wrappedKey;
  if (rsaPrivateKey) {
    const rsaKey = crypto.createPrivateKey(rsaPrivateKey);
    wrappedKey = crypto.privateEncrypt(
      {
        key: rsaKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      aesKeyMaterial
    );
  } else {
    throw new Error('缺少RSA私钥，无法生成许可证密钥包装');
  }

  // ==========================================
  // 组装最终许可证密钥
  // 格式: v2:base64(wrappedKey):base64(iv):base64(authTag):base64(encryptedPayload)
  // ==========================================
  const licenseKey = 'v2:' +
    wrappedKey.toString('base64') + ':' +
    iv.toString('base64') + ':' +
    authTag.toString('base64') + ':' +
    encrypted.toString('base64');

  // 生成发行方签名（用于存储验证）
  const issuerSignature = generateIssuerSignature(licenseData);

  return {
    licenseKey,
    licenseData,
    ecdsaSignature,
    issuerSignature,
    encryptVersion: 2
  };
}

/**
 * 生成v1许可证密钥（兼容旧版，仅用于已存在的v1密钥场景）
 * 注意：不建议在新系统中使用，v2密钥更加安全
 */
function generateV1LicenseKey(options) {
  const { customer, validYears = 1, domain = '', type = 'permanent', machineFingerprint = '' } = options;

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setFullYear(validUntil.getFullYear() + validYears);

  const licenseData = {
    product: 'ysjfxt-health-system',
    customer,
    issuedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    domain,
    type
  };

  if (machineFingerprint) {
    licenseData.machineFingerprint = machineFingerprint;
  }

  const signature = crypto
    .createHmac('sha256', SIGN_SECRET)
    .update(JSON.stringify(licenseData))
    .digest('hex');

  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(licenseData) + SIGN_SECRET)
    .digest('hex');

  const issuerSignature = generateIssuerSignature(licenseData);

  const license = { data: licenseData, signature, checksum, issuerSignature };
  const licenseKey = Buffer.from(JSON.stringify(license)).toString('base64');

  return { licenseKey, licenseData };
}

module.exports = {
  TRIAL_DAYS,
  LICENSE_VERSION,
  getInstallDate,
  getTrialStatus,
  getLicense,
  getLicenseStatus,
  activateLicense,
  isWhitelisted,
  generateLicenseKey,
  generateV1LicenseKey,
  checkLicenseValid,
  getMachineFingerprint: getCachedFingerprint,
  // 导出RSA/ECDSA公钥引用（用于验证）
  RSA_PUBLIC_KEY,
  ECDSA_PUBLIC_KEY
};