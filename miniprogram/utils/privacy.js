// utils/privacy.js - 隐私协议状态管理工具
// 用于在 app.js 和页面中检查用户是否同意隐私协议

const PRIVACY_AGREED_KEY = 'privacy_agreed_v1';

// 检查是否已同意隐私协议
function hasAgreedPrivacy() {
  try {
    return wx.getStorageSync(PRIVACY_AGREED_KEY) === true;
  } catch (e) {
    return false;
  }
}

// 同意隐私协议
function agreePrivacy() {
  try {
    wx.setStorageSync(PRIVACY_AGREED_KEY, true);
    wx.setStorageSync(`${PRIVACY_AGREED_KEY}_time`, Date.now());
    return true;
  } catch (e) {
    console.error('保存隐私协议状态失败:', e);
    return false;
  }
}

// 重置隐私协议状态（用于测试或用户拒绝后重新同意）
function resetPrivacyAgreement() {
  try {
    wx.removeStorageSync(PRIVACY_AGREED_KEY);
    wx.removeStorageSync(`${PRIVACY_AGREED_KEY}_time`);
  } catch (e) {}
}

// 获取同意时间
function getPrivacyAgreeTime() {
  try {
    return wx.getStorageSync(`${PRIVACY_AGREED_KEY}_time`) || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hasAgreedPrivacy,
  agreePrivacy,
  resetPrivacyAgreement,
  getPrivacyAgreeTime,
  PRIVACY_AGREED_KEY
};
