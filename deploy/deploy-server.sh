#!/bin/bash
# ========================================
# 健康饮食积分系统 - 腾讯云部署脚本
# 使用方式：bash deploy-server.sh
# 前提：已配置好 .env.production
# ========================================

set -e

APP_DIR="/opt/diet-points"
APP_USER="www-data"
NODE_VERSION="18"

echo "========================================="
echo "  健康饮食积分系统 - 服务器部署"
echo "========================================="

# ---------- 1. 系统依赖 ----------
echo "[1/7] 安装系统依赖..."
sudo apt-get update
sudo apt-get install -y curl git nginx

# ---------- 2. Node.js ----------
echo "[2/7] 安装 Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# ---------- 3. PM2 ----------
echo "[3/7] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi
echo "PM2 版本: $(pm2 -v)"

# ---------- 4. 应用代码 ----------
echo "[4/7] 部署应用代码..."
sudo mkdir -p ${APP_DIR}
sudo cp -r ./server/* ${APP_DIR}/
sudo chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# 安装生产依赖
cd ${APP_DIR}
npm install --production

# 确保日志和上传目录存在
sudo -u ${APP_USER} mkdir -p logs uploads/meals public/images/gifts

# ---------- 5. 环境配置 ----------
echo "[5/7] 配置环境变量..."
if [ ! -f ${APP_DIR}/.env.production ]; then
  echo "⚠️  未找到 .env.production，请从 .env.production.template 复制并填写"
  echo "   cp ${APP_DIR}/.env.production.template ${APP_DIR}/.env.production"
  echo "   vi ${APP_DIR}/.env.production"
  exit 1
fi
sudo -u ${APP_USER} cp ${APP_DIR}/.env.production ${APP_DIR}/.env

# ---------- 6. 启动应用 ----------
echo "[6/7] 启动应用..."
cd ${APP_DIR}
pm2 delete diet-points-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# 设置 PM2 开机自启
pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER} 2>/dev/null || true

# 验证
sleep 3
pm2 status

# ---------- 7. Nginx ----------
echo "[7/7] 配置 Nginx..."
if [ -f /etc/nginx/conf.d/diet-points.conf ]; then
  echo "Nginx 配置已存在，跳过（如需更新请手动覆盖）"
else
  echo "请将 deploy/nginx.conf 复制到 /etc/nginx/conf.d/diet-points.conf"
  echo "并修改 server_name 和 SSL 证书路径"
  echo ""
  echo "  sudo cp deploy/nginx.conf /etc/nginx/conf.d/diet-points.conf"
  echo "  sudo vi /etc/nginx/conf.d/diet-points.conf"
fi

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "常用命令："
echo "  查看日志:  pm2 logs diet-points-api"
echo "  重启服务:  pm2 restart diet-points-api"
echo "  停止服务:  pm2 stop diet-points-api"
echo "  健康检查:  curl http://localhost:3000/api/health"
echo ""
echo "下一步："
echo "  1. 配置 Nginx + SSL 证书"
echo "  2. 在微信后台配置服务器域名"
echo "  3. 修改小程序 baseUrl 为生产域名"
