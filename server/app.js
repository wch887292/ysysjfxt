// app.js - 后端服务入口
// 三重加密启动加载：若部署了 .env.enc（系统密钥密文），先解密注入 process.env；
// 否则回退到下方 dotenv 加载明文 .env。dotenv 默认不覆盖已存在的变量，故加密值优先。
try {
  require('./utils/secretVault').loadVaultEnv();
} catch (e) {
  console.warn('[secretVault] 启动加载跳过:', e.message);
}
require('dotenv').config();
// 业务时区安全网：若 .env 未显式设置 TZ，强制设为 Asia/Shanghai
// 必须在引入任何会创建 Date 对象的模块之前设置，确保 new Date()/setHours() 行为一致
// 注意：cron 与"满N天"边界已通过 utils/date.js 的 UTC 数学运算 + node-schedule tz 选项兜底，
//       此处仅为防止依赖 process.env.TZ 的第三方库（如默认 logger 时间戳）出现偏移。
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Shanghai';
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const logger = require('./utils/logger');

// P1-15: 进程级未捕获异常处理
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// 初始化数据库
const db = require('./models');

// 启动流失预警定时任务
const { startInactiveAlertJob } = require('./scripts/inactive-alert-job');

// 路由模块
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const mealRoutes = require('./routes/meal');
const clockInRoutes = require('./routes/clockIn');
const pointsRoutes = require('./routes/points').router;
const giftRoutes = require('./routes/gift');
const { getGiftList } = require('./routes/gift');
const questionnaireRoutes = require('./routes/questionnaire');
const reportRoutes = require('./routes/report');
const courseRoutes = require('./routes/course');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const signInRoutes = require('./routes/signIn');
const serviceProviderRoutes = require('./routes/service-provider');
const v1Routes = require('./routes/v1');
const licenseRoutes = require('./routes/license');
const clientRoutes = require('./routes/client');

// 授权检查
const { licenseCheckMiddleware } = require('./middleware/licenseCheck');
const { getLicenseStatus } = require('./utils/license');

// 中间件
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { camelCaseMiddleware } = require('./middleware/camelCase');
const { securityHeadersMiddleware, extraSecurityHeaders } = require('./middleware/securityHeaders');
const { fail2banMiddleware } = require('./middleware/fail2ban');
const { requestAuditMiddleware } = require('./middleware/requestAudit');
const { paramSanitizeMiddleware } = require('./middleware/paramSanitize');
const { bodySizeLimit, contentTypeCheck, checkOrigin } = require('./middleware/accessControl');

const app = express();

// 请求监控：计时 + 错误计数（轻量级，供 /api/health 查询）
const _monitor = {
  totalRequests: 0,
  errorRequests: 0,
  totalResponseTimeMs: 0,
  lastError: null,
  lastErrorTime: null
};

app.use((req, res, next) => {
  const start = Date.now();
  _monitor.totalRequests++;
  res.on('finish', () => {
    const duration = Date.now() - start;
    _monitor.totalResponseTimeMs += duration;
    if (res.statusCode >= 400) {
      _monitor.errorRequests++;
      _monitor.lastError = `${req.method} ${req.originalUrl} → ${res.statusCode}`;
      _monitor.lastErrorTime = new Date().toISOString();
    }
  });
  next();
});

// Nginx 单层代理，信任代理头
app.set('trust proxy', 1);

// 压缩响应
app.use(compression());

// 安全中间件：强化版Helmet + 自定义安全头
app.use(securityHeadersMiddleware());
app.use(extraSecurityHeaders());

// 规格12.1：生产环境强制HTTPS重定向
// 在反向代理（Nginx/CLB）后面时，通过 X-Forwarded-Proto 判断原始协议
// Docker 健康检查的 localhost 请求跳过重定向，避免健康检查失败
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (req.ip === '127.0.0.1' || req.ip === '::1') {
      return next();
    }
    if (proto === 'http') {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      return res.redirect(301, `https://${host}${req.url}`);
    }
    next();
  });
}
// CORS 配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// 请求频率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: { success: false, message: '请求频率过高,请稍后再试' }
});
app.use('/api/', limiter);

// V3修复：登录接口独立限流，防止暴力枚举
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 3, // 每个IP最多3次登录尝试
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '登录失败次数过多，请1分钟后再试' }
});
app.use('/api/auth/login', loginLimiter);
// Web后台登录接口同样限流（防暴力枚举）
app.use('/api/auth/web-login', loginLimiter);
// P1修复：修改密码接口也需限流，防止暴力猜测原密码
app.use('/api/auth/change-password', loginLimiter);

// 问卷提交限流（防滥用刷积分）
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '提交过于频繁,请稍后再试' }
});
app.use('/api/user/questionnaire', submitLimiter);

// 文件上传限流（防大流量DoS）
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '上传过于频繁,请稍后再试' }
});
app.use('/api/meals/upload', uploadLimiter);
app.use('/api/clock-in/image', uploadLimiter);

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 第二道防线：请求参数净化（注入防护）
app.use(paramSanitizeMiddleware);
// 第二道防线：请求体大小限制（防DoS）
app.use(bodySizeLimit);
// 第二道防线：内容类型校验（防MIME混淆）
app.use(contentTypeCheck);
// 第二道防线：来源校验（防CSRF）
app.use(checkOrigin);
// 第一道防线：请求审计日志
app.use(requestAuditMiddleware);
// 第一道防线：IP封禁（防暴力攻击）
app.use(fail2banMiddleware);

// camelCase 双写中间件：对所有 JSON 响应自动追加 camelCase 版本的 snake_case 键
// 确保微信小程序端和 Web 端均可按各自习惯访问相同字段
app.use(camelCaseMiddleware);

// 授权检查中间件（试用期到期后拦截所有非白名单 API 请求）
app.use('/api/', licenseCheckMiddleware);

// 静态文件（上传的图片等）
// 修复 ERR_BLOCKED_BY_RESPONSE：helmet() 设置了 Cross-Origin-Resource-Policy: same-origin，
// 导致小程序渲染层 <image> 标签加载图片被浏览器内核拦截（渲染层视为跨域）
// 解决：对静态资源路径单独设置 CORP: cross-origin，允许跨域加载
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));
// 静态资源（礼品图片等，从 miniprogram 迁移以减小包体积）
app.use('/static', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);  // 授权管理路由（无需登录）
app.use('/api/client', clientRoutes);      // 客户端错误/事件上报（无需登录、无license限制）

// 礼品列表 - 公开访问（无需登录）
app.get('/api/gifts/list', getGiftList);

// 第三道防线：防枚举延迟（登录/注册接口固定延迟，防止时序攻击推断用户是否存在）
const { antiEnumerationDelay } = require('./middleware/timingSafeCompare');
app.use('/api/auth/', antiEnumerationDelay);

app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/meals', authMiddleware, mealRoutes);
app.use('/api/clock-in', authMiddleware, clockInRoutes);
app.use('/api/gifts', authMiddleware, giftRoutes);
app.use('/api/user/questionnaire', authMiddleware, questionnaireRoutes);
app.use('/api/user/reports', authMiddleware, reportRoutes);
app.use('/api/user/courses', authMiddleware, courseRoutes);
app.use('/api/agent', authMiddleware, agentRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/user/points', authMiddleware, pointsRoutes);
app.use('/api/user/sign-in', authMiddleware, signInRoutes);
app.use('/api/service-provider', authMiddleware, serviceProviderRoutes);

// API v1 路由（规格9.1-9.5 对外契约：/api/v1/ 版本化路径）
app.use('/api/v1', v1Routes);

// 健康检查
app.get('/api/health', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    timestamp: new Date().toISOString()
  };
  let httpStatus = 200;

  try {
    await db.sequelize.authenticate();
    checks.database = 'ok';
  } catch (err) {
    // P0 修复：不向客户端泄露内部 DB 错误信息（可能含主机名/连接信息）
    checks.database = 'error';
    logger.error('健康检查数据库连接失败:', err.message);
    httpStatus = 503;
  }

  const avgResponseMs = _monitor.totalRequests > 0
    ? Math.round(_monitor.totalResponseTimeMs / _monitor.totalRequests)
    : 0;

  return res.status(httpStatus).json({
    success: httpStatus === 200,
    checks,
    uptime: process.uptime(),
    monitor: {
      totalRequests: _monitor.totalRequests,
      errorRequests: _monitor.errorRequests,
      errorRate: _monitor.totalRequests > 0
        ? (_monitor.errorRequests / _monitor.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      avgResponseMs,
      lastError: _monitor.lastError,
      lastErrorTime: _monitor.lastErrorTime
    }
  });
});

// Liveness 探针（K8s/PM2 用，永远返回 200）
app.get('/api/health/live', (req, res) => {
  res.json({ status: 'alive', uptime: process.uptime() });
});

// 错误处理
app.use(errorHandler);

// 启动服务
const PORT = process.env.PORT || 3000;

// V11修复：仅当显式声明NODE_ENV=development且DB_SYNC_ALTER=true时才使用alter
// 连接已有数据库（如腾讯云）时不应 alter，避免表结构不一致导致外键冲突
const syncOptions = (process.env.NODE_ENV === 'development' && process.env.DB_SYNC_ALTER === 'true')
  ? { alter: true }
  : {};  // 默认不修改表结构（仅创建缺失的表）

let server;
db.sequelize.sync(syncOptions)
  .then(() => {
    logger.info('数据库同步完成');
  })
  .catch(err => {
    // 已有数据库可能存在索引/外键冲突，sync 失败不阻塞启动
    // 表结构应通过 scripts/migrate-*.js 脚本维护
    logger.warn('数据库 sync 出错（不阻塞启动，表结构请通过迁移脚本维护）:', err.message);
  })
  .finally(() => {
    server = app.listen(PORT, () => {
      logger.info(`服务启动成功,端口: ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV}`);

      // 打印授权状态
      const licenseStatus = getLicenseStatus();
      if (licenseStatus.isLicensed) {
        logger.info(`[License] 已授权: 客户=${licenseStatus.license.customer}, 有效期至=${licenseStatus.license.validUntil}`);
      } else if (licenseStatus.isExpired) {
        logger.warn(`[License] 试用期已到期！需激活正式版本密钥才能继续使用`);
      } else {
        logger.info(`[License] 试用中: 剩余 ${licenseStatus.trial.remainingDays} 天 (共 ${licenseStatus.trial.trialDays} 天)`);
      }

      // 启动定时任务
      startInactiveAlertJob();

      // 预热系统配置缓存（方案6.1 "后台可配"）
      const configCache = require('./utils/configCache');
      configCache.warmUp(db).catch(err => {
        logger.warn('系统配置缓存预热失败（不影响启动，将按需读取）:', err.message);
      });
    });
  });

// 优雅关闭
function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号,准备优雅关闭...`);
  // P0 修复：server 可能在启动期间未初始化（DB 连接失败时），需守卫
  if (!server) {
    logger.info('HTTP服务未启动,直接退出');
    process.exit(0);
    return;
  }
  server.close(() => {
    logger.info('HTTP服务已关闭');
    process.exit(0);
  });
  // 10秒后强制退出
  setTimeout(() => {
    logger.error('优雅关闭超时,强制退出');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;