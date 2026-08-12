// utils/logger.js - 小程序日志与错误上报
// 基于 wx.getLogManager() 的本地日志 + 后端错误上报双通道

const LOG_TAG = 'app_log';
const ERROR_LOG_TAG = 'error_log';
const MAX_LOGS = 100;

// 敏感字段列表（日志上报时需要过滤）
const SENSITIVE_FIELDS = ['token', 'openid', 'password', 'secret', 'code', 'nickName', 'nick_name', 'mobile', 'phone'];

let logManager = null;
let initDone = false;

// 过滤敏感信息
function sanitizeData(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    // 如果是 JSON 字符串，尝试解析后过滤
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(sanitizeData(parsed));
    } catch {
      // 简单字符串过滤
      let result = data;
      SENSITIVE_FIELDS.forEach(field => {
        const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
        result = result.replace(regex, `"${field}":"***"`);
      });
      return result;
    }
  }
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item));
    }
    const result = {};
    Object.keys(data).forEach(key => {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        result[key] = '***';
      } else {
        result[key] = sanitizeData(data[key]);
      }
    });
    return result;
  }
  return data;
}

function initLogger() {
  if (initDone) return;
  initDone = true;

  try {
    if (wx.getLogManager) {
      logManager = wx.getLogManager({ level: 1 });
    }
  } catch (e) {
    // 低版本微信不支持，降级为 console
  }

  // 捕获全局 JS 错误
  if (wx.onError) {
    wx.onError((err) => {
      const errInfo = {
        type: 'js_error',
        message: typeof err === 'string' ? err : (err && err.message) || '未知错误',
        stack: err && err.stack ? err.stack : '',
        timestamp: Date.now(),
        env: (getApp() && getApp().globalData && getApp().globalData.env) || 'unknown'
      };
      writeError(errInfo);
      uploadError(errInfo);
    });
  }
}

function writeLog(msg, data) {
  const entry = `[${new Date().toISOString()}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  if (logManager) {
    try {
      logManager.write({ logName: LOG_TAG, logs: [entry] });
    } catch (e) {
      console.log(entry);
    }
  } else {
    console.log(entry);
  }
}

function writeError(errInfo) {
  const entry = `[${new Date().toISOString()}] ERROR ${errInfo.type}: ${errInfo.message}`;
  if (logManager) {
    try {
      logManager.write({ logName: ERROR_LOG_TAG, logs: [entry] });
    } catch (e) {
      console.error(entry);
    }
  } else {
    console.error(entry);
  }
}

function getLogs(logName) {
  return new Promise((resolve) => {
    if (!logManager) { resolve([]); return; }
    try {
      logManager.readLog({
        logName: logName || LOG_TAG,
        count: MAX_LOGS,
        success: (res) => resolve(res.data || []),
        fail: () => resolve([])
      });
    } catch (e) {
      resolve([]);
    }
  });
}

// 上报错误到后端（静默，不阻塞用户流程）
const _pendingErrors = [];
let _uploadTimer = null;

function uploadError(errInfo) {
  const app = getApp();
  if (!app || !app.globalData || !app.globalData.baseUrl) return;

  // 过滤敏感信息后再上报
  const sanitizedErrInfo = sanitizeData(errInfo);
  _pendingErrors.push(sanitizedErrInfo);

  // 防抖：3 秒内批量上报一次
  if (!_uploadTimer) {
    _uploadTimer = setTimeout(() => {
      _uploadTimer = null;
      const errors = _pendingErrors.splice(0);
      if (errors.length === 0) return;

      wx.request({
        url: `${app.globalData.baseUrl}/client/errors`,
        method: 'POST',
        data: { errors },
        header: { 'Content-Type': 'application/json' },
        // 静默上报，不显示任何 UI
        success: () => {},
        fail: () => {}
      });
    }, 3000);
  }
}

// 上报 API 请求错误（由 request.js 调用）
function reportApiError(url, statusCode, message) {
  const errInfo = {
    type: 'api_error',
    url,
    statusCode,
    message: sanitizeData(message),
    timestamp: Date.now(),
    env: (getApp() && getApp().globalData && getApp().globalData.env) || 'unknown'
  };
  writeError(errInfo);
  uploadError(errInfo);
}

// 上报业务事件（用于运营分析）
function reportEvent(eventName, data) {
  const app = getApp();
  if (!app || !app.globalData || !app.globalData.baseUrl) return;

  // 过滤敏感信息后再上报
  const sanitizedData = sanitizeData(data);

  wx.request({
    url: `${app.globalData.baseUrl}/client/events`,
    method: 'POST',
    data: { event: eventName, data: sanitizedData, timestamp: Date.now() },
    header: { 'Content-Type': 'application/json' },
    success: () => {},
    fail: () => {}
  });
}

module.exports = {
  initLogger,
  writeLog,
  writeError,
  getLogs,
  uploadError,
  reportApiError,
  reportEvent,
  sanitizeData
};
