// routes/license.js - 授权许可证管理路由
const express = require('express');
const router = express.Router();
const { getLicenseStatus, activateLicense, getMachineFingerprint } = require('../utils/license');
const { clearCache } = require('../middleware/licenseCheck');
const logger = require('../utils/logger');

/**
 * GET /api/license/status
 * 获取当前授权状态（无需登录，白名单路径）
 */
router.get('/status', (req, res) => {
  const status = getLicenseStatus();
  res.json({
    success: true,
    data: status
  });
});

/**
 * GET /api/license/fingerprint
 * 获取服务器机器指纹（用于生成绑定密钥，白名单路径）
 * 开发者通过此接口获取服务器的机器指纹，然后生成一机一码的许可证
 */
router.get('/fingerprint', (req, res) => {
  const fp = getMachineFingerprint();
  res.json({
    success: true,
    data: {
      fingerprint: fp.short,
      fullFingerprint: fp.full
    }
  });
});

/**
 * POST /api/license/activate
 * 激活正式版本密钥
 * Body: { licenseKey: "base64编码的密钥" }
 */
router.post('/activate', (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({
      success: false,
      message: '请输入许可证密钥'
    });
  }

  const result = activateLicense(licenseKey);

  if (result.success) {
    // 清除缓存，让新许可证立即生效
    clearCache();
    logger.info('[License] 许可证已激活，缓存已清除');
  }

  return res.status(result.success ? 200 : 400).json({
    success: result.success,
    message: result.message,
    data: result.license || null
  });
});

module.exports = router;
