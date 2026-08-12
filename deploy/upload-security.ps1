# Security Module Upload Script - Health Diet Points System
# Usage: powershell -ExecutionPolicy Bypass -File upload-security.ps1
# Server: root@111.229.190.132

$serverIP = "111.229.190.132"
$serverUser = "root"
$remoteDir = "/www/wwwroot/rry.klai.top"
$localDir = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Security Module Upload Tool" -ForegroundColor Cyan
Write-Host "  Target: ${serverUser}@${serverIP}" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check upload tools
Write-Host "[1/2] Checking upload tools..." -ForegroundColor Green

$hasWinSCP = Test-Path "C:\Program Files (x86)\WinSCP\WinSCP.com"
$hasPuTTY  = Test-Path "C:\Program Files\PuTTY\pscp.exe"
$hasGitBash = Get-Command scp -ErrorAction SilentlyContinue

# File list
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

Write-Host ""

if ($hasWinSCP) {
    Write-Host "[WinSCP Mode] Please use WinSCP to upload files:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Connection info:" -ForegroundColor White
    Write-Host "    Host: ${serverIP}" -ForegroundColor Gray
    Write-Host "    User: ${serverUser}" -ForegroundColor Gray
    Write-Host "    Password: (enter your server password)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Local path:  $localDir" -ForegroundColor Gray
    Write-Host "  Remote path: ${remoteDir}/server/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Files to upload:" -ForegroundColor White
    $i = 1
    foreach ($f in $files) {
        $localPath = Join-Path $localDir $f
        Write-Host "    ${i}. $f" -ForegroundColor Gray
        $i++
    }
    Write-Host ""
    Write-Host "  After upload, run on server:" -ForegroundColor Cyan
    Write-Host "    ssh ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "    cd ${remoteDir}" -ForegroundColor Gray
    Write-Host "    vi .env.docker    # Replace PLACEHOLDER_* with real values" -ForegroundColor Gray
    Write-Host "    docker compose down && docker compose up -d --build" -ForegroundColor Gray
    Write-Host "    curl -k https://localhost/api/health" -ForegroundColor Gray
} elseif ($hasPuTTY) {
    Write-Host "[PuTTY pscp Mode] Execute these commands (will prompt for password):" -ForegroundColor Cyan
    Write-Host ""
    foreach ($f in $files) {
        $localPath = Join-Path $localDir $f
        $remotePath = "${remoteDir}/${f}"
        Write-Host "  pscp -pw `"<YOUR_PASSWORD>`" `"$localPath`" ${serverUser}@${serverIP}:${remotePath}" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  After upload:" -ForegroundColor Cyan
    Write-Host "    ssh ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "    cd ${remoteDir} && vi .env.docker && docker compose down && docker compose up -d --build" -ForegroundColor Gray
} elseif ($hasGitBash) {
    Write-Host "[Git Bash scp Mode] Execute these commands in Git Bash:" -ForegroundColor Cyan
    Write-Host ""
    foreach ($f in $files) {
        $localPath = Join-Path $localDir $f
        $remotePath = "${remoteDir}/${f}"
        Write-Host "  scp `"$localPath`" ${serverUser}@${serverIP}:${remotePath}" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  After upload:" -ForegroundColor Cyan
    Write-Host "  ssh ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "  cd ${remoteDir} && vi .env.docker && docker compose down && docker compose up -d --build" -ForegroundColor Gray
} else {
    Write-Host "[Manual Mode] Install one of these tools:" -ForegroundColor Yellow
    Write-Host "  1. WinSCP (recommended): https://winscp.net/eng/download.php" -ForegroundColor Gray
    Write-Host "  2. PuTTY: https://www.putty.org/" -ForegroundColor Gray
    Write-Host "  3. Git for Windows: https://git-scm.com/download/win" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or use WinSCP/FileZilla manually:" -ForegroundColor Yellow
    Write-Host "    Local:  $localDir" -ForegroundColor Gray
    Write-Host "    Server: ${serverUser}@${serverIP}" -ForegroundColor Gray
    Write-Host "    Remote: ${remoteDir}/server/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Files to upload:" -ForegroundColor White
    foreach ($f in $files) {
        Write-Host "    - $f" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  .env.docker Template" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$envContent = @'
# ========================================
# Security Hardened - Production Config (2026-08-03)
# ========================================

# Database (container connects to host MySQL)
DB_HOST=host.docker.internal
DB_PORT=3307
DB_NAME=health_system
DB_USER=root
DB_PASSWORD=wch@123456

# JWT (64-char hex)
JWT_SECRET=e7f3a9c1d5b8f2e4a6c0d8b3f1e9a7c5d2b4f8e6a0c4d7b1f3e5a9c2d6b8f4e2
JWT_EXPIRES_IN=7d

# WeChat Mini Program
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=REPLACE_WITH_REAL_WX_SECRET

# AES Encryption (32-byte hex)
AES_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

# CORS
ALLOWED_ORIGINS=https://rry.klai.top,https://www.rry.klai.top

# AI Services (SiliconFlow)
AI_SERVICE_URL=https://api.siliconflow.cn/v1/chat/completions
AI_SERVICE_KEY=REPLACE_WITH_REAL_AI_KEY
AI_SERVICE_MODEL=Qwen/Qwen3-VL-32B-Instruct

CONTENT_SECURITY_URL=https://api.siliconflow.cn/v1/chat/completions
CONTENT_SECURITY_KEY=REPLACE_WITH_REAL_AI_KEY
CONTENT_SECURITY_MODEL=Qwen/Qwen3-VL-32B-Instruct

TEXT_SERVICE_URL=https://api.siliconflow.cn/v1/chat/completions
TEXT_SERVICE_KEY=REPLACE_WITH_REAL_AI_KEY
TEXT_SERVICE_MODEL=Qwen/Qwen3.5-4B

# COS Object Storage (optional)
OSS_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
OSS_BUCKET=REPLACE_WITH_REAL_BUCKET
OSS_ACCESS_KEY_ID=REPLACE_WITH_REAL_KEY_ID
OSS_ACCESS_KEY_SECRET=REPLACE_WITH_REAL_KEY_SECRET
OSS_REGION=ap-guangzhou

# Logging
LOG_LEVEL=warn
LOG_FILE=logs/app.log
ENABLE_SCHEDULER=true
'@

$envPath = Join-Path $localDir ".env.docker"
$envContent | Out-File -FilePath $envPath -Encoding utf8
Write-Host "  .env.docker template saved to: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Replace these placeholders with real values:" -ForegroundColor Yellow
Write-Host "    REPLACE_WITH_REAL_WX_SECRET      -> WeChat Mini Program Secret" -ForegroundColor Gray
Write-Host "    REPLACE_WITH_REAL_AI_KEY         -> SiliconFlow API Key" -ForegroundColor Gray
Write-Host "    REPLACE_WITH_REAL_BUCKET         -> COS bucket name (if using)" -ForegroundColor Gray
Write-Host "    REPLACE_WITH_REAL_KEY_ID         -> COS AccessKeyId (if using)" -ForegroundColor Gray
Write-Host "    REPLACE_WITH_REAL_KEY_SECRET     -> COS AccessKeySecret (if using)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Upload .env.docker to server:" -ForegroundColor Cyan
Write-Host "    scp $envPath ${serverUser}@${serverIP}:${remoteDir}/.env.docker" -ForegroundColor Gray
Write-Host ""
