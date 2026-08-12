@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   安全模块一键上传脚本
echo   目标服务器: root@111.229.190.132
echo ============================================================
echo.

:: 设置变量
set "SERVER=root@111.229.190.132"
set "REMOTE=/www/wwwroot/rry.klai.top"
set "LOCAL=%~dp0.."

echo [1/3] 检查上传工具...
echo.

:: 检查 Git Bash scp
where scp >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] 检测到 scp (Git Bash)
    set "TOOL=scp"
) else (
    :: 检查 PuTTY pscp
    if exist "C:\Program Files\PuTTY\pscp.exe" (
        echo   [OK] 检测到 pscp (PuTTY)
        set "TOOL=pscp"
        set "PSCP=C:\Program Files\PuTTY\pscp.exe"
    ) else (
        echo   [WARN] 未检测到 scp/pscp，将显示手动命令
        set "TOOL=manual"
    )
)

echo.
echo [2/3] 准备上传文件...
echo.

:: 定义文件列表
set "FILES[0]=server\middleware\securityHeaders.js"
set "FILES[1]=server\middleware\fail2ban.js"
set "FILES[2]=server\middleware\requestAudit.js"
set "FILES[3]=server\middleware\paramSanitize.js"
set "FILES[4]=server\middleware\bruteForce.js"
set "FILES[5]=server\middleware\accessControl.js"
set "FILES[6]=server\middleware\timingSafeCompare.js"
set "FILES[7]=server\middleware\errorHandler.js"
set "FILES[8]=server\middleware\auth.js"
set "FILES[9]=server\routes\auth.js"
set "FILES[10]=server\routes\user.js"
set "FILES[11]=server\models\User.js"
set "FILES[12]=server\app.js"
set "FILES[13]=android-app\src\utils\storage.js"
set "FILES[14]=android-app\src\api\client.js"

set "SUCCESS=0"
set "FAILED=0"

if "%TOOL%"=="scp" (
    echo [3/3] 执行上传（共 15 个文件）...
    echo.
    for /L %%i in (0,1,14) do (
        set "FILE=!FILES[%%i]!"
        set "LOCALPATH=%LOCAL%\!FILE!"
        set "REMOTEPATH=%REMOTE%/!FILE!"
        
        echo   [%%i+1/15] !FILE!
        scp "!LOCALPATH!" !SERVER!:!REMOTEPATH!
        if !errorlevel! equ 0 (
            set /a "SUCCESS+=1"
            echo         [OK]
        ) else (
            set /a "FAILED+=1"
            echo         [FAIL]
        )
    )
) else if "%TOOL%"=="pscp" (
    echo [3/3] 执行上传（需要输入服务器密码）...
    echo.
    for /L %%i in (0,1,14) do (
        set "FILE=!FILES[%%i]!"
        set "LOCALPATH=%LOCAL%\!FILE!"
        set "REMOTEPATH=%REMOTE%/!FILE!"
        
        echo   [%%i+1/15] !FILE!
        "!PSCP!" -pw "" "!LOCALPATH!" !SERVER!:!REMOTEPATH!
        if !errorlevel! equ 0 (
            set /a "SUCCESS+=1"
            echo         [OK]
        ) else (
            set /a "FAILED+=1"
            echo         [FAIL]
        )
    )
) else (
    echo [手动模式] 请复制以下命令到 Git Bash 执行：
    echo.
    for /L %%i in (0,1,14) do (
        set "FILE=!FILES[%%i]!"
        echo   scp "%LOCAL%\!FILE!" !SERVER!:"%REMOTE%/!FILE!"
    )
)

echo.
echo ============================================================
echo   上传完成: 成功 !SUCCESS! / 失败 !FAILED!
echo ============================================================
echo.

if "!FAILED!"=="0" (
    echo [下一步] 请在服务器上执行：
    echo.
    echo   ssh !SERVER!
    echo   cd %REMOTE%
    echo.
    echo   # 编辑环境变量（填入真实密钥）
    echo   vi .env.docker
    echo.
    echo   # 重启 Docker 服务
    echo   docker compose down && docker compose up -d --build
    echo.
    echo   # 验证
    echo   curl -k https://localhost/api/health
    echo.
) else (
    echo [注意] 部分文件上传失败，请检查网络连接或 SSH 配置。
    echo.
    echo   手动上传命令：
    for /L %%i in (0,1,14) do (
        set "FILE=!FILES[%%i]!"
        echo   scp "%LOCAL%\!FILE!" !SERVER!:"%REMOTE%/!FILE!"
    )
)

echo.
pause
