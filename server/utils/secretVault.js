// utils/secretVault.js - 系统密钥三重信封加密（at-rest）
//
// 设计目标（对应安全要求）：
//   1. 禁止明文存储          → 系统密钥(.env / SystemConfig) 一律密文落盘
//   2. 三重加密后写入配置     → 三层 AES-256-GCM 信封加密
//   3. 加密后不可逆?         → 系统密钥运行时必须可用，只能"加密"不能"哈希"；
//                              本模块保证"磁盘无明文 + 无单一密钥可独立解密"。
//                              （用户登录密码走 bcrypt 哈希，单向不可逆，见 models/User.js）
//   4. 密码遗忘只能重置       → 仅适用于用户密码（bcrypt 模型），与系统密钥无关
//
// 三把相互独立密钥（缺一不可解密）：
//   K1 = 部署平台注入环境变量 VAULT_MASTER_KEY        （绝不落盘；生产必须注入）
//   K2 = 本地密钥文件 keys/vault.key (0600, gitignore) （不进部署包）
//   K3 = 机器指纹 = keys/instance.id(持久随机) + os.hostname 派生
//
// 加密顺序：明文 → K3 → K2 → K1（外层为 K1）
// 密文格式：ENV3:L:<gcm_K1(L:<gcm_K2(L:<gcm_K3(plain)>)>)>
//   其中每层 gcm = base64(iv):base64(tag):base64(ct)

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_SALT = 'ysjjfxt-secret-vault-v1'; // 固定应用盐，区分三层派生源
const GCM_IV_LEN = 12;
const PBKDF2_ITER = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const PREFIX = 'ENV3:';
const LAYER_PREFIX = 'L:';

// 兼容旧单层密文（utils/encrypt.js 的 AES-256-GCM）
let _legacyDecrypt = null;
function legacyDecrypt(cipher) {
  if (!_legacyDecrypt) _legacyDecrypt = require('./encrypt').decrypt;
  return _legacyDecrypt(cipher);
}

// ---------------------------------------------------------------------------
// 密钥来源
// ---------------------------------------------------------------------------

// K1：部署平台注入，绝不落盘。生产缺失则报错；非生产回退到固定 dev 材料（仅本地）。
function getMasterKeyMaterial() {
  const env = process.env.VAULT_MASTER_KEY;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV !== 'production') {
    return 'dev_vault_master_not_for_production';
  }
  return ''; // 生产必须注入
}

// K2：本地密钥文件。存在则读取；生产缺失则首次自动生成(0600)；非生产回退 dev 材料。
function getKeyFilePath() {
  return process.env.VAULT_KEY_FILE || path.join(__dirname, '..', 'keys', 'vault.key');
}

function loadKeyFileMaterial() {
  const p = getKeyFilePath();
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch (_) { /* ignore */ }
  if (process.env.NODE_ENV !== 'production') {
    return 'dev_vault_keyfile_not_for_production';
  }
  // 生产：自助引导生成并严格限权
  try {
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    const k = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(p, k, { mode: 0o600 });
    // 仅在类 Unix 上加固权限
    try { fs.chmodSync(p, 0o600); } catch (_) {}
    return k;
  } catch (e) {
    return '';
  }
}

// K3：机器指纹。instance.id 持久随机 + 主机名，确保跨重启稳定且与 K2 独立。
function loadInstanceId() {
  const p = process.env.VAULT_INSTANCE_FILE || path.join(__dirname, '..', 'keys', 'instance.id');
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch (_) { /* ignore */ }
  try {
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(p, id, { mode: 0o600 });
    try { fs.chmodSync(p, 0o600); } catch (_) {}
    return id;
  } catch (_) {
    return '';
  }
}

function deriveKey(material, layerIndex) {
  const salt = APP_SALT + ':layer' + layerIndex;
  return crypto.pbkdf2Sync(String(material), salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

let _keysCache = null;
function getKeys() {
  if (_keysCache) return _keysCache;
  const k1Mat = getMasterKeyMaterial();
  const k2Mat = loadKeyFileMaterial();
  const instanceId = loadInstanceId();
  const k3Mat = (instanceId || 'no-instance') + '|' + (os.hostname() || 'no-host');
  _keysCache = {
    k1: k1Mat ? deriveKey(k1Mat, 1) : null,
    k2: k2Mat ? deriveKey(k2Mat, 2) : null,
    k3: deriveKey(k3Mat, 3)
  };
  return _keysCache;
}

// 是否具备完整三层密钥（生产环境必须满足）
function hasAllKeys() {
  const { k1, k2 } = getKeys();
  return !!(k1 && k2);
}

// ---------------------------------------------------------------------------
// 单层 GCM 封装
// ---------------------------------------------------------------------------

function gcmEncrypt(key, plaintext) {
  const iv = crypto.randomBytes(GCM_IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64')
  ].join(':');
}

function gcmDecrypt(key, packed) {
  const parts = String(packed).split(':');
  if (parts.length !== 3) throw new Error('密文格式错误');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const ct = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// 三重信封加解密（对外 API）
// ---------------------------------------------------------------------------

/**
 * 三重加密系统密钥
 * @param {string|null} plain
 * @returns {string|null} ENV3: 前缀密文
 */
function encryptSecret(plain) {
  if (plain == null) return null;
  const { k1, k2, k3 } = getKeys();
  if (!k1 || !k2) {
    throw new Error('生产环境缺少密钥(VAULT_MASTER_KEY / 密钥文件)，无法加密系统密钥');
  }
  let t = String(plain);
  t = LAYER_PREFIX + gcmEncrypt(k3, t); // 内层
  t = LAYER_PREFIX + gcmEncrypt(k2, t);
  t = LAYER_PREFIX + gcmEncrypt(k1, t); // 外层
  return PREFIX + t;
}

/**
 * 解密系统密钥（向后兼容旧单层密文）
 * @param {string} cipher
 * @returns {string}
 */
function decryptSecret(cipher) {
  if (!cipher) return '';
  const s = String(cipher);
  if (s.startsWith(PREFIX)) {
    const { k1, k2, k3 } = getKeys();
    if (!k1 || !k2) {
      throw new Error('生产环境缺少密钥，无法解密系统密钥');
    }
    let t = s.slice(PREFIX.length);
    if (!t.startsWith(LAYER_PREFIX)) throw new Error('ENV3 密文损坏');
    t = gcmDecrypt(k1, t.slice(LAYER_PREFIX.length)); // 外层
    if (!t.startsWith(LAYER_PREFIX)) throw new Error('ENV3 密文损坏');
    t = gcmDecrypt(k2, t.slice(LAYER_PREFIX.length));
    if (!t.startsWith(LAYER_PREFIX)) throw new Error('ENV3 密文损坏');
    t = gcmDecrypt(k3, t.slice(LAYER_PREFIX.length)); // 内层
    return t;
  }
  // 向后兼容：旧单层 AES-256-GCM（encrypt.js 产出），存量 SystemConfig 仍可读取
  return legacyDecrypt(s);
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// ---------------------------------------------------------------------------
// 启动期加载：.env.enc → process.env
// 仅在 .env.enc 存在时生效；否则调用方回退到 dotenv 加载明文 .env（不破坏现状）
// 注意：必须在 dotenv.config() 之前调用，且要求 VAULT_MASTER_KEY 已由部署平台注入进程环境
// ---------------------------------------------------------------------------
function loadVaultEnv(opts = {}) {
  const encPath = opts.encPath ||
    process.env.VAULT_ENV_FILE ||
    path.join(__dirname, '..', '.env.enc');
  if (!fs.existsSync(encPath)) return false;

  let content;
  try {
    content = fs.readFileSync(encPath, 'utf8');
  } catch (e) {
    console.warn('[secretVault] 读取 .env.enc 失败:', e.message);
    return false;
  }

  const lines = content.split(/\r?\n/);
  let ok = 0;
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    try {
      const decrypted = decryptSecret(val);
      if (decrypted !== '') {
        process.env[key] = decrypted;
        ok++;
      }
    } catch (e) {
      console.warn(`[secretVault] 解密 ${key} 失败（检查 VAULT_MASTER_KEY / 密钥文件 / 机器指纹）:`, e.message);
    }
  }
  console.log(`[secretVault] 已从 .env.enc 解密注入 ${ok} 项环境变量`);
  return true;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  hasAllKeys,
  loadVaultEnv,
  _resetKeyCache: () => { _keysCache = null; } // 仅供测试
};
