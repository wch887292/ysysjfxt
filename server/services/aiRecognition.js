// services/aiRecognition.js - AI识别服务（基于视觉模型）
// 规格12.3：AI 识别是否包含食物，验证响应时间 < 3 秒
// 规格7.3：食物识别 confidence < 0.6 视为非食物
const axios = require('axios');
const logger = require('../utils/logger');

// 环境变量默认值（DB配置优先，环境变量兜底）
const ENV_AI_URL = process.env.AI_VISION_URL || process.env.AI_SERVICE_URL;
const ENV_AI_KEY = process.env.AI_VISION_KEY || process.env.AI_SERVICE_KEY;
const ENV_AI_MODEL = process.env.AI_VISION_MODEL || process.env.AI_SERVICE_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';

/**
 * 获取AI视觉模型配置（优先从SystemConfig读取，回退环境变量）
 */
async function getVisionAIConfig() {
  try {
    const db = require('../models');
    const row = async (key) => {
      const r = await db.SystemConfig.findOne({ where: { config_key: key } });
      return r ? r.config_value : null;
    };
    const decryptRow = async (key) => {
      const r = await db.SystemConfig.findOne({ where: { config_key: key } });
      if (!r) return null;
      try {
        const { decrypt } = require('../utils/encrypt');
        return decrypt(r.config_value);
      } catch {
        return null;
      }
    };

    const visionUrl = await row('ai_vision.service_url');
    const visionKey = await decryptRow('ai_vision.service_key');
    const visionModel = await row('ai_vision.model');

    return {
      url: visionUrl || ENV_AI_URL,
      key: visionKey || ENV_AI_KEY,
      model: visionModel || ENV_AI_MODEL
    };
  } catch {
    return { url: ENV_AI_URL, key: ENV_AI_KEY, model: ENV_AI_MODEL };
  }
}

// 规格12.3：验证响应时间 < 3 秒
const AI_RECOGNITION_TIMEOUT = 2800; // 留 200ms 给 OSS/DB，确保端到端 < 3s

// 食物识别置信度阈值（与 contentSecurity 保持一致）
const FOOD_CONFIDENCE_THRESHOLD = 0.6;

/**
 * AI识别食物（调用硅基流动视觉模型）
 * 规格12.3：返回真实 confidence；非食物时抛错而非随机模拟
 * 规格12.3：AI 服务未配置时 fail-safe 拒绝（不静默放行）
 */
async function recognizeFood(imagePath) {
  const aiConfig = await getVisionAIConfig();
  // 规格12.3 fail-safe：AI 服务未配置时拒绝识别，不降级到随机模拟
  if (!aiConfig.url || !aiConfig.key) {
    logger.error('AI识别服务未配置，fail-safe 拒绝识别（规格12.3：不降级到随机模拟）');
    throw new Error('AI识别服务未配置，无法进行食物识别');
  }

  const fs = require('fs');
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = imagePath.toLowerCase().endsWith('.png') ? 'image/png'
            : imagePath.toLowerCase().endsWith('.gif') ? 'image/gif'
            : 'image/jpeg';
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${ext};base64,${base64Image}`;

  const prompt = '你是一个食物识别专家。请识别这张图片中的食物，并用JSON格式返回结果（只返回JSON，不要任何额外文字）：{"foodType":"食物名称","foodCategory":"分类","healthScore":健康评分0到100,"confidence":置信度0.0到1.0,"description":"简短描述"}。其中foodCategory必须是以下之一：healthy_meal(健康餐食/沙拉)、vegetable(蔬菜)、fruit(水果)、water(水/饮品)、other(其他食物)。如果图片不是食物，请返回：{"foodType":"非食物","foodCategory":"other","healthScore":0,"confidence":0.0,"description":"未识别到食物"}';

  const response = await axios.post(aiConfig.url, {
    model: aiConfig.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: prompt }
      ]
    }],
    max_tokens: 300,
    temperature: 0.1
  }, {
    headers: {
      'Authorization': `Bearer ${aiConfig.key}`,
      'Content-Type': 'application/json'
    },
    timeout: AI_RECOGNITION_TIMEOUT // 规格12.3：单次调用 < 2.8s
  });

  const content = response.data.choices[0].message.content || '';

  // 提取JSON（模型可能返回带```json的格式）
  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    logger.warn('AI未返回有效JSON:', content);
    throw new Error('AI识别返回格式异常');
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (e) {
    logger.warn('AI返回JSON解析失败:', content);
    throw new Error('AI识别返回JSON解析失败');
  }

  // 字段规范化
  const validCategories = ['healthy_meal', 'vegetable', 'fruit', 'water', 'other'];
  if (!validCategories.includes(result.foodCategory)) {
    result.foodCategory = 'other';
  }
  result.healthScore = Math.max(0, Math.min(100, parseInt(result.healthScore) || 70));
  result.foodType = result.foodType || '未知食物';
  result.description = result.description || 'AI识别完成';
  // 规格12.3：使用模型返回的真实 confidence，不再硬编码 0.9
  result.confidence = Math.max(0, Math.min(1, parseFloat(result.confidence) || 0));

  // 规格7.3：非食物或低置信度时拒绝（不创建打卡记录）
  if (result.foodType === '非食物' || result.confidence < FOOD_CONFIDENCE_THRESHOLD) {
    logger.warn(`AI识别为非食物或置信度过低: foodType=${result.foodType}, confidence=${result.confidence}`);
    const err = new Error('请上传饮食相关图片');
    err.code = 'NOT_FOOD';
    err.aiResult = result;
    throw err;
  }

  logger.info(`AI识别成功: ${result.foodType} / ${result.foodCategory} / ${result.healthScore}分 / confidence=${result.confidence}`);
  return result;
}

module.exports = { recognizeFood };
