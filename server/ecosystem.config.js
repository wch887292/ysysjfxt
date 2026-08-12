// PM2 进程管理配置
// 使用方式：pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'diet-points-api',
    script: 'app.js',
    instances: 2,               // 2实例（多核利用 + 定时任务 GET_LOCK 防重复）
    exec_mode: 'cluster',       // 集群模式
    max_memory_restart: '512M', // 内存超限自动重启
    env_production: {
      NODE_ENV: 'production',
      TZ: 'Asia/Shanghai',
      ENABLE_SCHEDULER: 'true'  // 仅主实例执行定时任务（代码内 GET_LOCK 兜底）
    },
    env_development: {
      NODE_ENV: 'development',
      TZ: 'Asia/Shanghai'
    },
    // 日志配置
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    // 自动重启策略
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000,
    // 优雅关闭
    kill_timeout: 10000,
    listen_timeout: 15000
  }]
};
