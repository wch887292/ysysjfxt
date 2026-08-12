#!/bin/bash
# ========================================
# 综合部署脚本 - 修复所有线上问题
# 在服务器上执行：bash deploy-comprehensive.sh
# ========================================
set -e

echo "========================================="
echo "  健康饮食积分系统 - 综合部署修复"
echo "  域名: rry.klai.top"
echo "========================================="

cd /www/wwwroot/rry.klai.top

# ==================== 1. 填充 admin_dist 卷 ====================
echo ""
echo "[1/5] 填充 admin_dist Docker 卷..."
ADMIN_DIST_PATH=$(docker volume inspect ysjfxt-admin-dist --format '{{.Mountpoint}}')
echo "  admin_dist 卷路径: $ADMIN_DIST_PATH"

# 检查 admin-web/dist 是否存在
if [ -d "admin-web/dist" ]; then
    echo "  ✅ 找到 admin-web/dist，正在复制到卷..."
    rm -rf "$ADMIN_DIST_PATH"/*
    cp -r admin-web/dist/* "$ADMIN_DIST_PATH/"
    echo "  ✅ 已复制 $(find "$ADMIN_DIST_PATH" -type f | wc -l) 个文件到 admin_dist 卷"
else
    echo "  ⚠️ 未找到 admin-web/dist，检查是否有其他位置..."
    # 尝试从本地目录查找
    if [ -f "/tmp/admin-dist/index.html" ]; then
        rm -rf "$ADMIN_DIST_PATH"/*
        cp -r /tmp/admin-dist/* "$ADMIN_DIST_PATH/"
        echo "  ✅ 从 /tmp/admin-dist 复制到卷"
    else
        echo "  ❌ 未找到管理后台构建文件，请先上传 admin-web/dist 到服务器"
        echo "  请执行: scp -r admin-web/dist root@111.229.190.132:/www/wwwroot/rry.klai.top/admin-web/"
        exit 1
    fi
fi

# 设置权限
chmod -R 755 "$ADMIN_DIST_PATH" 2>/dev/null || true

# ==================== 2. 填充 uploads 卷 ====================
echo ""
echo "[2/5] 填充 uploads Docker 卷..."
UPLOADS_PATH=$(docker volume inspect ysjfxt-uploads --format '{{.Mountpoint}}')
echo "  uploads 卷路径: $UPLOADS_PATH"

# 复制礼品图片到 uploads 卷
if [ -d "server/uploads/gifts" ]; then
    mkdir -p "$UPLOADS_PATH/gifts"
    cp server/uploads/gifts/*.jpg "$UPLOADS_PATH/gifts/" 2>/dev/null || true
    echo "  ✅ 已复制礼品图片到 uploads/gifts"
fi

# 复制文章封面图到 uploads 卷
if [ -d "server/uploads/articles" ]; then
    mkdir -p "$UPLOADS_PATH/articles"
    cp server/uploads/articles/*.jpg "$UPLOADS_PATH/articles/" 2>/dev/null || true
    echo "  ✅ 已复制文章封面到 uploads/articles"
fi

# 确保 meals 目录存在
mkdir -p "$UPLOADS_PATH/meals"

# 验证文件
echo "  uploads 卷文件列表:"
find "$UPLOADS_PATH" -type f -name "*.jpg" -o -name "*.png" 2>/dev/null | head -20

# ==================== 3. 修复后端图片文件 ====================
echo ""
echo "[3/5] 修复后端静态图片..."
# 重命名 default.jpg → default.png 以匹配数据库
if [ -f "server/public/images/gifts/default.jpg" ]; then
    cp server/public/images/gifts/default.jpg server/public/images/gifts/default.png
    echo "  ✅ 已复制 default.jpg → default.png"
fi

# ==================== 4. 更新后端代码 ====================
echo ""
echo "[4/5] 更新后端代码..."
# 上传更新后的 api.js 等文件
if [ -f "miniprogram/utils/api.js" ]; then
    echo "  ✅ 小程序代码已就绪"
fi

# ==================== 5. 重建后端容器 ====================
echo ""
echo "[5/5] 重建后端容器..."
docker compose up -d --build backend

echo ""
echo "等待后端启动..."
sleep 5

# ==================== 验证 ====================
echo ""
echo "========================================="
echo "  验证部署结果"
echo "========================================="

echo ""
echo "=== 管理后台 ==="
echo "curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/admin/"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" https://rry.klai.top/admin/ 2>/dev/null || echo "failed")
echo "  HTTP状态码: $RESULT"

echo ""
echo "=== 静态图片 ==="
echo "  default.png: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/static/images/gifts/default.png 2>/dev/null || echo 'failed')"
echo "  default.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/static/images/gifts/default.jpg 2>/dev/null || echo 'failed')"
echo "  salad.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/static/images/gifts/salad.jpg 2>/dev/null || echo 'failed')"
echo "  fruit-box.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/static/images/gifts/fruit-box.jpg 2>/dev/null || echo 'failed')"

echo ""
echo "=== 上传的礼品图片 ==="
echo "  oat-gift-box.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/uploads/gifts/oat-gift-box.jpg 2>/dev/null || echo 'failed')"
echo "  health-checkup.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/uploads/gifts/health-checkup.jpg 2>/dev/null || echo 'failed')"

echo ""
echo "=== 文章封面 ==="
echo "  summer-diet-cover.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/uploads/articles/summer-diet-cover.jpg 2>/dev/null || echo 'failed')"
echo "  default-cover.jpg: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/static/images/articles/default-cover.jpg 2>/dev/null || echo 'failed')"

echo ""
echo "=== 后端健康检查 ==="
echo "  health: $(curl -s -o /dev/null -w '%{http_code}' https://rry.klai.top/api/health 2>/dev/null || echo 'failed')"

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "如果管理后台仍无法访问，请检查："
echo "  1. docker compose logs nginx 查看 Nginx 错误日志"
echo "  2. 确认 admin_dist 卷有文件: ls -la $ADMIN_DIST_PATH"
echo "  3. 在微信开发者工具中清除缓存后重新编译"