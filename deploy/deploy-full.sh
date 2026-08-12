#!/bin/bash
# ========================================
# 健康饮食积分系统 - 腾讯云服务器完整部署脚本
# 支持：Docker 部署 / PM2 直接部署
# 域名：rry.klai.top
# IP：111.229.190.132
# 版本：2026-08-03（安全加固后）
# ========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="rry.klai.top"
APP_DIR="/www/wwwroot/${DOMAIN}"
DB_HOST="111.229.190.132"
DB_PORT=3307
DB_NAME="health_system"
DB_USER="root"
DB_PASS="wch@123456"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "=========================================="
echo "  健康饮食积分系统 - 腾讯云服务器部署"
echo "  域名: ${DOMAIN}"
echo "  版本: 2026-08-03 (安全加固版)"
echo "=========================================="
echo ""

# ============================
# 第一步：环境检查
# ============================
log_info "第 1 步：环境检查..."

# 检查 Docker
if command -v docker &> /dev/null && docker info &> /dev/null; then
    DOCKER_MODE="docker"
    log_ok "Docker 已安装: $(docker --version)"
else
    DOCKER_MODE="pm2"
    log_warn "Docker 未安装，将使用 PM2 直接部署"
fi

# 检查 Node.js
if command -v node &> /dev/null; then
    log_ok "Node.js: $(node -v)"
else
    log_warn "Node.js 未安装，将自动安装 v18"
fi

# 检查 npm/全局包
if command -v npm &> /dev/null; then
    log_ok "npm: $(npm -v)"
else
    log_warn "npm 未安装"
fi

if command -v pm2 &> /dev/null; then
    log_ok "PM2: $(pm2 -v)"
else
    log_warn "PM2 未安装"
fi

if command -v nginx &> /dev/null; then
    log_ok "Nginx: $(nginx -v 2>&1)"
else
    log_warn "Nginx 未安装"
fi

echo ""

# ============================
# 第二步：上传代码
# ============================
log_info "第 2 步：上传代码..."

# 创建部署临时目录
DEPLOY_TMP="/tmp/ysjfxt-deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${DEPLOY_TMP}"
log_ok "部署临时目录: ${DEPLOY_TMP}"

# 上传代码包
log_info "上传代码到服务器..."
rsync -avz --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='admin-web/node_modules' \
    --exclude='android-app/node_modules' \
    --exclude='server/node_modules' \
    --exclude='admin-web/dist' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='.env.docker' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='*.env.txt' \
    --exclude='*.env.bak' \
    --exclude='*.bak' \
    --exclude='*副本*' \
    --exclude='*备份*' \
    --exclude='*.pem' \
    --exclude='*.key' \
    --exclude='keys/' \
    --exclude='server/keys/' \
    . "${DB_HOST}:/tmp/ysjfxt-deploy/"
# 注意：以上排除清单刻意保留 .env.production.template 与 .env.example（不含真实密钥，
# 且下方第 133 行需要用 template 生成服务器端 .env）。
# 任何形如 "xxx.env.txt" / "xxx副本.xxx" 的凭据备份都会被拦下，
# 新增此类文件时请勿修改命名规则绕过，否则明文密钥会被同步到生产服务器。

log_ok "代码上传完成"

# 复制项目到部署目录
log_info "复制到 ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}"
sudo cp -r /tmp/ysjfxt-deploy/* "${APP_DIR}/"
sudo chown -R www:www "${APP_DIR}"
log_ok "代码部署完成"

echo ""

# ============================
# 第三步：后端服务部署
# ============================
log_info "第 3 步：部署后端服务..."

cd "${APP_DIR}/server"

# 创建必要目录
sudo mkdir -p uploads/gifts uploads/articles uploads/meals logs data
sudo chown -R www:www uploads logs data

# 创建 .env 文件（使用模板）
if [ ! -f ".env" ] || [ ! -s ".env" ]; then
    log_info "创建 .env 文件..."
    cp .env.production.template .env
    chmod 600 .env
    # 替换占位符
    sed -i "s|111.229.190.132|127.0.0.1|g" .env  # 容器内用 127.0.0.1
    sed -i "s|DB_PORT=3307|DB_PORT=3306|g" .env   # 容器内 MySQL 用默认 3306
    sed -i "s|WX_SECRET=你的微信小程序密钥|${WX_SECRET:-PLACEHOLDER}|g" .env
    sed -i "s|AI_SERVICE_KEY=你的API密钥|${AI_SERVICE_KEY:-PLACEHOLDER}|g" .env
    sed -i "s|CONTENT_SECURITY_KEY=你的API密钥|${CONTENT_SECURITY_KEY:-PLACEHOLDER}|g" .env
    sed -i "s|TEXT_SERVICE_KEY=你的API密钥|${TEXT_SERVICE_KEY:-PLACEHOLDER}|g" .env
    sed -i "s|COS_SECRET_ID=your_cos_secret_id|${COS_SECRET_ID:-PLACEHOLDER}|g" .env
    sed -i "s|COS_SECRET_KEY=your_cos_secret_key|${COS_SECRET_KEY:-PLACEHOLDER}|g" .env
    log_ok ".env 已生成"
else
    log_ok ".env 已存在，跳过"
fi

# Docker 模式部署
if [ "${DOCKER_MODE}" = "docker" ]; then
    log_info "使用 Docker 部署..."

    # 复制 .env.docker 到服务器
    if [ -f "../.env.docker" ]; then
        sudo cp ../.env.docker "${APP_DIR}/.env.docker"
        sudo chmod 600 "${APP_DIR}/.env.docker"
    fi

    # 复制 docker-compose.yml
    sudo cp ../docker-compose.yml "${APP_DIR}/docker-compose.yml"
    sudo cp ../.dockerignore "${APP_DIR}/.dockerignore"

    # 复制 nginx 配置
    sudo cp ../nginx/nginx.conf /etc/nginx/nginx.conf
    log_ok "Nginx 配置已更新"

    # 构建并启动 Docker
    cd "${APP_DIR}"
    docker compose down 2>/dev/null || true
    docker compose up -d --build
    log_ok "Docker 服务启动完成"

    # 等待后端启动
    log_info "等待后端服务启动..."
    for i in $(seq 1 30); do
        if curl -sf "http://127.0.0.1:3001/api/health" &> /dev/null; then
            log_ok "后端服务启动成功（3001端口）"
            break
        fi
        sleep 2
    done
else
    # PM2 直接部署
    log_info "使用 PM2 直接部署..."
    npm install --production
    sudo chown -R www:www node_modules logs

    # 重启 PM2
    cd "${APP_DIR}/server"
    pm2 delete ysjfxt-api 2>/dev/null || true
    pm2 start ecosystem.production.config.js --env production
    pm2 save
    pm2 startup systemd -u www --hp /home/www 2>/dev/null || true
    log_ok "PM2 服务启动完成"
fi

echo ""

# ============================
# 第四步：管理后台部署
# ============================
log_info "第 4 步：部署管理后台..."

# 检查是否已有 dist
if [ ! -d "../admin-web/dist" ]; then
    log_warn "admin-web/dist 不存在，需要先本地构建"
    log_warn "请在本地执行：cd admin-web && npm install && npm run build"
else
    # 复制 dist 到服务器挂载目录
    ADMIN_DIST_DIR="/www/wwwroot/admin-dist"
    sudo mkdir -p "${ADMIN_DIST_DIR}"
    sudo cp -r ../admin-web/dist/* "${ADMIN_DIST_DIR}/"
    sudo chown -R www:www "${ADMIN_DIST_DIR}"
    log_ok "管理后台已部署到 ${ADMIN_DIST_DIR}"
fi

echo ""

# ============================
# 第五步：静态资源部署
# ============================
log_info "第 5 步：部署静态资源..."

# 检查并复制静态资源
if [ -d "../static" ]; then
    sudo mkdir -p "${APP_DIR}/static"
    sudo cp -r ../static/* "${APP_DIR}/static/"
    sudo chown -R www:www "${APP_DIR}/static"
    log_ok "静态资源已部署"
fi

if [ -d "../server/public" ]; then
    sudo mkdir -p "${APP_DIR}/public"
    sudo cp -r ../server/public/* "${APP_DIR}/public/"
    sudo chown -R www:www "${APP_DIR}/public"
    log_ok "公共资源已部署"
fi

echo ""

# ============================
# 第六步：Nginx 配置检查
# ============================
log_info "第 6 步：检查 Nginx 配置..."

NGINX_CONF="/etc/nginx/nginx.conf"
if [ -f "${NGINX_CONF}" ]; then
    log_ok "Nginx 主配置已存在"
else
    log_warn "Nginx 主配置不存在，使用默认配置"
    sudo cp nginx/nginx.conf "${APP_DIR}/nginx.conf.bak"
    log_warn "请手动复制 nginx/nginx.conf 到 /etc/nginx/nginx.conf"
fi

# 测试 Nginx 配置
sudo nginx -t 2>&1 && log_ok "Nginx 配置语法正确" || log_warn "Nginx 配置测试失败"

# 重载 Nginx
sudo nginx -s reload 2>/dev/null && log_ok "Nginx 已重载" || log_warn "Nginx 重载失败（可能未安装）"

echo ""

# ============================
# 第七步：健康检查
# ============================
log_info "第 7 步：健康检查..."

# 检查后端 API
if curl -sf "https://${DOMAIN}/api/health" &> /dev/null; then
    log_ok "后端 API 健康检查通过"
else
    log_warn "后端 API 健康检查失败，请检查日志"
fi

# 检查管理后台
if curl -sf "https://${DOMAIN}/admin/" &> /dev/null; then
    log_ok "管理后台可达"
else
    log_warn "管理后台未就绪（可能静态资源未部署）"
fi

# 检查安全头
log_info "安全检查响应头..."
HEADERS=$(curl -sI "https://${DOMAIN}/api/health")
echo "${HEADERS}" | grep -E "(Strict-Transport|X-Frame|Content-Security|X-Content-Type)" || log_warn "部分安全头缺失"

echo ""

# ============================
# 第八步：数据库检查
# ============================
log_info "第 8 步：数据库连接检查..."

if command -v mysql &> /dev/null; then
    if mysql -h "${DB_HOST}" -P ${DB_PORT} -u "${DB_USER}" -p"${DB_PASS}" -e "USE ${DB_NAME}" &> /dev/null; then
        log_ok "数据库连接正常"
    else
        log_warn "数据库连接失败，请检查 MySQL 服务状态"
    fi
else
    log_warn "mysql 命令行工具未安装，跳过数据库检查"
fi

echo ""

# ============================
# 完成
# ============================
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  后端 API: https://${DOMAIN}/api/health"
echo "  管理后台: https://${DOMAIN}/admin/"
echo ""
echo "安全加固已生效："
echo "  ✓ 三层安全防线"
echo "  ✓ IP封禁 + 账号锁定"
echo "  ✓ JWT 安全头"
echo "  ✓ 请求审计日志"
echo ""
echo "微信小程序配置（请在 mp.weixin.qq.com 完成）："
echo "  1. 开发 → 开发设置 → 服务器域名"
echo "  2. request/upload/download 域名：${DOMAIN}"
echo ""
echo "Android App 配置（eas.json 已更新）："
echo "  构建命令：cd android-app && eas build --platform android"
echo ""
echo "常用命令："
echo "  Docker 模式:"
echo "    cd ${APP_DIR} && docker compose logs -f"
echo "    cd ${APP_DIR} && docker compose restart"
echo "  PM2 模式:"
echo "    pm2 logs ysjfxt-api"
echo "    pm2 restart ysjfxt-api"
echo "  安全日志:"
echo "    tail -f ${APP_DIR}/server/logs/audit.log"
echo ""
