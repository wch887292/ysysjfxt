@echo off
chcp 65001 >nul
echo ========================================
echo 图片修复部署脚本
echo 服务器: 111.229.190.132
echo ========================================
echo.

set SERVER=111.229.190.132
set REMOTE_DIR=/www/wwwroot/rry.klai.top
set UPLOADS_DIR=/tmp/gift-uploads

echo [1/5] 创建服务器临时目录...
ssh root@%SERVER% "mkdir -p %UPLOADS_DIR%"

echo.
echo [2/5] 上传静态图片 (default.jpg)...
scp "h:\ysjfxt\server\public\images\gifts\default.jpg" root@%SERVER%:%REMOTE_DIR%/server/public/images/gifts/default.jpg

echo.
echo [3/5] 上传 uploads 目录的礼品图片...
scp "h:\ysjfxt\server\uploads\gifts\oat-gift-box.jpg" root@%SERVER%:%UPLOADS_DIR%/oat-gift-box.jpg
scp "h:\ysjfxt\server\uploads\gifts\health-checkup.jpg" root@%SERVER%:%UPLOADS_DIR%/health-checkup.jpg

echo.
echo [4/5] 上传修改后的代码...
scp "h:\ysjfxt\miniprogram\utils\api.js" root@%SERVER%:%REMOTE_DIR%/miniprogram/utils/api.js
scp "h:\ysjfxt\miniprogram\utils\privacy.js" root@%SERVER%:%REMOTE_DIR%/miniprogram/utils/privacy.js
scp "h:\ysjfxt\miniprogram\app.js" root@%SERVER%:%REMOTE_DIR%/miniprogram/app.js
scp "h:\ysjfxt\miniprogram\pages\user\exchange\exchange.js" root@%SERVER%:%REMOTE_DIR%/miniprogram/pages/user/exchange/exchange.js
scp "h:\ysjfxt\miniprogram\pages\user\exchange\history.js" root@%SERVER%:%REMOTE_DIR%/miniprogram/pages/user/exchange/history.js
scp "h:\ysjfxt\server\routes\gift.js" root@%SERVER%:%REMOTE_DIR%/server/routes/gift.js

echo.
echo [5/5] 在服务器上执行部署...
ssh root@%SERVER% "cd %REMOTE_DIR% && bash -s" << REMOTE_SCRIPT
    echo "=== 查找 uploads volume 路径 ==="
    UPLOAD_PATH=$(docker volume inspect ysjfxt-uploads --format '{{.Mountpoint}}')
    echo "Uploads volume path: $UPLOAD_PATH"
    
    echo "=== 复制礼品图片到 uploads volume ==="
    mkdir -p "$UPLOAD_PATH/gifts"
    cp /tmp/gift-uploads/oat-gift-box.jpg "$UPLOAD_PATH/gifts/"
    cp /tmp/gift-uploads/health-checkup.jpg "$UPLOAD_PATH/gifts/"
    
    echo "=== 重建后端容器 ==="
    docker compose up -d --build backend
    
    sleep 3
    
    echo "=== 验证图片 ==="
    echo "default.jpg:"
    curl -s -o /dev/null -w "%{http_code}" https://rry.klai.top/static/images/gifts/default.jpg
    echo ""
    echo "oat-gift-box.jpg:"
    curl -s -o /dev/null -w "%{http_code}" https://rry.klai.top/uploads/gifts/oat-gift-box.jpg
    echo ""
    echo "health-checkup.jpg:"
    curl -s -o /dev/null -w "%{http_code}" https://rry.klai.top/uploads/gifts/health-checkup.jpg
    echo ""
    
    echo "=== 完成 ==="
REMOTE_SCRIPT

echo.
echo ========================================
echo 部署完成！请在微信开发者工具中：
echo 1. 清除全部缓存
echo 2. 重新编译
echo ========================================
pause
