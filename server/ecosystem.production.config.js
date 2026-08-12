// ========================================
// 健康饮食积分系统 - 生产环境 PM2 配置
// 用于非 Docker 部署场景（直接 Node.js 部署）
// 注意：本文件是 JavaScript 模块，注释必须用 //，不能用 #
// ========================================

module.exports = {
  apps: [{
    name: 'ysjfxt-api',
    script: './app.js',
    cwd: '.',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
      TZ: 'Asia/Shanghai',
      PORT: '3000'
    },
    // 从 .env 文件加载环境变量
    env_file: '.env',
    // 健康检查（每30秒一次）
    health_check: {
      url: 'http://localhost:3000/api/health',
      interval: 30000,
      timeout: 5000
    },
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    // 自动重启策略
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
