#!/bin/bash
set -e

echo "========================================="
echo "  健康饮食积分系统 - Docker 部署准备脚本"
echo "  域名: rry.klai.top"
echo "========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 docker compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 版本: $(docker --version)"
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose V2: $(docker compose version)"
else
    echo "✅ Docker Compose: $(docker-compose --version)"
fi

# 检查工作目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到 docker-compose.yml，请确保在项目根目录运行此脚本"
    exit 1
fi

# 创建必要的目录结构
echo ""
echo "[1/4] 创建目录结构..."
mkdir -p {nginx/conf.d,ssl,uploads,static}
echo "  ✅ 目录已创建"

# 检查 .env.docker 文件
echo ""
echo "[2/4] 检查环境变量配置..."
if [ ! -f ".env.docker" ]; then
    echo "  ⚠️  未找到 .env.docker 文件"
    echo "  正在创建默认配置模板..."
    cp .env.docker.template .env.docker 2>/dev/null || true
    
    if [ -f ".env.docker.template" ]; then
        sed -i 's/your_password_here/YourStrongPassword123!/g' .env.docker
        sed -i 's/your_appid_here/wxyourappidhere/g' .env.docker
        sed -i 's/your_secret_here/yourwxsecret/g' .env.docker
        echo "  ✅ 已创建 .env.docker（请修改其中的敏感信息）"
    else
        echo "  ❌ 未找到 .env.docker.template，请先手动创建 .env.docker"
        exit 1
    fi
else
    echo "  ✅ .env.docker 已存在"
fi

# 设置权限
echo ""
echo "[3/4] 设置文件权限..."
chmod 600 .env.docker
chmod 755 nginx/conf.d/*.conf 2>/dev/null || true
echo "  ✅ 权限已设置"

# 检查 SSL 证书
echo ""
echo "[4/4] 检查 SSL 证书..."
if [ -f "ssl/fullchain.pem" ] && [ -f "ssl/privkey.pem" ]; then
    echo "  ✅ SSL 证书已找到"
else
    echo "  ⚠️  未找到 SSL 证书"
    echo "  请在宝塔面板 → 网站 → SSL 中申请 Let's Encrypt 证书"
    echo "  然后将 fullchain.pem 和 privkey.pem 放入 ssl/ 目录"
fi

echo ""
echo "========================================="
echo "  部署准备完成！"
echo "========================================="
echo ""
echo "下一步操作："
echo ""
echo "  1. 编辑 .env.docker，填入正确的配置："
echo "     - MYSQL_ROOT_PASSWORD（MySQL root 密码）"
echo "     - DB_USER / DB_PASSWORD（数据库用户密码）"
echo "     - WX_APPID / WX_SECRET（微信小程序凭证）"
echo "     - JWT_SECRET / AES_SECRET_KEY（安全密钥）"
echo "     - AI_SERVICE_KEY（AI API 密钥）"
echo ""
echo "  2. 申请并放置 SSL 证书到 ssl/ 目录"
echo ""
echo "  3. 启动服务："
echo "     docker compose up -d --build"
echo ""
echo "  4. 查看日志："
echo "     docker compose logs -f"
echo ""
echo "  5. 访问管理后台："
echo "     https://rry.klai.top/admin/"
echo ""
echo "  6. 配置微信小程序域名"
echo "     微信公众平台 → 开发 → 开发设置 → 服务器域名"
echo ""
