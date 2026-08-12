// utils/surprise.js - 积分惊喜激励（规格6.2）
// 获得积分后随机显示惊喜提示词，应用于所有积分获取场景

// 惊喜激励提示词（严格对照规格6.2，含emoji）
const SURPRISE_MESSAGES = [
  '🎉 太棒了！离健康目标又近了一步！',
  '💪 坚持就是胜利，继续加油！',
  '🌟 您今天的努力，明天的健康！',
  '🏆 超越昨天的自己，真棒！',
  '🎁 积分翻倍卡已放入您的账户！',
  '⭐ 连续打卡 7 天可获得额外奖励哦！'
];

/**
 * 获取惊喜激励消息（规格6.2）
 * @param {number} points - 获得的积分数量
 * @returns {string} 拼接后的惊喜消息
 */
function getSurpriseMessage(points) {
  const baseMessage = `恭喜您获得${points}积分！`;
  const surprise = SURPRISE_MESSAGES[Math.floor(Math.random() * SURPRISE_MESSAGES.length)];
  return `${baseMessage}\n${surprise}`;
}

module.exports = { SURPRISE_MESSAGES, getSurpriseMessage };
