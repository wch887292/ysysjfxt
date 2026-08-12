# ========================================
# 健康饮食积分系统 - 一键部署（密码模式）
# 使用方法：
#   1. 确保已安装 WinSCP 或 PuTTY
#   2. 双击运行此脚本
#   3. 按提示操作
# ========================================

$serverIP = "111.229.190.132"
$serverUser = "root"
$remoteDir = "/www/wwwroot/rry.klai.top"
$localDir = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  安全模块一键部署" -ForegroundColor Cyan
Write-Host "  目标: ${serverUser}@${serverIP}" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查工具
Write-Host "[1/2] 检查工具..." -ForegroundColor Green

$hasWinSCP = Test-Path "C:\Program Files (x86)\WinSCP\WinSCP.com"
$hasPuTTY  = Test-Path "C:\Program Files\PuTTY\pscp.exe"
$hasGitBash = Get-Command scp -ErrorAction SilentlyContinue

if ($hasWinSCP) {
    Write-Host "  ✓ WinSCP 已安装" -ForegroundColor Green
    Write-Host ""
    Write-Host "  请打开 WinSCP，使用以下连接信息：" -ForegroundColor Cyan
    Write-Host "    主机名: ${serverIP}" -ForegroundColor White
    Write-Host "    用户名: ${serverUser}" -ForegroundColor White
    Write-Host "    密码:   （输入你的服务器密码）" -ForegroundColor White
    Write-Host ""
    Write-Host "  连接后，左侧导航到：$localDir" -ForegroundColor Gray
    Write-Host "  右侧导航到：${remoteDir}/server/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  然后拖动以下文件到右侧（右键→上传）：" -ForegroundColor Yellow
    Write-Host ""
    $files = @(
        "server/middleware/securityHeaders.js",
        "server/middleware/fail2ban.js",
        "server/middleware/requestAudit.js",
        "server/middleware/paramSanitize.js",
        "server/middleware/bruteForce.js",
        "server/middleware/accessControl.js",
        "server/middleware/timingSafeCompare.js",
        "server/middleware/errorHandler.js",
        "server/middleware/auth.js",
        "server/routes/auth.js",
        "server/routes/user.js",
        "server/models/User.js",
        "server/app.js",
        "android-app/src/utils/storage.js",
        "android-app/src/api/client.js"
    )
    $i = 1
    foreach ($f in $files) {
        Write-Host "    ${i}. $f" -ForegroundColor Gray
        $i++
    }
    Write-Host ""
    Write-Host "  上传完成后，在服务器上执行：" -ForegroundColor Cyan
    Write-Host "    ssh ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "    cd ${remoteDir}" -ForegroundColor Gray
    Write-Host "    vi .env.docker    # 填入真实密钥" -ForegroundColor Gray
    Write-Host "    docker compose down && docker compose up -d --build" -ForegroundColor Gray
    Write-Host "    curl -k https://localhost/api/health" -ForegroundColor Gray
} elseif ($hasPuTTY) {
    Write-Host "  ✓ PuTTY pscp 已安装" -ForegroundColor Green
    Write-Host ""
    Write-Host "  请使用 pscp 上传文件（会提示输入密码）：" -ForegroundColor Cyan
    Write-Host ""
    $files = @(
        "server/middleware/securityHeaders.js",
        "server/middleware/fail2ban.js",
        "server/middleware/requestAudit.js",
        "server/middleware/paramSanitize.js",
        "server/middleware/bruteForce.js",
        "server/middleware/accessControl.js",
        "server/middleware/timingSafeCompare.js",
        "server/middleware/errorHandler.js",
        "server/middleware/auth.js",
        "server/routes/auth.js",
        "server/routes/user.js",
        "server/models/User.js",
        "server/app.js",
        "android-app/src/utils/storage.js",
        "android-app/src/api/client.js"
    )
    foreach ($f in $files) {
        $localPath = Join-Path $localDir $f
        $remotePath = "${remoteDir}/${f}"
        Write-Host "  pscp -pw `"<你的密码>`" `"$localPath`" ${serverUser}@${serverIP}:${remotePath}" -ForegroundColor Gray
    }
} elseif ($hasGitBash) {
    Write-Host "  ✓ Git Bash scp 已安装" -ForegroundColor Green
    Write-Host ""
    Write-Host "  请在 Git Bash 中执行以下命令：" -ForegroundColor Cyan
    Write-Host ""
    $files = @(
        "server/middleware/securityHeaders.js",
        "server/middleware/fail2ban.js",
        "server/middleware/requestAudit.js",
        "server/middleware/paramSanitize.js",
        "server/middleware/bruteForce.js",
        "server/middleware/accessControl.js",
        "server/middleware/timingSafeCompare.js",
        "server/middleware/errorHandler.js",
        "server/middleware/auth.js",
        "server/routes/auth.js",
        "server/routes/user.js",
        "server/models/User.js",
        "server/app.js",
        "android-app/src/utils/storage.js",
        "android-app/src/api/client.js"
    )
    foreach ($f in $files) {
        $localPath = Join-Path $localDir $f
        $remotePath = "${remoteDir}/${f}"
        Write-Host "  scp `"$localPath`" ${serverUser}@${serverIP}:${remotePath}" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ 未检测到上传工具" -ForegroundColor Red
    Write-Host ""
    Write-Host "  请安装以下工具之一：" -ForegroundColor Yellow
    Write-Host "    1. WinSCP（推荐，免费，支持密码和密钥）" -ForegroundColor Gray
    Write-Host "       下载: https://winscp.net/eng/download.php" -ForegroundColor Gray
    Write-Host "    2. PuTTY（pscp 命令行工具）" -ForegroundColor Gray
    Write-Host "       下载: https://www.putty.org/" -ForegroundColor Gray
    Write-Host "    3. Git for Windows（自带 scp）" -ForegroundColor Gray
    Write-Host "       下载: https://git-scm.com/download/win" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  或者手动使用 WinSCP / FileZilla 上传文件：" -ForegroundColor Yellow
    Write-Host "    本地目录: $localDir" -ForegroundColor Gray
    Write-Host "    服务器: ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "    远程目录: ${remoteDir}/server/" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  部署完成提示" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  上传完成后，在服务器上执行：" -ForegroundColor Green
Write-Host ""
Write-Host "  # 1. 编辑环境变量" -ForegroundColor Gray
Write-Host "  ssh ${serverUser}@${serverIP}" -ForegroundColor Gray
Write-Host "  cd ${remoteDir}" -ForegroundColor Gray
Write-Host "  vi .env.docker" -ForegroundColor Gray
Write-Host "  # 将以下占位符替换为真实值：" -ForegroundColor Gray
Write-Host "  #   WX_SECRET=你的微信小程序密钥" -ForegroundColor Gray
Write-Host "  #   AI_SERVICE_KEY=你的硅基流动API密钥" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 2. 重启服务" -ForegroundColor Gray
Write-Host "  docker compose down && docker compose up -d --build" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 3. 验证" -ForegroundColor Gray
Write-Host "  curl -k https://localhost/api/health" -ForegroundColor Gray
Write-Host "  docker compose ps" -ForegroundColor Gray
Write-Host ""
