// routes/client.js - 客户端错误与事件收集
// 用于收集微信小程序端的 JS 错误、API 错误和业务事件
// 无需登录，静默写入日志
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// 内存缓冲区：异步批量写入，避免频繁 IO
const _errorBuffer = [];
const _eventBuffer = [];
const BUFFER_MAX = 50;
const FLUSH_INTERVAL = 30 * 1000; // 30秒

let _flushTimer = null;

function flushErrors() {
  if (_errorBuffer.length === 0) return;
  const errors = _errorBuffer.splice(0);
  logger.error('[ClientError]', JSON.stringify(errors));
}

function flushEvents() {
  if (_eventBuffer.length === 0) return;
  const events = _eventBuffer.splice(0);
  logger.info('[ClientEvent]', JSON.stringify(events));
}

function startFlushTimer() {
  if (_flushTimer) return;
  _flushTimer = setInterval(() => {
    flushErrors();
    flushEvents();
  }, FLUSH_INTERVAL);
}

// POST /client/errors - 批量上报客户端错误
router.post('/errors', (req, res) => {
  try {
    const errors = req.body.errors;
    if (!Array.isArray(errors)) {
      return res.status(400).json({ success: false, message: 'errors must be array' });
    }

    const capped = errors.slice(0, 20); // 单次最多接受20条
    _errorBuffer.push(...capped);

    // 达到阈值立即刷新
    if (_errorBuffer.length >= BUFFER_MAX) {
      flushErrors();
    }
    startFlushTimer();

    res.json({ success: true, message: 'ok' });
  } catch (e) {
    logger.error('[ClientError] 解析失败:', e.message);
    res.status(500).json({ success: false });
  }
});

// POST /client/events - 上报业务事件
router.post('/events', (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    if (!event) {
      return res.status(400).json({ success: false, message: 'event required' });
    }

    _eventBuffer.push({ event, data, timestamp, serverTime: Date.now() });

    if (_eventBuffer.length >= BUFFER_MAX) {
      flushEvents();
    }
    startFlushTimer();

    res.json({ success: true, message: 'ok' });
  } catch (e) {
    logger.error('[ClientEvent] 解析失败:', e.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
