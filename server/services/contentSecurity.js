// services/contentSecurity.js - 内容安全验证服务（基于硅基流动视觉模型）
// 规格7.3：图片需双重验证 — (1) 违规内容检测 (2) 食物内容识别(confidence>=0.6)
// 规格12.3：验证响应时间 < 3 秒；服务未配置时 fail-safe 拒绝（不静默放行）
const axios = require('axios');
const logger = require('../utils/logger');

const CONTENT_SECURITY_URL = process.env.CONTENT_SECURITY_URL;
const CONTENT_SECURITY_KEY = process.env.CONTENT_SECURITY_KEY;
const CONTENT_SECURITY_MODEL = process.env.CONTENT_SECURITY_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';

// 文本任务模型配置（纯文本模型）
const TEXT_SERVICE_URL = process.env.TEXT_SERVICE_URL || CONTENT_SECURITY_URL;
const TEXT_SERVICE_KEY = process.env.TEXT_SERVICE_KEY || CONTENT_SECURITY_KEY;
const TEXT_SERVICE_MODEL = process.env.TEXT_SERVICE_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';

// 食物识别置信度阈值（规格7.3：confidence < 0.6 视为非食物）
const FOOD_CONFIDENCE_THRESHOLD = 0.6;

// 规格12.3：验证响应时间 < 3 秒
// 注意：2.8s 超时对大图（手机拍照 3-5MB）不够，API 处理大图需 5-15s
// 实际超时设为 15s，前端需配合显示"AI识别中"等待提示
const CONTENT_SECURITY_TIMEOUT = 15000;

// 合法食物分类白名单（与 aiRecognition.js 保持一致）
const VALID_FOOD_CATEGORIES = ['healthy_meal', 'vegetable', 'fruit', 'water', 'other'];

/**
 * 图片内容安全检测（规格7.3：违规内容检测 + 食物内容识别）
 * 规格12.3：服务未配置或调用失败时 fail-safe 拒绝（不降级到 localCheck 静默放行）
 *
 * 优化合并：原 aiRecognition.recognizeFood 的食物详细识别（foodType/foodCategory/healthScore/description）
 * 已合并进本函数的单次 API 调用，避免两次串行调用导致端到端超 3s。
 * 通过本函数返回的 aiResult 字段包含食物识别详细信息，调用方可直接使用。
 */
async function checkImage(imagePath) {
  // 规格12.3 fail-safe：服务未配置时拒绝，不降级到 localCheck
  if (!CONTENT_SECURITY_URL || !CONTENT_SECURITY_KEY) {
    logger.error('内容安全服务未配置，fail-safe 拒绝（规格12.3：不静默放行）');
    return { pass: false, message: '内容安全服务未配置，无法验证图片' };
  }

  const fs = require('fs');
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = imagePath.toLowerCase().endsWith('.png') ? 'image/png'
            : imagePath.toLowerCase().endsWith('.gif') ? 'image/gif'
            : 'image/jpeg';
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = 'data:' + ext + ';base64,' + base64Image;

  // 规格7.3 + 12.3 优化：单次调用同时完成违规检测 + 食物详细识别
  // prompt 一次返回所有字段，避免与 aiRecognition.recognizeFood 串行调用
  const prompt = '你是图片审核与食物识别专家。请审核这张图片并一次返回完整结果：1) 是否存在违规内容（色情、暴力恐怖、政治敏感、广告欺诈、违禁品）；2) 是否为食物/饮食相关图片；3) 若是食物，识别食物名称、分类、健康评分。用JSON格式返回（只返回JSON，不要任何额外文字）：{"pass":true或false,"isFood":true或false,"foodConfidence":0.0到1.0,"foodType":"食物名称","foodCategory":"分类","healthScore":0到100的整数,"description":"简短描述","reason":"如果不通过说明原因"}。其中foodCategory必须是以下之一：healthy_meal(健康餐食/沙拉)、vegetable(蔬菜)、fruit(水果)、water(水/饮品)、other(其他食物)。如果图片正常且是食物，示例返回：{"pass":true,"isFood":true,"foodConfidence":0.9,"foodType":"蔬菜沙拉","foodCategory":"healthy_meal","healthScore":85,"description":"富含纤维的健康餐","reason":"内容安全"}。如果图片不是食物，示例：{"pass":true,"isFood":false,"foodConfidence":0.1,"foodType":"非食物","foodCategory":"other","healthScore":0,"description":"未识别到食物","reason":"非食物图片"}';

  try {
    const response = await axios.post(CONTENT_SECURITY_URL, {
      model: CONTENT_SECURITY_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt }
        ]
      }],
      max_tokens: 400, // 优化：从 200 提到 400，因为要返回更多字段（foodType/healthScore/description）
      temperature: 0.1
    }, {
      headers: {
        'Authorization': 'Bearer ' + CONTENT_SECURITY_KEY,
        'Content-Type': 'application/json'
      },
      timeout: CONTENT_SECURITY_TIMEOUT // 规格12.3：单次调用 < 2.8s
    });

    const content = response.data.choices[0].message.content || '';
    // AI 可能返回 ```json ... ``` 包裹的内容，先去除代码块标记
    const cleanedContent = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    // 贪婪匹配最外层 JSON 对象（避免非贪婪在嵌套对象中过早截断）
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);

        // (1) 违规内容检测
        if (!result.pass) {
          return {
            pass: false,
            message: '图片不合规: ' + (result.reason || '内容不安全')
          };
        }

        // (2) 食物内容识别（规格7.3：confidence < 0.6 视为非食物）
        const foodConfidence = Number(result.foodConfidence || 0);
        if (!result.isFood || foodConfidence < FOOD_CONFIDENCE_THRESHOLD) {
          return {
            pass: false,
            message: '请上传饮食相关图片'
          };
        }

        // (3) 食物详细识别字段规范化（原 aiRecognition.recognizeFood 逻辑）
        const foodCategory = VALID_FOOD_CATEGORIES.includes(result.foodCategory)
          ? result.foodCategory
          : 'other';
        const healthScore = Math.max(0, Math.min(100, parseInt(result.healthScore) || 70));
        const foodType = result.foodType || '未知食物';
        const description = result.description || 'AI识别完成';
        const confidence = Math.max(0, Math.min(1, parseFloat(result.foodConfidence) || 0));

        return {
          pass: true,
          message: '内容安全验证通过',
          foodConfidence,
          // 合并字段：原 aiRecognition.recognizeFood 的返回值
          aiResult: {
            foodType,
            foodCategory,
            healthScore,
            confidence,
            description
          }
        };
      } catch (e) {
        logger.warn('内容安全返回JSON解析失败:', content);
        return { pass: false, message: '内容安全验证异常，请重试' };
      }
    }

    // 规格12.3：返回格式异常时 fail-safe 拒绝
    return { pass: false, message: '内容安全验证异常，请重试' };

  } catch (err) {
    // 规格12.3：调用失败时 fail-safe 拒绝（不降级到 localCheck）
    const detail = err.response
      ? `status=${err.response.status} data=${JSON.stringify(err.response.data)}`
      : `name=${err.name} message=${err.message} code=${err.code}`;
    logger.error('内容安全服务调用失败:', detail);
    return { pass: false, message: '内容安全验证服务暂时不可用，请稍后重试' };
  }
}

/**
 * 文本内容安全检测（使用纯文本模型）
 * 规格12.3：与 checkImage 一致，服务未配置或调用失败时 fail-safe 拒绝（不静默放行）
 */
async function checkText(text) {
  try {
    // P1修复：原代码 fail-open（pass:true 降级），与 checkImage 的 fail-closed 策略不一致，
    // 代理商发布信息（店面信息发布）的文本内容可能包含违规内容却因降级被放行。
    // 改为 fail-safe 拒绝，与 checkImage 保持一致。
    if (!TEXT_SERVICE_URL || !TEXT_SERVICE_KEY) {
      logger.error('文本安全服务未配置，fail-safe 拒绝（规格12.3：不静默放行）');
      return { pass: false, message: '文本安全服务未配置，无法验证内容' };
    }

    const response = await axios.post(TEXT_SERVICE_URL, {
      model: TEXT_SERVICE_MODEL,
      messages: [{
        role: 'user',
        content: '你是内容安全审核专家。请审核以下文本是否存在违规内容（色情、暴力、政治敏感、广告欺诈）。用JSON格式返回（只返回JSON）：{"pass":true或false,"reason":"原因"}。\n\n文本：' + text
      }],
      max_tokens: 200,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': 'Bearer ' + TEXT_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const content = response.data.choices[0].message.content || '';
    const cleanedContent = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return {
          pass: !!result.pass,
          message: result.pass ? '文本安全' : ('文本不合规: ' + result.reason)
        };
      } catch (e) {
        logger.warn('文本审核返回JSON解析失败:', content);
      }
    }

    // P1修复：返回格式异常时 fail-safe 拒绝
    return { pass: false, message: '文本安全验证异常，请重试' };

  } catch (err) {
    // P1修复：调用失败时 fail-safe 拒绝（不降级放行）
    logger.error('文本安全检测失败:', err.message);
    return { pass: false, message: '文本安全验证服务暂时不可用，请稍后重试' };
  }
}

module.exports = { checkImage, checkText };
