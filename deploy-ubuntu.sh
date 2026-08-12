#!/bin/bash
# ========================================
# 健康饮食积分系统 - 宝塔一键部署脚本
# 域名: rry.klai.top
# 目录: /www/wwwroot/rry.klai.top
# ========================================

set -e

APP_DIR="/www/wwwroot/rry.klai.top"

echo "========================================="
echo "  健康饮食积分系统 - Docker 一键部署"
echo "  域名: rry.klai.top"
echo "========================================="
echo ""

# 检查是否为 root 或 www 用户
if [ "$(whoami)" != "root" ] && [ "$(whoami)" != "www" ]; then
    echo "⚠️  建议使用 root 或 www 用户运行此脚本"
fi

# 检查 Docker
echo "[1/8] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi
echo "✅ Docker 版本: $(docker --version | awk '{print $3}')"

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi
echo "✅ Docker Compose 已就绪"

# 检查应用目录
echo ""
echo "[2/8] 检查工作目录..."
if [ ! -d "$APP_DIR" ]; then
    echo "📁 创建工作目录: $APP_DIR"
    mkdir -p "$APP_DIR"
    chown -R www:www "$APP_DIR"
fi
cd "$APP_DIR"
echo "✅ 当前目录: $(pwd)"

# 创建目录结构
echo ""
echo "[3/8] 创建目录结构..."
mkdir -p {nginx,ssl,uploads,static,mysql-init,logs}
chmod 755 ssl uploads static mysql-init logs
echo "  ✅ 目录已创建: nginx/, ssl/, uploads/, static/, mysql-init/, logs/"

# 检查配置文件
echo ""
echo "[4/8] 检查配置文件..."

CONFIG_FILES=(
    "docker-compose.yml"
    "server/Dockerfile"
    "nginx/nginx.conf"
    ".dockerignore"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "  ⚠️  缺少文件: $file"
    else
        echo "  ✅ $file"
    fi
done

# 生成随机密钥
echo ""
echo "[5/8] 生成安全密钥..."
if [ ! -f ".env.docker" ] || ! grep -q "JWT_SECRET" .env.docker 2>/dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    AES_KEY=$(openssl rand -hex 32)
    
    # 创建 .env.docker（如果不存在）
    if [ ! -f ".env.docker.template" ]; then
        echo "❌ 缺少 .env.docker.template 模板文件"
        echo "   请手动创建 .env.docker 文件"
        exit 1
    fi
    
    cp .env.docker.template .env.docker
    chmod 600 .env.docker
    
    # 替换密钥占位符
    sed -i "s/replace_with_64_char_random_hex_string_here_xxxxxxxx/$JWT_SECRET/g" .env.docker
    sed -i "s/replace_with_32_byte_hex_key_here_xxxxxxxxxxxxxxxxxx/$AES_KEY/g" .env.docker
    
    echo "  ✅ 已生成 JWT_SECRET: ${JWT_SECRET:0:16}..."
    echo "  ✅ 已生成 AES_SECRET_KEY: ${AES_KEY:0:16}..."
else
    echo "  ✅ .env.docker 已存在，使用现有密钥"
fi

# 检查 SSL 证书
echo ""
echo "[6/8] 检查 SSL 证书..."
if [ -f "ssl/fullchain.pem" ] && [ -f "ssl/privkey.pem" ]; then
    echo "  ✅ SSL 证书已找到"
    
    # 验证证书有效期
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in ssl/fullchain.pem 2>/dev/null | cut -d= -f2)
    echo "     证书有效期至: $EXPIRY_DATE"
else
    echo "  ⚠️  未找到 SSL 证书"
    echo "     请在宝塔面板操作："
    echo "     网站 → rry.klai.top → SSL → 申请 Let's Encrypt 证书"
    echo "     然后将 fullchain.pem 和 privkey.pem 放入 ssl/ 目录"
fi

# 询问是否启动服务
echo ""
echo "[7/8] 准备启动服务..."
echo "  📋 当前配置摘要："
echo "  - 数据库: MySQL 8.0 (容器内)"
echo "  - 后端: Node.js 18 (端口 3000)"
echo "  - 前端: Nginx (端口 80/443)"
echo "  - 域名: rry.klai.top"
echo ""

# 启动 Docker 服务
echo "[8/8] 启动 Docker 服务..."
echo "  正在构建和启动容器（首次可能需要 2-5 分钟）..."

docker compose down 2>/dev/null || true

docker compose up -d --build 2>&1

# 等待服务启动
echo "  等待服务启动..."
sleep 5

# 显示状态
echo ""
echo "========================================="
echo "  部署状态检查"
echo "========================================="

docker compose ps

# 健康检查
echo ""
echo "正在测试 API 健康检查..."
if curl -sk https://rry.klai.top/api/health | grep -q '"success":true'; then
    echo "✅ API 健康检查通过"
else
    echo "⚠️  API 健康检查返回非预期结果，请查看日志："
    echo "   docker compose logs backend"
fi

# 完成提示
echo ""
echo "========================================="
echo "  🎉 部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  • 管理后台: https://rry.klai.top/admin/"
echo "  • API 健康检查: https://rry.klai.top/api/health"
echo ""
echo "常用命令："
echo "  • 查看日志:    docker compose logs -f"
echo "  • 重启服务:    docker compose restart"
echo "  • 停止服务:    docker compose down"
echo "  • 更新代码:    cd $APP_DIR && git pull && docker compose up -d --build"
echo ""
echo "数据库信息："
echo "  • 主机:        mysql (容器内)"
echo "  • 数据库名:    health_system"
echo "  • 用户名:      db_user"
echo "  • 密码:        查看 .env.docker 中的 DB_PASSWORD"
echo ""
echo "下一步："
echo "  1. 将 admin-web/dist 内容复制到挂载目录:"
echo "     mkdir -p /www/wwwroot/admin-dist"
echo "     cp -r dist/* /www/wwwroot/admin-dist/"
echo ""
echo "  2. 配置微信小程序域名:"
echo "     微信公众平台 → 开发 → 开发设置 → 服务器域名"
echo "     request/upload/download 域名填写: https://rry.klai.top"
echo ""
echo "  3. 修改小程序代码中的 baseUrl 为: https://rry.klai.top/api"
echo ""
