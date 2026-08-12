# ========================================
# 健康饮食积分系统 - 完整一键部署脚本（密码登录）
# 用法：powershell -ExecutionPolicy Bypass -File deploy-full-update.ps1
# ========================================

param(
    [string]$ServerIP = "111.229.190.132",
    [string]$ServerUser = "root",
    [string]$RemoteDir = "/www/wwwroot/rry.klai.top",
    [switch]$SkipEnvEdit
)

$ErrorActionPreference = "Stop"
$localDir = $PSScriptRoot

function Log-Info  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Log-Ok    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Log-Warn  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Log-Error { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  健康饮食积分系统 - 完整部署" -ForegroundColor Cyan
Write-Host "  目标: ${ServerUser}@${ServerIP}" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────
# 步骤 1：构建管理后台（如需要）
# ──────────────────────────────────────────
$adminWebDir = Join-Path $localDir ".." "admin-web"
if (-not $SkipEnvEdit) {
    Write-Host "[1/5] 构建管理后台..." -ForegroundColor Green
    if (Test-Path (Join-Path $adminWebDir "dist\index.html")) {
        Log-Ok "dist 已存在，跳过构建"
    } else {
        Push-Location $adminWebDir
        if (-not (Test-Path "node_modules")) { npm install }
        npm run build
        Pop-Location
        if (Test-Path (Join-Path $adminWebDir "dist\index.html")) {
            Log-Ok "管理后台构建成功"
        } else {
            Log-Error "构建失败，请检查错误信息"
        }
    }
}

# ──────────────────────────────────────────
# 步骤 2：上传所有文件
# ──────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] 上传文件到服务器..." -ForegroundColor Green

# 上传排除清单
# 安全要求：任何含真实密钥的文件都必须在此拦截。
# 除 .env 本身外，还需覆盖各类"备份型"命名（*.env.txt / *.bak / *副本*），
# 否则明文凭据会随 rsync 一起同步到生产服务器的 Web 目录下。
# 保留 .env.example 与 .env.production.template（仅占位符，部署脚本需要它们）。
$excludePatterns = @(
    "node_modules", ".git", ".DS_Store",
    ".env", ".env.local", ".env.docker", ".env.production",
    "*.env.txt", "*.env.bak", "*.bak", "*副本*", "*备份*",
    "*.log", "*.pem", "*.key",
    "keys/", "server/keys/",
    "admin-web/dist", "android-app/node_modules"
)

# 构建 rsync 排除参数
$rsyncExclude = ""
foreach ($p in $excludePatterns) {
    $rsyncExclude += " --exclude='$p'"
}

# 使用 rsync 上传（需要 SSH 密码）
Write-Host "  正在上传代码（请勿关闭此窗口）..." -ForegroundColor Gray

# 方案A：尝试 rsync
$rsyncCmd = "rsync -avz${rsyncExclude} `"$localDir\`" ${ServerUser}@${ServerIP}:${RemoteDir}/"
try {
    Invoke-Expression $rsyncCmd
    Log-Ok "代码上传成功（rsync）"
} catch {
    # 方案B：使用 scp
    Log-Warn "rsync 不可用，尝试使用 scp..."
    Write-Host ""
    Write-Host "  请手动执行以下命令完成上传：" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  # 1. 上传后端代码" -ForegroundColor Gray
    Write-Host "  scp -r ./server/ ${ServerUser}@${ServerIP}:${RemoteDir}/server/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # 2. 上传配置" -ForegroundColor Gray
    Write-Host "  scp ./nginx/nginx.conf ${ServerUser}@${ServerIP}:${RemoteDir}/nginx/nginx.conf" -ForegroundColor Gray
    Write-Host "  scp ./docker-compose.yml ${ServerUser}@${ServerIP}:${RemoteDir}/docker-compose.yml" -ForegroundColor Gray
    Write-Host "  scp ./.dockerignore ${ServerUser}@${ServerIP}:${RemoteDir}/.dockerignore" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # 3. 上传管理后台" -ForegroundColor Gray
    Write-Host "  scp -r ./admin-web/dist/* ${ServerUser}@${ServerIP}:/www/wwwroot/admin-dist/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  上传完成后，在服务器上执行部署步骤" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Log-Ok "文件上传完成"

# ──────────────────────────────────────────
# 步骤 3：生成 .env.docker
# ──────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] 服务器端环境变量配置..." -ForegroundColor Green

$envContent = @"
# ========================================
# 安全加固版 - 生产环境配置 (2026-08-03)
# ========================================

# 数据库（容器内连接宿主机 MySQL）
DB_HOST=host.docker.internal
DB_PORT=3307
DB_NAME=health_system
DB_USER=root
DB_PASSWORD=wch@123456

# JWT（64位hex）
JWT_SECRET=e7f3a9c1d5b8f2e4a6c0d8b3f1e9a7c5d2b4f8e6a0c4d7b1f3e5a9c2d6b8f4e2
JWT_EXPIRES_IN=7d

# 微信小程序
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=PLACEHOLDER_WX_SECRET

# AES 加密（32字节hex）
AES_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

# CORS
ALLOWED_ORIGINS=https://rry.klai.top,https://www.rry.klai.top

# AI 服务
AI_SERVICE_URL=https://api.siliconflow.cn/v1/chat/completions
AI_SERVICE_KEY=PLACEHOLDER_AI_KEY
AI_SERVICE_MODEL=Qwen/Qwen3-VL-32B-Instruct

CONTENT_SECURITY_URL=https://api.siliconflow.cn/v1/chat/completions
CONTENT_SECURITY_KEY=PLACEHOLDER_AI_KEY
CONTENT_SECURITY_MODEL=Qwen/Qwen3-VL-32B-Instruct

TEXT_SERVICE_URL=https://api.siliconflow.cn/v1/chat/completions
TEXT_SERVICE_KEY=PLACEHOLDER_AI_KEY
TEXT_SERVICE_MODEL=Qwen/Qwen3.5-4B

# COS（可选）
OSS_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
OSS_BUCKET=PLACEHOLDER_BUCKET
OSS_ACCESS_KEY_ID=PLACEHOLDER_KEY_ID
OSS_ACCESS_KEY_SECRET=PLACEHOLDER_KEY_SECRET
OSS_REGION=ap-guangzhou

# 日志
LOG_LEVEL=warn
LOG_FILE=logs/app.log
ENABLE_SCHEDULER=true
"@

# 上传 .env.docker 模板到服务器
$envRemotePath = "${RemoteDir}/.env.docker"
Write-Host "  正在上传 .env.docker 模板..." -ForegroundColor Gray
Invoke-Expression "scp -`" ${envContent}`" ${ServerUser}@${ServerIP}:${envRemotePath}" 2>$null

# 更可靠的方式：直接写入
$envCmd = "ssh ${ServerUser}@${ServerIP} 'cat > ${envRemotePath} << '\''ENVEOF'\''`n${envContent}`nENVEOF`nchmod 600 ${envRemotePath}'"
Invoke-Expression $envCmd 2>$null

Log-Ok ".env.docker 已生成（含占位符）"
Write-Host ""
Write-Host "  ⚠️  请将以下占位符替换为真实值：" -ForegroundColor Yellow
Write-Host "      WX_SECRET=你的微信小程序密钥" -ForegroundColor Gray
Write-Host "      AI_SERVICE_KEY=你的硅基流动API密钥" -ForegroundColor Gray
Write-Host "      CONTENT_SECURITY_KEY=同上" -ForegroundColor Gray
Write-Host "      TEXT_SERVICE_KEY=同上" -ForegroundColor Gray
Write-Host ""

# ──────────────────────────────────────────
# 步骤 4：重启 Docker 服务
# ──────────────────────────────────────────
Write-Host "[4/5] 重启 Docker 服务..." -ForegroundColor Green

$restartCmd = "ssh ${ServerUser}@${ServerIP} 'cd ${RemoteDir} && docker compose down && docker compose up -d --build'"
try {
    Invoke-Expression $restartCmd
    Log-Ok "Docker 服务已重启"
} catch {
    Log-Warn "Docker 重启失败，请手动执行："
    Write-Host "  ssh ${ServerUser}@${ServerIP}" -ForegroundColor Cyan
    Write-Host "  cd ${RemoteDir}" -ForegroundColor Cyan
    Write-Host "  docker compose down && docker compose up -d --build" -ForegroundColor Cyan
}

# 等待服务启动
Write-Host "  等待服务启动（30秒）..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# ──────────────────────────────────────────
# 步骤 5：验证部署
# ──────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] 验证部署..." -ForegroundColor Green

$healthCmd = "curl -k -s https://${ServerIP}/api/health"
try {
    $healthResult = Invoke-Expression $healthCmd
    if ($healthResult -match '"success":true') {
        Log-Ok "后端 API 健康检查通过"
    } else {
        Log-Warn "健康检查返回非预期结果：$healthResult"
    }
} catch {
    Log-Warn "健康检查失败，请手动验证：curl -k https://${ServerIP}/api/health"
}

# 检查安全头
Write-Host ""
Write-Host "  安全头验证：" -ForegroundColor Cyan
$headersCmd = "curl -k -sI https://${ServerIP}/api/health 2>/dev/null | Select-String -Pattern 'Strict-Transport|X-Frame|Content-Security|X-Content-Type'"
try {
    $headers = Invoke-Expression $headersCmd
    if ($headers) {
        $headers | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Log-Warn "部分安全头未检测到，请在服务器上检查："
        Write-Host "    ssh ${ServerUser}@${ServerIP}" -ForegroundColor Gray
        Write-Host "    curl -k -sI https://localhost/api/health" -ForegroundColor Gray
    }
} catch {}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址：" -ForegroundColor Green
Write-Host "  后端 API: https://${ServerIP}/api/health" -ForegroundColor Cyan
Write-Host "  管理后台: https://${ServerIP}/admin/" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步（请在服务器上完成）：" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. 编辑 .env.docker 填入真实密钥：" -ForegroundColor Gray
Write-Host "     ssh ${ServerUser}@${ServerIP}" -ForegroundColor Gray
Write-Host "     vi ${RemoteDir}/.env.docker" -ForegroundColor Gray
Write-Host "     # 将 WX_SECRET / AI_SERVICE_KEY 等占位符替换为真实值" -ForegroundColor Gray
Write-Host "     docker compose restart backend" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. 微信小程序配置域名：" -ForegroundColor Gray
Write-Host "     微信公众平台 → 开发 → 开发设置 → 服务器域名" -ForegroundColor Gray
Write-Host "     添加：rry.klai.top" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Android App 构建：" -ForegroundColor Gray
Write-Host "     cd android-app && eas build --platform android" -ForegroundColor Gray
Write-Host ""
