module.exports = {
  apps: [{
    name: 'ysjfxt-server',
    script: 'app.js',
    cwd: '/var/www/ysjfxt/server',
    instances: 2,            // 2 实例负载均衡
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production2: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/ysjfxt/error.log',
    out_file: '/var/log/ysjfxt/app.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // 优雅关闭
    kill_timeout: 3000,
    listen_timeout: 5000,
    // 启动前等待数据库就绪
    wait_ready: true,
    listen_timeout: 10000
  }]
};
