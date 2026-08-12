#!/bin/bash
# ========================================
# 健康饮食积分系统 - 生产环境密钥生成工具
# 使用方法：bash scripts/generate-secrets.sh
# ========================================

echo ""
echo "=========================================="
echo "  生产环境密钥生成工具"
echo "=========================================="
echo ""

# 生成随机密钥
generate_hex() {
    openssl rand -hex "$1"
}

# 生成密钥
echo "[1/4] 生成 JWT 密钥..."
JWT_SECRET=$(generate_hex 32)
echo "  JWT_SECRET=${JWT_SECRET}"
echo ""

echo "[2/4] 生成 AES 加密密钥..."
AES_SECRET_KEY=$(generate_hex 16)
echo "  AES_SECRET_KEY=${AES_SECRET_KEY}"
echo ""

echo "[3/4] 生成数据库密码..."
DB_PASSWORD=$(generate_hex 16)
echo "  DB_PASSWORD=${DB_PASSWORD}"
echo ""

echo "[4/4] 生成 COS AccessKey（需从腾讯云控制台手动获取）..."
echo "  请访问: https://console.cloud.tencent.com/cam/capi"
echo "  创建 CAM 用户并获取 SecretId 和 SecretKey"
echo ""

echo "=========================================="
echo "  密钥生成完成！"
echo "=========================================="
echo ""
echo "请将以上密钥写入 .env.docker 文件："
echo ""
echo "  cat > .env.docker << 'EOF'
# 数据库配置
MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
DB_NAME=health_system
DB_USER=db_user
DB_PASSWORD=${DB_PASSWORD}

# JWT 配置
JWT_SECRET=${JWT_SECRET}

# AES 加密
AES_SECRET_KEY=${AES_SECRET_KEY}

# 微信小程序（从 mp.weixin.qq.com 获取）
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=YOUR_WX_APP_SECRET_HERE

# CORS
ALLOWED_ORIGINS=https://rry.klai.top,https://www.rry.klai.top

# AI 服务（从 siliconflow.cn 获取）
AI_SERVICE_KEY=YOUR_SILICONFLOW_API_KEY_HERE
CONTENT_SECURITY_KEY=YOUR_SILICONFLOW_API_KEY_HERE
TEXT_SERVICE_KEY=YOUR_SILICONFLOW_API_KEY_HERE

# COS 对象存储（从 tencent cloud 获取）
OSS_ACCESS_KEY_ID=YOUR_COS_SECRET_ID_HERE
OSS_ACCESS_KEY_SECRET=YOUR_COS_SECRET_KEY_HERE
OSS_BUCKET=YOUR_BUCKET_NAME_HERE
EOF"
echo ""
echo "⚠️  重要：请将 .env.docker 添加到 .gitignore，不要提交到 Git！"
echo ""
