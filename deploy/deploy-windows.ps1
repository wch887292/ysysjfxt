# ========================================
# 健康饮食积分系统 - Windows PowerShell 部署脚本
# 用于从 Windows 本地上传代码并部署到腾讯云服务器
# ========================================

param(
    [string]$ServerIP = "111.229.190.132",
    [string]$ServerUser = "root",
    [string]$RemoteDir = "/www/wwwroot/rry.klai.top",
    [string]$LocalDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  健康饮食积分系统 - Windows 部署工具" -ForegroundColor Cyan
Write-Host "  目标服务器: ${ServerIP}" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 WinSCP 或 rsync
function Test-DeploymentTool {
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        return "rsync"
    }
    if (Get-Command scp -ErrorAction SilentlyContinue) {
        return "scp"
    }
    Write-Host "警告: 未检测到 rsync 或 scp，请使用 WinSCP 手动上传" -ForegroundColor Yellow
    return "manual"
}

$tool = Test-DeploymentTool

# 上传文件列表（排除敏感文件和 node_modules）
$excludePatterns = @(
    "*.log",
    ".env",
    ".env.docker",
    "*.pem",
    "*.key",
    "node_modules/",
    "admin-web/node_modules/",
    "android-app/node_modules/",
    "server/node_modules/",
    "admin-web/dist/",
    ".git/",
    "*.log"
)

Write-Host "[1/3] 准备上传代码..." -ForegroundColor Green

# 创建临时上传目录
$uploadDir = "C:\Users\$env:USERNAME\.ysjfxt-upload-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null

# 复制文件（排除敏感文件）
Write-Host "  复制文件到临时目录（排除敏感文件）..." -ForegroundColor Gray
$files = Get-ChildItem -Path $LocalDir -Recurse -File |
    Where-Object {
        $relPath = $_.FullName.Replace($LocalDir, '').Replace('\', '/')
        $excludePatterns | ForEach-Object {
            $pattern = $_ -replace '\*', '.*'
            if ($relPath -notmatch $pattern) { return $true }
        }
    }

$uploadedCount = 0
foreach ($file in $files) {
    $relPath = $file.FullName.Replace($LocalDir, '').Replace('\', '/')
    $targetPath = Join-Path $uploadDir $relPath
    $targetDir = Split-Path $targetPath -Parent
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
    Copy-Item $file.FullName $targetPath -Force
    $uploadedCount++
}

Write-Host "  已准备 ${uploadedCount} 个文件" -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] 上传到服务器..." -ForegroundColor Green

if ($tool -eq "rsync") {
    # rsync 命令（通过 SSH）
    $rsyncCmd = "rsync -avz --delete -e ssh "
    $excludeArgs = $excludePatterns | ForEach-Object { "--exclude='$_'" }
    $rsyncCmd += ($excludeArgs -join " ")
    $rsyncCmd += " `"$LocalDir/`" ${ServerUser}@${ServerIP}:${RemoteDir}/"
    Write-Host "  执行: $rsyncCmd" -ForegroundColor Gray
    Write-Host "  请输入服务器密码..." -ForegroundColor Yellow
    Invoke-Expression $rsyncCmd
} elseif ($tool -eq "scp") {
    # SCP 命令（递归复制）
    Write-Host "  使用 SCP 上传（请手动排除敏感文件）..." -ForegroundColor Yellow
    Write-Host "  执行命令示例：" -ForegroundColor Gray
    Write-Host "    scp -r -i ~/.ssh/id_rsa ./${ServerUser}@${ServerIP}:${RemoteDir}/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  上传完成后，请手动执行以下步骤：" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "  请使用 WinSCP 或 FileZilla 手动上传：" -ForegroundColor Yellow
    Write-Host "  远程主机: ${ServerIP}" -ForegroundColor Cyan
    Write-Host "  用户名: ${ServerUser}" -ForegroundColor Cyan
    Write-Host "  远程目录: ${RemoteDir}" -ForegroundColor Cyan
    Write-Host "  本地目录: ${LocalDir}" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  重要：请确保以下文件/目录被排除：" -ForegroundColor Yellow
    Write-Host "    - .env（包含密钥）" -ForegroundColor Gray
    Write-Host "    - node_modules/（使用服务器上 npm install）" -ForegroundColor Gray
    Write-Host "    - *.pem（SSL 证书）" -ForegroundColor Gray
    Write-Host "    - *.log（日志文件）" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[3/3] 服务器部署步骤（SSH 登录后执行）..." -ForegroundColor Green
Write-Host ""
Write-Host "  ssh ${ServerUser}@${ServerIP}" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # 进入部署目录" -ForegroundColor Gray
Write-Host "  cd ${RemoteDir}" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 后端部署（Docker 模式）" -ForegroundColor Gray
Write-Host "  docker compose up -d --build" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 或使用 PM2 模式" -ForegroundColor Gray
Write-Host "  cd server && npm install --production" -ForegroundColor Gray
Write-Host "  pm2 delete ysjfxt-api 2>/dev/null || true" -ForegroundColor Gray
Write-Host "  pm2 start ecosystem.production.config.js --env production" -ForegroundColor Gray
Write-Host "  pm2 save" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 管理后台（复制 dist）" -ForegroundColor Gray
Write-Host "  mkdir -p /www/wwwroot/admin-dist" -ForegroundColor Gray
Write-Host "  cp -r admin-web/dist/* /www/wwwroot/admin-dist/" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 检查健康状态" -ForegroundColor Gray
Write-Host "  curl -k https://localhost/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  部署工具使用完毕" -ForegroundColor Cyan
Write-Host "  请根据上方提示完成后续步骤" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
