// services/oss.js - 对象存储服务（支持腾讯云COS + 阿里云OSS双模式）
// 优先使用腾讯云COS（部署到腾讯云时），未配置时回退阿里云OSS，均未配置时本地存储
const logger = require('../utils/logger');

let client = null;
let provider = 'local'; // 'cos' | 'oss' | 'local'
let cosBucketRegion = '';

/**
 * 初始化：优先 COS，次选 OSS，兜底本地
 */
function init() {
  // 腾讯云 COS 优先
  const cosSecretId = process.env.COS_SECRET_ID;
  const cosSecretKey = process.env.COS_SECRET_KEY;
  const cosBucket = process.env.COS_BUCKET;
  const cosRegion = process.env.COS_REGION;

  if (cosSecretId && cosSecretKey && cosBucket && cosRegion && !cosSecretId.startsWith('your_')) {
    try {
      const COS = require('cos-nodejs-sdk-v5');
      client = new COS({
        SecretId: cosSecretId,
        SecretKey: cosSecretKey
      });
      cosBucketRegion = cosRegion;
      provider = 'cos';
      logger.info(`COS存储已启用: bucket=${cosBucket}, region=${cosRegion}`);
    } catch (err) {
      logger.warn('cos-nodejs-sdk-v5 加载失败，尝试阿里云OSS:', err.message);
      client = null;
    }
  }

  // 阿里云 OSS 次选
  if (provider === 'local') {
    const ossAccessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const ossAccessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const ossBucket = process.env.OSS_BUCKET;
    const ossEndpoint = process.env.OSS_ENDPOINT;

    if (ossAccessKeyId && ossAccessKeySecret && ossBucket && ossEndpoint && !ossAccessKeyId.startsWith('your_')) {
      try {
        const OSS = require('ali-oss');
        const ossRegion = process.env.OSS_REGION || 'oss-cn-hangzhou';
        client = new OSS({
          region: ossRegion,
          accessKeyId: ossAccessKeyId,
          accessKeySecret: ossAccessKeySecret,
          bucket: ossBucket,
          endpoint: ossEndpoint
        });
        provider = 'oss';
        logger.info('OSS存储已启用（阿里云）');
      } catch (err) {
        logger.warn('ali-oss 加载失败，使用本地存储:', err.message);
        client = null;
      }
    } else {
      logger.warn('OSS/COS均未配置，文件将使用本地存储');
    }
  }
}

init();

/**
 * 上传文件
 * @param {string} localPath - 本地文件路径
 * @param {string} objectKey - 对象键（如 meals/123/xxx.jpg）
 * @returns {Promise<{url: string|null, local: boolean}>}
 */
async function uploadFile(localPath, objectKey) {
  if (!client || provider === 'local') {
    return { url: null, local: true };
  }

  try {
    if (provider === 'cos') {
      const bucket = process.env.COS_BUCKET;
      const result = await new Promise((resolve, reject) => {
        client.uploadFile({
          Bucket: bucket,
          Region: cosBucketRegion,
          Key: objectKey,
          FilePath: localPath
        }, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });
      // COS 返回的可访问URL
      const url = `https://${bucket}.cos.${cosBucketRegion}.myqcloud.com/${objectKey}`;
      return { url, local: false };
    }

    if (provider === 'oss') {
      const result = await client.put(objectKey, localPath);
      return { url: result.url, local: false };
    }
  } catch (err) {
    logger.error(`${provider.toUpperCase()}上传失败:`, err.message);
    return { url: null, local: true };
  }
}

/**
 * 删除文件
 * @param {string} objectKey - 对象键
 * @returns {Promise<boolean>}
 */
async function deleteFile(objectKey) {
  if (!client || provider === 'local') return false;

  try {
    if (provider === 'cos') {
      const bucket = process.env.COS_BUCKET;
      await new Promise((resolve, reject) => {
        client.deleteObject({
          Bucket: bucket,
          Region: cosBucketRegion,
          Key: objectKey
        }, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });
      return true;
    }

    if (provider === 'oss') {
      await client.delete(objectKey);
      return true;
    }
  } catch (err) {
    logger.error(`${provider.toUpperCase()}删除失败:`, err.message);
    return false;
  }
}

function isEnabled() { return provider !== 'local'; }
function getProvider() { return provider; }

module.exports = { uploadFile, deleteFile, isEnabled, getProvider, init };
