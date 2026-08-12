// utils/voice.js - 语音播报辅助（规格7.1.5：语音辅助）
// 使用微信同声传译插件 textToSpeech，插件不可用时静默降级。
// 注意：插件（wx069ba97219f66d99）未在公众平台后台授权，已从 app.json 移除声明。
// 如需启用语音播报，请在 mp.weixin.qq.com 后台添加插件后，在 app.json 重新声明：
//   "plugins": { "WechatSI": { "version": "0.3.5", "provider": "wx069ba97219f66d99" } }

let ttsEngine = null;
let ttsAvailable = null; // null=未检测, true=可用, false=不可用

/**
 * 初始化TTS引擎（懒加载，首次调用时检测插件可用性）
 */
function initTTS() {
  if (ttsAvailable !== null) return ttsAvailable;

  try {
    const plugin = requirePlugin('WechatSI');
    if (plugin && plugin.textToSpeech) {
      ttsEngine = plugin.textToSpeech();
      ttsAvailable = true;
    } else {
      ttsAvailable = false;
    }
  } catch (e) {
    // 插件未声明或不可用，静默降级
    ttsAvailable = false;
  }
  return ttsAvailable;
}

/**
 * 语音播报（规格7.1.5）
 * @param {string} text - 要播报的文本
 */
function speak(text) {
  if (!initTTS() || !text) return;

  try {
    ttsEngine.stop();
    ttsEngine.play({
      text,
      success: () => {},
      fail: () => {}
    });
  } catch (e) {
    // 播报失败静默处理，不影响主流程
  }
}

/**
 * 停止语音播报
 */
function stop() {
  if (!initTTS() || !ttsEngine) return;
  try {
    ttsEngine.stop();
  } catch (e) {}
}

module.exports = { speak, stop, initTTS };
