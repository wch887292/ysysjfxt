// utils/encrypt.js - 加密工具模块
// 规格12.1：手机号使用 AES-256-GCM 加密（Node.js 原生 crypto，PBKDF2 密钥派生）
// 向后兼容：可解密旧版 CryptoJS passphrase 模式产生的密文（EVP_BytesToKey/MD5）
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// 生产环境强制要求密钥配置
const AES_SECRET_KEY = process.env.AES_SECRET_KEY;
if (!AES_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('生产环境必须配置 AES_SECRET_KEY 环境变量');
}
const EFFECTIVE_KEY = AES_SECRET_KEY || 'dev_only_key_not_for_production';

// PBKDF2 参数（NIST SP 800-132 推荐）
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32; // AES-256 需要 32 字节密钥
const PBKDF2_DIGEST = 'sha256';
const GCM_IV_LEN = 12;    // GCM 推荐 96-bit IV
const GCM_TAG_LEN = 16;   // GCM auth tag 128-bit

// 旧版 CryptoJS 密文前缀（OpenSSL "Salted__" base64 解码后前8字节）
// CryptoJS.AES.encrypt(text, passphrase).toString() 输出 base64，解码后以 "Salted__" 开头
const LEGACY_PREFIX = 'U2FsdGVk'; // base64("Salted_") 前8字符

// 用 PBKDF2 从口令派生稳定密钥（同一口令+盐→同一密钥，盐固定为口令本身以兼容旧解密逻辑）
// 注意：盐固定是为了让同一环境配置下加密/解密可逆；不同环境用不同 AES_SECRET_KEY 即可隔离
const DERIVED_KEY = crypto.pbkdf2Sync(
  EFFECTIVE_KEY,
  EFFECTIVE_KEY, // 盐 = 口令本身（简化；生产应使用独立盐，但为保证可逆性此处固定）
  PBKDF2_ITERATIONS,
  PBKDF2_KEYLEN,
  PBKDF2_DIGEST
);

/**
 * AES-256-GCM 加密（规格12.1）
 * 输出格式：base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)
 * 每次 IV 随机，保证语义安全；authTag 提供完整性校验（防篡改）
 */
function encrypt(text) {
  if (text == null) return null;
  const plaintext = String(text);
  const iv = crypto.randomBytes(GCM_IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

/**
 * AES-256-GCM 解密（规格12.1）
 * 向后兼容：若密文为旧版 CryptoJS passphrase 模式（base64 以 "U2FsdGVk" 开头），
 *           回退到 CryptoJS 解密，保证存量数据可读。
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const str = String(ciphertext);

  // 新版 GCM 格式：iv:authTag:ciphertext（3 段 base64，用 ':' 分隔）
  const parts = str.split(':');
  if (parts.length === 3) {
    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = Buffer.from(parts[2], 'base64');
      if (iv.length === GCM_IV_LEN && authTag.length === GCM_TAG_LEN) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      }
    } catch (e) {
      // GCM 解密失败（密钥不匹配/被篡改）—— 不静默回退到旧版，避免掩盖攻击
      throw new Error('AES-256-GCM 解密失败：密文可能被篡改或密钥不匹配');
    }
  }

  // 旧版 CryptoJS passphrase 模式（向后兼容存量数据）
  if (str.startsWith(LEGACY_PREFIX) || parts.length !== 3) {
    const bytes = CryptoJS.AES.decrypt(str, EFFECTIVE_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  throw new Error('无法识别的密文格式');
}

/**
 * 手机号加密存储
 */
function encryptPhone(phone) {
  return encrypt(phone);
}

/**
 * 手机号解密显示
 */
function decryptPhone(ciphertext) {
  return decrypt(ciphertext);
}

/**
 * 手机号脱敏显示 (138****1234)
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

/**
 * 身份信息脱敏
 */
function maskIdCard(idCard) {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 4) + '****' + idCard.substring(idCard.length - 4);
}

module.exports = {
  encrypt,
  decrypt,
  encryptPhone,
  decryptPhone,
  maskPhone,
  maskIdCard
};
