# 健康饮食积分系统 - 全面部署指南

> 版本：2026-08-03（安全加固版）  
> 目标服务器：腾讯云 CVM `111.229.190.132`  
> 域名：`rry.klai.top`

---

## 一、部署架构

```
互联网 (HTTPS:443)
    │
    ▼
Nginx (Docker容器)
    ├── /api/*        → backend:3001 (Node.js)
    ├── /static/*     → backend:3001 (静态资源)
    ├── /uploads/*    → backend:3001 (用户上传)
    ├── /admin/*      → admin-dist (Vue SPA)
    └── /.well-known/* → acme-challenge (Let's Encrypt)
            │
            ▼
    backend容器 (Node.js 18 + Express)
            │
            ▼
    宿主机 MySQL (cssql容器, 端口3307→3306)
```

---

## 二、部署前准备

### 2.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04 / CentOS 8 | Ubuntu 22.04 LTS |
| 内存 | 2GB | 4GB+ |
| 磁盘 | 20GB | 50GB+ SSD |
| 安全组 | 22/80/443/3307 | 仅开放 22/80/443 |

### 2.2 所需工具

```bash
# 服务器端
Docker + Docker Compose（已安装）
MySQL 8.0（已有，容器 cssql）
Nginx（已有，Docker 容器内）

# 本地 Windows 开发机
Git（用于上传代码）
PowerShell（执行部署脚本）
npm（用于构建前端）
```

### 2.3 必需密钥（生产环境必须配置）

```bash
# 1. 登录腾讯云控制台 → CAM 访问管理 → 新建 API 密钥
COS_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxxxx
COS_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 2. 微信小程序管理后台 → 开发管理 → 开发设置
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3. 硅基流动平台 → 控制台 → API Keys
AI_SERVICE_KEY=sk-xxxxxxxxxxxxxxxx
CONTENT_SECURITY_KEY=sk-xxxxxxxxxxxxxxxx
TEXT_SERVICE_KEY=sk-xxxxxxxxxxxxxxxx
```

---

## 三、后端服务器部署

### 3.1 方式一：使用一键部署脚本（推荐）

```bash
# 本地 Windows：上传代码到服务器
# 方法 A：使用 Git（如果服务器配置了 SSH 公钥）
scp -r ./server/ root@111.229.190.132:/www/wwwroot/rry.klai.top/server/
scp -r ./nginx/ root@111.229.190.132:/www/wwwroot/rry.klai.top/nginx/
scp ./docker-compose.yml root@111.229.190.132:/www/wwwroot/rry.klai.top/
scp ./deploy-ubuntu.sh root@111.229.190.132:/www/wwwroot/rry.klai.top/

# 服务器端执行部署
ssh root@111.229.190.132
cd /www/wwwroot/rry.klai.top
bash deploy-ubuntu.sh
```

### 3.2 方式二：手动分步部署

#### 步骤1：上传代码

```bash
# 本地上传（排除 node_modules 和敏感文件）
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='*.pem' \
  ./server/ root@111.229.190.132:/www/wwwroot/rry.klai.top/server/

# 上传配置
scp ./nginx/nginx.conf root@111.229.190.132:/www/wwwroot/rry.klai.top/nginx/
scp ./docker-compose.yml root@111.229.190.132:/www/wwwroot/rry.klai.top/
```

#### 步骤2：配置环境变量

```bash
# 服务器端
cd /www/wwwroot/rry.klai.top
cp .env.docker.template .env.docker
# 编辑 .env.docker，填入真实密钥
vi .env.docker
chmod 600 .env.docker
```

#### 步骤3：启动 Docker 服务

```bash
cd /www/wwwroot/rry.klai.top
docker compose down
docker compose up -d --build
```

#### 步骤4：验证服务

```bash
# 检查容器状态
docker compose ps

# 检查后端健康
curl -k https://localhost/api/health

# 检查管理后台
curl -k https://localhost/admin/
```

#### 步骤5：部署管理后台静态文件

```bash
# 本地构建管理后台
cd admin-web
npm install
npm run build
# 构建产物在 admin-web/dist/

# 上传到服务器
scp -r dist/* root@111.229.190.132:/www/wwwroot/admin-dist/

# 确保 nginx 挂载正确
# nginx.conf 中已配置 /admin/ 映射到 /admin-dist
```

---

## 四、微信小程序部署

### 4.1 配置服务器域名

登录 [微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发设置 → 服务器域名：

```
request 合法域名：https://rry.klai.top
uploadFile 域名：https://rry.klai.top
downloadFile 域名：https://rry.klai.top
socket 合法域名：wss://rry.klai.top
web-view 域名：https://rry.klai.top
```

### 4.2 本地构建

```bash
# 使用微信开发者工具
# 1. 打开 miniprogram/ 目录
# 2. 确认 project.config.json 中的 appid: wxfe26dc17bcb16161
# 3. 点击「编译」预览效果
# 4. 点击「上传」提交代码
```

### 4.3 版本发布

```
微信公众平台 → 开发管理 → 版本管理
  → 选择已上传版本 → 提交审核 → 审核通过后全量发布
```

---

## 五、Android App 部署

### 5.1 配置 EAS Build

```bash
cd android-app
# 登录 EAS
eas login

# 配置 eas.json（已存在，无需修改）
cat eas.json
```

### 5.2 构建 APK/AAB

```bash
# 开发测试包（直接安装，无需上架）
eas build --platform android --profile development

# Google Play 发布包（AAB 格式）
eas build --platform android --profile production
```

### 5.3 安装测试包

```bash
# 构建完成后下载 APK
eas build:results
# 或直接访问 https://expo.dev 下载
```

---

## 六、部署验证清单

### 6.1 服务验证

```bash
# 1. 后端 API
curl -k https://rry.klai.top/api/health
# 期望: {"success":true,"message":"OK","timestamp":...}

# 2. 管理后台
curl -k https://rry.klai.top/admin/
# 期望: HTTP 200，返回 HTML

# 3. 静态资源
curl -k https://rry.klai.top/static/images/logo.png
# 期望: HTTP 200，返回图片

# 4. Docker 容器状态
docker compose ps
# 期望: backend、nginx 状态为 healthy
```

### 6.2 安全验证

```bash
# 5. 安全头检查
curl -sI https://rry.klai.top/api/health | grep -E "(Strict-Transport|X-Frame|Content-Security)"

# 6. 检查加密存储（手机号）
curl -k -X POST https://rry.klai.top/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","password":"Test1234","nickName":"测试"}'
# 验证数据库中 phone 字段为加密后的密文

# 7. 检查密码加密
# MySQL: SELECT id, LEFT(password, 10) FROM user WHERE phone='13800138000';
# 期望: 密码以 $2b$ 开头（bcrypt 格式）
```

### 6.3 三层防线验证

| 防线 | 验证方法 | 预期结果 |
|-----|---------|---------|
| 网关层 | 20次失败请求后检查IP | 返回429，封禁10分钟 |
| 业务层 | 10次密码错误后重试 | 账号锁定5分钟 |
| 数据层 | 检查数据库中手机号 | 为 AES 加密密文 |

---

## 七、运维管理

### 7.1 常用命令

```bash
# 服务器部署目录
APP_DIR="/www/wwwroot/rry.klai.top"

# Docker 模式
cd $APP_DIR
docker compose logs -f          # 查看实时日志
docker compose restart          # 重启服务
docker compose down && docker compose up -d  # 完整重启
docker compose ps               # 查看容器状态

# 管理后台更新（仅需更新 dist）
rsync -avz ./admin-web/dist/* $APP_DIR/../admin-dist/
nginx -s reload                 # 重载 Nginx

# 代码热更新（仅后端）
cd $APP_DIR/server
npm install --production        # 更新依赖
docker compose restart backend  # 重启后端
```

### 7.2 备份策略

```bash
# 数据库备份（每日）
docker exec cssql mysqldump -uroot -pwch@123456 health_system > /backup/health_$(date +%Y%m%d).sql
# 文件备份（uploads）
tar czf /backup/uploads_$(date +%Y%m%d).tar.gz $APP_DIR/uploads/
```

### 7.3 日志管理

```bash
# 审计日志（安全相关）
tail -f $APP_DIR/server/logs/audit.log

# 应用日志
tail -f $APP_DIR/server/logs/app.log

# Docker 日志
docker compose logs backend
```

---

## 八、安全加固检查

部署完成后，执行以下安全检查：

```bash
# 1. 检查安全头
curl -sI https://rry.klai.top/api/health

# 2. 检查 JWT 密钥强度（64位hex）
# .env 中 JWT_SECRET 应为 64 字符 hex 字符串

# 3. 检查 bcrypt 轮数（应为 12）
# 代码中 PASSWORD_SALT_ROUNDS = 12

# 4. 检查 Token 存储（移动端应使用 SecureStore）
# android-app/src/utils/storage.js 中已切换

# 5. 检查 openid 不在 JWT payload 中
# server/middleware/auth.js 中 generateToken 不包含 openid
```

---

## 九、故障排查

| 问题 | 排查方法 | 解决方案 |
|-----|---------|---------|
| API 502 | `docker compose logs backend` | 检查 .env 中 DB_PASSWORD 是否正确 |
| 数据库连接失败 | `docker exec -it backend bash` → `mysql -h127.0.0.1 -P3306 -uroot -p` | 检查 MySQL 容器是否运行 |
| SSL 证书过期 | `openssl x509 -enddate -noout -in ssl/fullchain.pem` | 宝塔面板重新申请证书 |
| 小程序域名不合法 | 微信开发者工具 → 详情 → 域名信息 | 在 mp.weixin.qq.com 配置服务器域名 |
| Token 无效 | `curl -k https://rry.klai.top/api/auth/validate -H "Authorization: Bearer xxx"` | 检查 JWT_SECRET 是否一致 |
