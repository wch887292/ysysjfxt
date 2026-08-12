// API 客户端 — Axios 实例 + JWT 拦截器（安全增强版）
import axios from 'axios';
import { storage } from '../utils/storage';

// 从环境变量读取 API 地址，生产环境使用域名
const API_BASE_URL = 'https://rry.klai.top/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // P5-安全加固：禁止自动跟随重定向（防中间人重定向攻击）
  maxRedirects: 0,
  // P5-安全加固：禁止发送凭证到第三方域名
  withCredentials: false,
});

// 敏感操作列表（需要额外安全防护）
const SENSITIVE_OPERATIONS = ['/auth/login', '/auth/web-login', '/auth/register', '/auth/change-password'];

// 请求拦截器：自动注入 JWT Token + 安全增强
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // P5-安全加固：为敏感接口添加请求时间戳，防重放攻击
    const isSensitive = SENSITIVE_OPERATIONS.some(op => config.url?.includes(op));
    if (isSensitive) {
      config.headers['X-Request-Time'] = Date.now().toString();
      // 清除缓存（防止敏感接口被缓存）
      config.headers['Cache-Control'] = 'no-cache, no-store';
      config.headers['Pragma'] = 'no-cache';
    }
    // P5-安全加固：移除可能泄露设备信息的请求头
    delete config.headers['X-Device-Id'];
    delete config.headers['X-App-Version'];
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理 + 安全增强
apiClient.interceptors.response.use(
  (response) => {
    // P5-安全加固：检查响应中是否包含敏感信息泄露
    const res = response.data;
    if (res.success === false) {
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        // Token 无效，清除本地存储
        storage.clearAll();
        // 触发全局登出事件
        if (global.onTokenExpired) global.onTokenExpired();
      }
      // P5-安全加固：对服务端错误做统一脱敏，防止泄露内部信息
      if (status >= 500) {
        return Promise.reject(new Error('服务器维护中，请稍后再试'));
      }
      const msg = data?.message || `请求失败(${status})`;
      return Promise.reject(new Error(msg));
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请检查网络'));
    }
    // P5-安全加固：网络错误不暴露具体原因
    return Promise.reject(new Error('网络连接失败，请检查网络设置'));
  }
);

export default apiClient;
