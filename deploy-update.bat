@echo off
chcp 65001 >nul
echo =========================================
echo   腾讯云后端热更新 (Windows 版)
echo   目标: root@111.229.190.132
echo   域名: rry.klai.top
echo =========================================
echo.

REM 检查本地文件
if not exist "server\routes\auth.js" (
    echo [错误] 未找到 server\routes\auth.js
    pause
    exit /b 1
)
echo [OK] 本地文件: server\routes\auth.js
echo.

REM 备份并上传（需要 SSH 配置密钥免密登录）
echo [1/3] 备份服务器 auth.js ...
ssh root@111.229.190.132 "cp /www/wwwroot/rry.klai.top/server/routes/auth.js /www/wwwroot/rry.klai.top/server/routes/auth.js.bak.%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2% 2>nul"
echo.

echo [2/3] 上传更新后的 auth.js ...
scp server\routes\auth.js root@111.229.190.132:/www/wwwroot/rry.klai.top/server/routes/auth.js
if %errorlevel% neq 0 (
    echo [错误] 上传失败，请检查 SSH 连接
    pause
    exit /b 1
)
echo [OK] 上传完成
echo.

echo [3/3] 重启后端容器 ...
ssh root@111.229.190.132 "cd /www/wwwroot/rry.klai.top && docker compose up -d --build backend"
if %errorlevel% neq 0 (
    echo [错误] 容器重启失败
    pause
    exit /b 1
)

echo.
echo 等待容器启动（10秒）...
timeout /t 10 /nobreak >nul

echo.
echo =========================================
echo   验证部署结果
echo =========================================
echo.
echo === 容器状态 ===
ssh root@111.229.190.132 "cd /www/wwwroot/rry.klai.top && docker compose ps backend --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"
echo.
echo === 最新日志 (最后20行) ===
ssh root@111.229.190.132 "cd /www/wwwroot/rry.klai.top && docker compose logs --tail=20 backend 2>&1 | tail -20"
echo.
echo === 健康检查 ===
curl -s -o NUL -w "  HTTP状态码: %%{http_code}\n" https://rry.klai.top/api/health
echo.
echo =========================================
echo   ✅ 后端更新完成！
echo =========================================
echo.
echo 新增 API：
echo   POST /api/auth/mobile-login  - 普通用户手机号登录
echo   POST /api/auth/register      - 普通用户手机号注册
echo.
echo 常用命令：
echo   查看日志: ssh root@111.229.190.132 "docker compose logs -f backend"
echo.
pause
