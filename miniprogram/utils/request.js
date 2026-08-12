// utils/request.js - API请求封装（含GET缓存 + 图片压缩 + 错误监控 + 网络检测）
const logger = require('./logger.js');

// GET 请求内存缓存（TTL 30秒，避免频繁刷新重复请求）
const _cache = new Map();
const CACHE_TTL = 30 * 1000;

// 网络状态管理
let _networkStatus = 'unknown';
let _networkListeners = [];

// 初始化网络状态检测
function initNetworkStatus() {
  if (wx.onNetworkChange) {
    wx.onNetworkChange((res) => {
      _networkStatus = res.networkType;
      _networkListeners.forEach(fn => {
        try { fn(res.networkType); } catch (e) {}
      });
      // 弱网提示
      if (res.networkType === '2g' || res.networkType === '3g') {
        wx.showToast({
          title: '当前网络信号较弱',
          icon: 'none',
          duration: 2000
        });
      } else if (res.networkType === 'none') {
        wx.showToast({
          title: '网络已断开连接',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }

  // 获取当前网络状态
  if (wx.getNetworkType) {
    wx.getNetworkType({
      success: (res) => {
        _networkStatus = res.networkType;
      }
    });
  }
}

// 获取当前网络状态
function getNetworkStatus() {
  return _networkStatus;
}

// 监听网络状态变化
function onNetworkChange(callback) {
  if (typeof callback === 'function') {
    _networkListeners.push(callback);
  }
}

/**
 * 封装的请求方法
 * @param {Object} options 请求配置
 */
function request(options) {
  const app = getApp();
  const token = wx.getStorageSync('token');

  // 网络状态检查：无网络时直接提示
  if (_networkStatus === 'none' && !options.ignoreNetworkCheck) {
    wx.showToast({
      title: '网络已断开，请检查网络连接',
      icon: 'none',
      duration: 2000
    });
    return Promise.reject({ message: '网络已断开' });
  }

  // GET 缓存：30秒内相同URL+参数复用结果
  if (options.method === 'GET' && options.cache !== false) {
    const cacheKey = `${options.url}:${JSON.stringify(options.data || {})}`;
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
  }

  return new Promise((resolve, reject) => {
    const requestTask = wx.request({
      url: `${app.globalData.baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.header
      },
      timeout: options.timeout || 10000, // 默认10秒超时
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.success) {
            // 写入GET缓存
            if (options.method === 'GET' || (!options.method && options.cache !== false)) {
              const cacheKey = `${options.url}:${JSON.stringify(options.data || {})}`;
              _cache.set(cacheKey, { data: res.data, ts: Date.now() });
            }
            resolve(res.data);
          } else {
            // 业务错误（silent 模式下不弹提示）
            logger.reportApiError(options.url, res.statusCode, res.data.message || '业务错误');
            if (!options.silent) handleError(res.data);
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          // 管理员登录接口（web-login）的 401 是密码错误，不触发重新登录
          // 且不弹 toast（由调用方 doAdminLogin 的 catch 块统一处理）
          if (options.url && options.url.includes('/auth/web-login')) {
            reject(res.data);
          } else {
            // token过期,重新登录
            app.login();
            reject({ message: '登录已过期,请重新登录' });
          }
        } else if (res.data && res.data.message) {
          // 业务错误（400/403/429/500等），silent 模式下不弹提示
          // web-login 的错误由调用方 doAdminLogin 统一处理，避免重复弹 toast
          logger.reportApiError(options.url, res.statusCode, res.data.message || '请求错误');
          if (!options.silent && !(options.url && options.url.includes('/auth/web-login'))) {
            handleError(res.data);
          }
          reject(res.data);
        } else {
          // HTTP错误
          logger.reportApiError(options.url, res.statusCode, 'HTTP错误');
          reject({ message: '网络请求失败' });
        }
      },
      fail: (err) => {
        const errMsg = (err && err.errMsg) || '';
        logger.reportApiError(options.url, 0, errMsg || '网络连接失败');
        console.error('请求失败:', err);

        // 域名白名单校验失败：不弹 toast（避免刷屏），但上报日志
        if (errMsg.indexOf('not in domain list') !== -1) {
          console.error('[域名白名单] URL:', options.url, '不在合法域名列表中');
          reject({ message: '域名未配置' });
          return;
        }

        // 超时或网络问题提示
        if (errMsg.indexOf('timeout') !== -1) {
          wx.showToast({
            title: '请求超时，请检查网络',
            icon: 'none',
            duration: 2000
          });
        } else if (errMsg.indexOf('fail') !== -1) {
          // 网络连接失败时显示友好提示
          const networkType = _networkStatus;
          let tipText = '网络连接失败';
          if (networkType === '2g' || networkType === '3g') {
            tipText = '网络信号较弱，请稍后重试';
          } else if (networkType === 'none') {
            tipText = '网络已断开，请检查网络连接';
          }
          wx.showToast({
            title: tipText,
            icon: 'none',
            duration: 2000
          });
        } else {
          wx.showToast({
            title: '网络连接失败',
            icon: 'none'
          });
        }
        reject(err);
      }
    });
  });
}

/**
 * 清除指定URL的缓存（数据变更后调用）
 * @param {string} [url] - 指定URL前缀，不传则清空全部
 */
function clearCache(url) {
  if (!url) {
    _cache.clear();
    return;
  }
  for (const key of _cache.keys()) {
    if (key.startsWith(url)) {
      _cache.delete(key);
    }
  }
}

/**
 * 错误处理
 */
function handleError(error) {
  // P1修复：仅记录错误消息，不记录完整对象（可能含敏感信息）
  console.error('业务错误:', error.message || error.code || '未知错误');

  if (error.code === 'TOKEN_EXPIRED') {
    wx.showModal({
      title: '提示',
      content: '登录已过期,请重新登录',
      showCancel: false,
      success: () => {
        const app = getApp();
        if (app) app.login();
      }
    });
  } else {
    wx.showToast({
      title: error.message || '操作失败',
      icon: 'none'
    });
  }
}

/**
 * GET请求
 */
function get(url, data = {}, silent = false) {
  return request({
    url,
    method: 'GET',
    data,
    silent
  });
}

/**
 * POST请求
 */
function post(url, data = {}) {
  return request({
    url,
    method: 'POST',
    data,
    cache: false
  });
}

/**
 * PUT请求
 */
function put(url, data = {}) {
  return request({
    url,
    method: 'PUT',
    data,
    cache: false
  });
}

/**
 * DELETE请求
 */
function del(url, data = {}) {
  return request({
    url,
    method: 'DELETE',
    data,
    cache: false
  });
}

/**
 * 获取文件大小（MB）
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（MB）
 */
function getFileSize(filePath) {
  return new Promise((resolve) => {
    wx.getFileInfo({
      filePath,
      success: (res) => {
        resolve(res.size / (1024 * 1024)); // 转换为 MB
      },
      fail: () => {
        resolve(0);
      }
    });
  });
}

/**
 * 智能压缩图片（根据大小自适应压缩质量，最大限制 2MB）
 * @param {string} filePath - 原始图片临时路径
 * @param {Object} [options] - 压缩选项
 * @param {number} [options.maxSizeMB=2] - 最大文件大小（MB）
 * @param {number} [options.minQuality=50] - 最小压缩质量（0-100）
 * @param {number} [options.maxQuality=90] - 最大压缩质量（0-100）
 * @returns {Promise<string>} 压缩后的临时路径
 */
async function compressImage(filePath, options = {}) {
  const {
    maxSizeMB = 2,
    minQuality = 50,
    maxQuality = 90
  } = options;

  try {
    // 获取原始文件大小
    const originalSize = await getFileSize(filePath);
    
    // 如果文件已经小于限制，直接返回
    if (originalSize <= maxSizeMB && originalSize > 0) {
      return filePath;
    }

    // 根据文件大小计算压缩质量
    let quality;
    if (originalSize > 10) {
      // 大于10MB：压缩到最低质量
      quality = minQuality;
    } else if (originalSize > 5) {
      // 大于5MB：低质量压缩
      quality = 60;
    } else if (originalSize > maxSizeMB) {
      // 大于2MB：中等压缩
      quality = 75;
    } else {
      quality = maxQuality;
    }

    // 执行压缩
    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality,
        success: async (res) => {
          // 检查压缩后大小
          const compressedSize = await getFileSize(res.tempFilePath);
          
          // 如果压缩后仍然太大，进一步压缩
          if (compressedSize > maxSizeMB && quality > minQuality) {
            const furtherQuality = Math.max(minQuality, quality - 15);
            wx.compressImage({
              src: res.tempFilePath,
              quality: furtherQuality,
              success: (res2) => resolve(res2.tempFilePath),
              fail: () => resolve(res.tempFilePath)
            });
          } else {
            resolve(res.tempFilePath);
          }
        },
        fail: () => {
          // 压缩失败使用原图
          resolve(filePath);
        }
      });
    });
  } catch (e) {
    // 任何错误都使用原图
    console.error('图片压缩失败:', e);
    return filePath;
  }
}

/**
 * 上传文件（自动压缩图片）
 * @param {string} filePath - 文件路径
 * @param {Object} formData - 附加表单数据
 * @param {string} path - 上传接口路径，默认 /clock-in/image
 */
async function uploadFile(filePath, formData = {}, path = '/clock-in/image') {
  // 必须在本函数作用域内获取 app：模块顶层没有 app 变量，
  // 直接引用会抛 ReferenceError，导致图片打卡上传恒定失败。
  const app = getApp();
  const token = wx.getStorageSync('token');

  // 上传前压缩图片（减少传输体积，提升AI识别速度）
  const compressedPath = await compressImage(filePath);

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.baseUrl}${path}`,
      filePath: compressedPath,
      name: 'image',
      header: {
        'Authorization': `Bearer ${token}`
      },
      formData: formData,
      success: (res) => {
        const data = JSON.parse(res.data);
        if (data.success) {
          resolve(data);
        } else {
          reject(data);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  uploadFile,
  compressImage,
  getFileSize,
  clearCache,
  initNetworkStatus,
  getNetworkStatus,
  onNetworkChange
};
