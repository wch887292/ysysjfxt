# 元生AI生态健康饮食积分系统 - 腾讯云部署操作说明书

## 一、环境信息

| 项目 | 说明 |
|------|------|
| 服务器 | 腾讯云轻量应用服务器 |
| 操作系统 | OpenCloudOS (CentOS 兼容) |
| 服务器 IP | 111.229.190.132 |
| 域名 | rry.klai.top |
| 部署目录 | /www/wwwroot/rry.klai.top |
| SSH 端口 | 22 |

---

## 二、服务器初始化配置

### 2.1 宝塔面板安装

```bash
# 宝塔安装命令（CentOS/OpenCloudOS）
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh ed8484bec
```

### 2.2 安全组配置

在腾讯云控制台配置安全组，开放以下端口：

| 端口 | 用途 |
|------|------|
| 22 | SSH 远程登录 |
| 80 | HTTP 访问 |
| 443 | HTTPS 访问 |
| 3307 | MySQL 数据库（Docker 映射端口） |

### 2.3 宝塔面板设置

登录宝塔面板后进行以下配置：

```bash
# 1. 安装 Nginx（用于 SSL 证书管理）
# 宝塔软件商店 → Nginx → 立即安装

# 2. 站点设置
# 网站 → 添加站点 → 域名：rry.klai.top、www.rry.klai.top
# PHP版本：纯静态
# 根目录：/www/wwwroot/rry.klai.top

# 3. SSL 证书
# 网站 → rry.klai.top → SSL → Let's Encrypt → 申请证书
```

### 2.4 SSL 证书位置

```bash
# 宝塔生成的证书路径
/www/server/panel/vhost/cert/rry.klai.top/
├── fullchain.pem    # 完整证书链
└── privkey.pem      # 私钥
```

---

## 三、Docker 环境配置

### 3.1 Docker 安装

```bash
# 检查是否已安装
docker --version

# 如果未安装，使用腾讯云镜像源安装
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 3.2 Docker Compose 安装

```bash
# 安装 Docker Compose
apt-get install -y docker-compose-plugin

# 或者下载二进制文件
wget https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -O /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker compose version
```

### 3.3 Docker 网络配置

```bash
# 创建项目网络
docker network create ysjfxt-network

# 查看网络
docker network ls | grep ysjfxt
```

---

## 四、MySQL 数据库

### 4.1 MySQL 容器信息

```bash
# 容器名称
cssql

# 端口映射
3306 → 3307（外部访问端口）

# 数据库信息
主机: 127.0.0.1
端口: 3307
用户名: root
密码: wch@123456
```

### 4.2 数据库创建

```bash
# 连接 MySQL（需要进入容器或使用客户端工具）
docker exec -it cssql mysql -uroot -pwch@123456

# 创建数据库
CREATE DATABASE IF NOT EXISTS health_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 查看数据库
SHOW DATABASES;
```

### 4.3 数据库权限配置

```bash
# 创建专用数据库用户（可选）
CREATE USER 'health_user'@'%' IDENTIFIED BY 'YourStrongPassword456!';
GRANT ALL PRIVILEGES ON health_system.* TO 'health_user'@'%';
FLUSH PRIVILEGES;
```

### 4.4 数据库连接测试

```bash
# 从服务器本地测试
mysql -h 127.0.0.1 -P 3307 -u root -pwch@123456 -e "SHOW DATABASES;"
```

---

## 五、项目部署

### 5.1 部署目录结构

```
/www/wwwroot/rry.klai.top/
├── docker-compose.yml          # Docker Compose 配置
├── .env.docker                 # 环境变量配置
├── server/                     # 后端代码
│   ├── Dockerfile
│   ├── app.js
│   ├── package.json
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── utils/
├── admin-web/                  # 前端管理后台
│   ├── dist/                   # 构建产物
│   └── vite.config.js
├── nginx/                      # Nginx 配置
│   └── nginx.conf
├── ssl/                        # SSL 证书
│   ├── fullchain.pem
│   └── privkey.pem
├── uploads/                    # 上传文件存储
└── static/                     # 静态资源存储
```

### 5.2 环境变量配置

```bash
# 创建环境变量文件
cd /www/wwwroot/rry.klai.top

# 复制模板并修改
cp .env.docker.template .env.docker

# 编辑配置
vi .env.docker
```

**必须修改的配置项：**

```bash
# ============================
# 数据库配置 (MySQL)
# ============================
MYSQL_ROOT_PASSWORD=wch@123456
DB_NAME=health_system
DB_USER=root
DB_PASSWORD=wch@123456

# ============================
# JWT 签名密钥（必须替换）
# ============================
# 生成方法: openssl rand -hex 32
JWT_SECRET=替换为随机64位十六进制字符串

# ============================
# AES-256 加密密钥（必须替换）
# ============================
# 生成方法: openssl rand -hex 32
AES_SECRET_KEY=替换为32字节十六进制密钥

# ============================
# 微信小程序配置
# ============================
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=替换为你的微信小程序Secret

# ============================
# AI 服务配置
# ============================
AI_SERVICE_URL=https://api.siliconflow.cn/v1/chat/completions
AI_SERVICE_KEY=替换为你的硅基流动API Key

# ============================
# CORS 配置
# ============================
ALLOWED_ORIGINS=https://rry.klai.top,https://www.rry.klai.top
```

### 5.3 环境变量生成命令

```bash
# 生成 JWT 密钥
openssl rand -hex 32

# 生成 AES 密钥
openssl rand -hex 32
```

### 5.4 SSL 证书部署

```bash
# 从宝塔复制 SSL 证书到项目目录
cp /www/server/panel/vhost/cert/rry.klai.top/fullchain.pem /www/wwwroot/rry.klai.top/ssl/
cp /www/server/panel/vhost/cert/rry.klai.top/privkey.pem /www/wwwroot/rry.klai.top/ssl/

# 设置权限
chmod 600 /www/wwwroot/rry.klai.top/ssl/privkey.pem
chmod 644 /www/wwwroot/rry.klai.top/ssl/fullchain.pem

# 验证证书
openssl x509 -in /www/wwwroot/rry.klai.top/ssl/fullchain.pem -text -noout | head -20
```

### 5.5 Docker Compose 配置

```yaml
# /www/wwwroot/rry.klai.top/docker-compose.yml
services:
  backend:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: ysjfxt-backend
    restart: unless-stopped
    env_file:
      - .env.docker
    environment:
      DB_HOST: cssql
      DB_PORT: 3306
      DB_NAME: health_system
      DB_USER: root
      DB_PASSWORD: wch@123456
      PORT: 3000
      NODE_ENV: production
      TZ: Asia/Shanghai
    networks:
      - ysjfxt-net
    volumes:
      - uploads:/app/uploads
      - static:/app/static
      - pm2_logs:/app/.pm2
    depends_on:
      cssql:
        condition: service_healthy

  nginx:
    image: nginx:1.25-alpine
    container_name: ysjfxt-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl/:/etc/nginx/ssl/:ro
      - uploads:/app/uploads:ro
      - static:/app/static:ro
      - admin_dist:/www/wwwroot/admin-dist:ro
    depends_on:
      backend:
        condition: service_started
    networks:
      - ysjfxt-net
    command: nginx -g 'daemon off;'

networks:
  ysjfxt-net:
    external: true
    name: ysjfxt-network

volumes:
  uploads:
  static:
  pm2_logs:
  admin_dist:
```

### 5.6 Nginx 配置

```nginx
# /www/wwwroot/rry.klai.top/nginx/nginx.conf

# HTTP -> HTTPS 重定向
server {
    listen 80;
    server_name rry.klai.top www.rry.klai.top;
    return 301 https://$host$request_uri;
}

# HTTPS 服务
server {
    listen 443 ssl http2;
    server_name rry.klai.top www.rry.klai.top;

    # SSL 证书
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API 请求代理到后端
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
    }

    # 上传文件服务
    location /uploads/ {
        alias /app/uploads/;
        add_header Access-Control-Allow-Origin *;
        expires 7d;
        add_header Cache-Control "public";
    }

    # 静态资源服务
    location /static/ {
        alias /app/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 管理后台前端
    location /admin/ {
        alias /www/wwwroot/admin-dist/;
        try_files $uri $uri/ /admin/index.html;
        index index.html;
    }

    # 根路径
    location / {
        alias /www/wwwroot/admin-dist/;
        try_files $uri $uri/ /admin/index.html;
        index index.html;
    }
}
```

### 5.7 前端部署

```bash
# 在本地电脑打包前端
cd H:\ysjfxt\admin-web

# 安装依赖
npm install

# 打包（已配置 base: '/admin/'）
npm run build

# 上传到服务器
scp -r dist root@111.229.190.132:/www/wwwroot/rry.klai.top/admin-web/

# 在服务器上复制到 Docker 卷
docker run --rm -v rryklaitop_admin_dist:/data \
  -v /www/wwwroot/rry.klai.top/admin-web:/src \
  alpine sh -c "rm -rf /data/* && cp -r /src/dist/* /data/"
```

### 5.8 后端部署

```bash
# 上传后端代码
scp -r server root@111.229.190.132:/www/wwwroot/rry.klai.top/

# 在服务器上构建并启动
cd /www/wwwroot/rry.klai.top
docker compose build backend
docker compose up -d backend

# 查看日志
docker compose logs backend --tail 20
```

### 5.9 完整部署流程

```bash
# 一键部署（服务器执行）
cd /www/wwwroot/rry.klai.top

# 1. 构建所有服务
docker compose build

# 2. 启动所有服务
docker compose up -d

# 3. 查看服务状态
docker compose ps

# 4. 查看日志
docker compose logs -f
```

---

## 六、服务管理

### 6.1 服务状态管理

```bash
# 查看所有服务状态
docker compose ps

# 启动/停止/重启服务
docker compose start backend
docker compose stop nginx
docker compose restart backend

# 单独重启某个服务
docker compose restart nginx
```

### 6.2 日志查看

```bash
# 查看所有服务日志
docker compose logs

# 查看某个服务日志
docker compose logs backend
docker compose logs nginx

# 实时跟踪日志
docker compose logs -f backend

# 查看最近 100 行日志
docker compose logs --tail 100 backend
```

### 6.3 容器管理

```bash
# 查看所有容器
docker ps -a

# 进入容器
docker exec -it ysjfxt-backend sh
docker exec -it cssql bash

# 容器内部测试
docker exec ysjfxt-backend node -e "console.log('test')"
```

---

## 七、测试验证

### 7.1 后端 API 测试

```bash
# 健康检查接口
curl https://rry.klai.top/api/health

# 期望返回
{"success":true,"checks":{"server":"ok","database":"ok"}}
```

### 7.2 登录接口测试

```bash
# 管理员登录
curl -X POST https://rry.klai.top/api/auth/web-login \
  -H "Content-Type: application/json" \
  -d '{"account":"管理员账号","password":"密码"}'

# 期望返回
{
  "success": true,
  "data": {
    "token": "...",
    "userInfo": {...}
  }
}
```

### 7.3 管理后台测试

```bash
# 访问管理后台
curl -I https://rry.klai.top/admin/

# 期望返回
HTTP/2 200
Content-Type: text/html

# 检查静态资源
curl -I https://rry.klai.top/admin/assets/index-wL89vRSH.js

# 期望返回
HTTP/2 200
Content-Type: application/javascript
```

### 7.4 HTTPS 测试

```bash
# 测试 HTTP 是否自动跳转 HTTPS
curl -I http://rry.klai.top

# 期望返回
HTTP/1.1 301 Moved Permanently
Location: https://rry.klai.top/

# 测试 SSL 证书
openssl s_client -connect rry.klai.top:443
```

---

## 八、数据备份

### 8.1 MySQL 数据库备份

```bash
# 手动备份
docker exec cssql mysqldump -uroot -pwch@123456 health_system > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复数据库
mysql -h 127.0.0.1 -P 3307 -u root -pwch@123456 health_system < backup_20260101.sql

# 定时备份（添加到 crontab）
crontab -e
# 每天凌晨3点备份
0 3 * * * docker exec cssql mysqldump -uroot -pwch@123456 health_system > /backup/health_system_$(date +\%Y\%m\%d).sql
```

### 8.2 上传文件备份

```bash
# 备份上传目录
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /www/wwwroot/rry.klai.top/uploads/

# 从 Docker 卷备份
docker run --rm -v rryklaitop_uploads:/data -v /backup:/backup \
  alpine tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### 8.3 备份目录建议

```bash
# 创建备份目录
mkdir -p /backup/database
mkdir -p /backup/uploads

# 完整备份脚本
cat > /backup/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
docker exec cssql mysqldump -uroot -pwch@123456 health_system > /backup/database/health_system_$DATE.sql

# 备份上传文件
docker run --rm -v rryklaitop_uploads:/data -v /backup/uploads:/backup \
  alpine tar czf /backup/uploads/uploads_$DATE.tar.gz -C /data .

echo "Backup completed: $DATE"
EOF

chmod +x /backup/backup.sh
```

---

## 九、常见问题排查

### 9.1 端口冲突

```bash
# 查看端口占用
netstat -tlnp | grep 80
netstat -tlnp | grep 443
netstat -tlnp | grep 3307

# 或者使用 ss
ss -tlnp | grep 80

# 停止占用端口的服务
systemctl stop nginx  # 如果宝塔 Nginx 占用
```

### 9.2 数据库连接失败

```bash
# 检查 MySQL 容器状态
docker ps | grep cssql

# 测试容器网络
docker exec ysjfxt-backend ping cssql

# 测试数据库连接
docker exec ysjfxt-backend node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({host:'cssql',port:3306,user:'root',password:'wch@123456',database:'health_system'})
  .then(c => c.query('SELECT 1'))
  .then(r => console.log('DB OK:', r))
  .catch(e => console.error('DB Error:', e.message));
"
```

### 9.3 SSL 证书问题

```bash
# 检查证书有效期
openssl x509 -in /www/wwwroot/rry.klai.top/ssl/fullchain.pem -noout -dates

# 刷新宝塔证书
# 宝塔面板 → 网站 → rry.klai.top → SSL → 续签

# 更新服务器证书
cp /www/server/panel/vhost/cert/rry.klai.top/fullchain.pem /www/wwwroot/rry.klai.top/ssl/
cp /www/server/panel/vhost/cert/rry.klai.top/privkey.pem /www/wwwroot/rry.klai.top/ssl/
docker compose restart nginx
```

### 9.4 容器无法访问

```bash
# 检查容器网络
docker network inspect ysjfxt-network

# 检查容器 IP
docker inspect ysjfxt-backend | grep IPAddress
docker inspect cssql | grep IPAddress

# 手动测试容器间通信
docker exec ysjfxt-backend sh -c "curl -s http://cssql:3306 || echo 'MySQL not reachable'"
```

### 9.5 权限问题

```bash
# 修复文件权限
chown -R www:www /www/wwwroot/rry.klai.top/
chmod -R 755 /www/wwwroot/rry.klai.top/

# SSL 私钥必须是 600 权限
chmod 600 /www/wwwroot/rry.klai.top/ssl/privkey.pem

# Docker 卷权限
docker run --rm -v rryklaitop_admin_dist:/data alpine chmod -R 755 /data
```

### 9.6 Nginx 403/404 错误

```bash
# 检查 Nginx 配置
docker exec ysjfxt-nginx nginx -t

# 检查静态文件
docker exec ysjfxt-nginx ls -la /www/wwwroot/admin-dist/
docker exec ysjfxt-nginx ls -la /app/uploads/

# 检查配置文件是否正确
docker exec ysjfxt-nginx cat /etc/nginx/nginx.conf | grep "location"
```

---

## 十、更新与发布

### 10.1 后端代码更新

```bash
# 1. 本地修改代码
# 2. 上传到服务器
scp -r server/routes/agent.js root@111.229.190.132:/www/wwwroot/rry.klai.top/server/routes/

# 3. 重建并重启后端
cd /www/wwwroot/rry.klai.top
docker compose build backend
docker compose up -d backend

# 4. 验证
docker compose logs backend --tail 20
```

### 10.2 前端代码更新

```bash
# 1. 本地打包
cd H:\ysjfxt\admin-web
npm run build

# 2. 上传 dist 目录
cd H:\ysjfxt\admin-web
scp -r dist root@111.229.190.132:/www/wwwroot/rry.klai.top/admin-web/

# 3. 更新 Docker 卷
docker run --rm -v rryklaitop_admin_dist:/data \
  -v /www/wwwroot/rry.klai.top/admin-web:/src \
  alpine sh -c "rm -rf /data/* && cp -r /src/dist/* /data/"

# 4. 重启 Nginx（清缓存）
docker compose restart nginx

# 5. 验证
curl -I https://rry.klai.top/admin/index.html
```

### 10.3 配置更新

```bash
# 1. 修改 .env.docker
vi /www/wwwroot/rry.klai.top/.env.docker

# 2. 重建容器
cd /www/wwwroot/rry.klai.top
docker compose up -d --force-recreate

# 3. 验证新配置
docker compose logs backend --tail 50
```

---

## 十一、性能优化

### 11.1 Nginx 缓存配置

```nginx
# 在 nginx.conf 的 HTTPS server 中添加

# 静态资源缓存（一年）
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
    alias /www/wwwroot/admin-dist/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Gzip 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 11.2 Node.js 内存优化

```bash
# 在 docker-compose.yml 的 backend 服务添加
environment:
  - NODE_OPTIONS=--max-old-space-size=512
```

### 11.3 数据库优化

```bash
# 登录 MySQL 执行优化
docker exec -it cssql mysql -uroot -pwch@123456

# 推荐设置
SET GLOBAL innodb_buffer_pool_size = 256M;
SET GLOBAL max_connections = 200;
```

---

## 十二、安全加固

### 12.1 修改默认密码

```bash
# 修改 MySQL root 密码
docker exec -it cssql mysql -uroot -p
ALTER USER 'root'@'%' IDENTIFIED BY '新密码';

# 更新 .env.docker 中的密码
vi /www/wwwroot/rry.klai.top/.env.docker
```

### 12.2 防火墙配置

```bash
# 使用 iptables 限制 SSH 访问
iptables -A INPUT -p tcp --dport 22 -s 你的IP -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j DROP

# 或者使用宝塔防火墙
# 宝塔面板 → 安全 → SSH 端口修改
```

### 12.3 Docker 安全

```bash
# 不要以 root 运行容器（已配置使用 node 用户）
# 检查容器运行用户
docker exec ysjfxt-backend id

# 定期更新镜像
docker compose build --no-cache
docker compose up -d
```

---

## 附录：常用命令速查

```bash
# ============== 服务管理 ==============
docker compose ps                          # 查看服务状态
docker compose logs -f                     # 实时查看日志
docker compose logs backend --tail 50      # 查看后端最近50行日志
docker compose restart backend             # 重启后端
docker compose restart nginx               # 重启 Nginx
docker compose down                        # 停止所有服务
docker compose up -d                       # 启动所有服务

# ============== 容器调试 ==============
docker exec -it ysjfxt-backend sh          # 进入后端容器
docker exec -it cssql mysql -uroot -pwch@123456  # 进入 MySQL
docker exec ysjfxt-nginx nginx -t          # 测试 Nginx 配置

# ============== 数据库 ==============
mysql -h 127.0.0.1 -P 3307 -u root -pwch@123456  # 本地连接
mysqldump -h 127.0.0.1 -P 3307 -u root -pwch@123456 health_system > backup.sql  # 导出备份

# ============== 测试验证 ==============
curl -I https://rry.klai.top               # 测试 HTTPS
curl https://rry.klai.top/api/health      # 测试 API
curl https://rry.klai.top/admin/index.html # 测试前端

# ============== 文件上传 ==============
scp file.zip root@111.229.190.132:/path/   # 上传文件
rsync -avz ./dist/ root@111.229.190.132:/path/dist/  # 同步目录

# ============== Docker 卷 ==============
docker volume ls                           # 列出卷
docker run --rm -v rryklaitop_admin_dist:/data alpine ls /data  # 查看卷内容
docker run --rm -v rryklaitop_admin_dist:/data -v /backup:/b alpine sh -c "cp -r /data/* /b/"  # 备份
```

---

## 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| v1.0 | 2026-08-01 | 初始版本，完成腾讯云 Docker 部署文档 |

---

**文档维护者：** 系统管理员  
**更新频率：** 每次部署或配置变更后及时更新