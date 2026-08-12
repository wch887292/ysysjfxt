# 部署执行脚本 (Windows PowerShell)
# 使用方法：powershell -ExecutionPolicy Bypass -File deploy.bat

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  健康饮食积分系统 - 部署执行" -ForegroundColor Cyan
Write-Host "  目标服务器: 111.229.190.132" -ForegroundColor Yellow
Write-Host "  域名: rry.klai.top" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ============================
# 第一步：检查前置条件
# ============================
Write-Host "[1/6] 检查前置条件..." -ForegroundColor Green

$errors = @()

# 检查 Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $errors += "Git 未安装，请先安装 Git: https://git-scm.com/download/win"
}

# 检查 SSH 配置
$sshConfig = "$env:USERPROFILE\.ssh\id_rsa"
if (-not (Test-Path $sshConfig)) {
    Write-Host "  警告: SSH 私钥不存在 ($sshConfig)" -ForegroundColor Yellow
    Write-Host "  将使用密码登录方式，请确保已配置 SSH 密码登录" -ForegroundColor Yellow
}

# 检查 npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $errors += "npm 未安装，请先安装 Node.js 18+"
}

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "前置检查失败：" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "请按提示修复后重新运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ Git 已安装" -ForegroundColor Green
Write-Host "  ✓ npm 已安装" -ForegroundColor Green
Write-Host ""

# ============================
# 第二步：构建管理后台
# ============================
Write-Host "[2/6] 构建管理后台前端..." -ForegroundColor Green

Set-Location "$PSScriptRoot\admin-web"
if (Test-Path "node_modules") {
    Write-Host "  依赖已安装，跳过 npm install" -ForegroundColor Gray
} else {
    Write-Host "  安装依赖..." -ForegroundColor Gray
    npm install
}

Write-Host "  构建中..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  构建失败！" -ForegroundColor Red
    exit 1
}

# 检查构建产物
if (-not (Test-Path "dist\index.html")) {
    Write-Host "  错误: 构建产物 dist/index.html 不存在" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 管理后台构建成功 (dist/)" -ForegroundColor Green
Write-Host ""

# ============================
# 第三步：上传代码到服务器
# ============================
Write-Host "[3/6] 上传代码到服务器 (111.229.190.132)..." -ForegroundColor Green

$remoteUser = "root"
$remoteHost = "111.229.190.132"
$remoteDir = "/www/wwwroot/rry.klai.top"

# 上传后端代码
Write-Host "  上传后端代码..." -ForegroundColor Gray
$excludePatterns = '--exclude=node_modules --exclude=.env --exclude=*.log --exclude=*.pem --exclude=*.key --exclude=admin-web/dist --exclude=android-app --exclude=.git'
$scpCmd = "scp -r $excludePatterns ./server/ ${remoteUser}@${remoteHost}:${remoteDir}/server/"
Write-Host "  执行: $scpCmd" -ForegroundColor Gray
Invoke-Expression $scpCmd

# 上传 Nginx 配置
Write-Host "  上传 Nginx 配置..." -ForegroundColor Gray
scp ./nginx/nginx.conf ${remoteUser}@${remoteHost}:${remoteDir}/nginx/nginx.conf
scp ./docker-compose.yml ${remoteUser}@${remoteHost}:${remoteDir}/docker-compose.yml
scp ./.dockerignore ${remoteUser}@${remoteHost}:${remoteDir}/.dockerignore
Write-Host "  ✓ 配置上传完成" -ForegroundColor Green

# 上传管理后台 dist
Write-Host "  上传管理后台静态文件..." -ForegroundColor Gray
scp -r ./admin-web/dist/* ${remoteUser}@${remoteHost}:/www/wwwroot/admin-dist/
Write-Host "  ✓ 管理后台上传完成" -ForegroundColor Green
Write-Host ""

# ============================
# 第四步：生成服务器端 .env 文件
# ============================
Write-Host "[4/6] 生成服务器端环境变量..." -ForegroundColor Green

$envContent = @"
# 服务配置
PORT=3001
NODE_ENV=production
TZ=Asia/Shanghai

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=health_system
DB_USER=root
DB_PASSWORD=wch@123456

# JWT 配置
JWT_SECRET=e7f3a9c1d5b8f2e4a6c0d8b3f1e9a7c5d2b4f8e6a0c4d7b1f3e5a9c2d6b8f4e2
JWT_EXPIRES_IN=7d

# 微信小程序
WX_APPID=wxfe26dc17bcb16161
WX_SECRET=PLACEHOLDER_WX_SECRET

# AES 加密
AES_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

# CORS
ALLOWED_ORIGINS=https://rry.klai.top,https://www.rry.klai.top

# AI 服务（硅基流动）
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

$envFile = "$PSScriptRoot\.env.server.generate"
$envContent | Out-File -FilePath $envFile -Encoding utf8

Write-Host "  环境变量模板已生成: .env.server.generate" -ForegroundColor Green
Write-Host "  请将 PLACEHOLDER_* 替换为真实值，然后复制到服务器" -ForegroundColor Yellow
Write-Host ""

# ============================
# 第五步：上传环境变量
# ============================
Write-Host "[5/6] 请手动配置服务器环境变量..." -ForegroundColor Green
Write-Host ""
Write-Host "  请在服务器上执行以下步骤：" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ssh ${remoteUser}@${remoteHost}" -ForegroundColor Gray
Write-Host "  cd ${remoteDir}" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 1. 创建 .env.docker 文件" -ForegroundColor Gray
Write-Host "  vi .env.docker" -ForegroundColor Gray
Write-Host "  # 填入以下内容（请将 PLACEHOLDER_* 替换为真实值）：" -ForegroundColor Gray
Write-Host ""
Write-Host $envContent -ForegroundColor Gray
Write-Host ""
Write-Host "  # 2. 设置文件权限" -ForegroundColor Gray
Write-Host "  chmod 600 .env.docker" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 3. 启动 Docker 服务" -ForegroundColor Gray
Write-Host "  docker compose up -d --build" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 4. 验证服务" -ForegroundColor Gray
Write-Host "  docker compose ps" -ForegroundColor Gray
Write-Host "  curl -k https://localhost/api/health" -ForegroundColor Gray
Write-Host ""

# ============================
# 第六步：验证部署
# ============================
Write-Host "[6/6] 部署验证（需在服务器上执行）..." -ForegroundColor Green
Write-Host ""
Write-Host "  在服务器上验证：" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # 1. 检查容器状态" -ForegroundColor Gray
Write-Host "  docker compose ps" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 2. 检查后端健康" -ForegroundColor Gray
Write-Host "  curl -k https://localhost/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 3. 检查管理后台" -ForegroundColor Gray
Write-Host "  curl -k https://localhost/admin/" -ForegroundColor Gray
Write-Host ""
Write-Host "  # 4. 检查安全头" -ForegroundColor Gray
Write-Host "  curl -sI https://localhost/api/health | grep -E 'Strict-Transport|X-Frame|Content-Security'" -ForegroundColor Gray
Write-Host ""

# ============================
# 完成
# ============================
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  本地部署脚本执行完成！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. SSH 登录服务器: ssh ${remoteUser}@${remoteHost}" -ForegroundColor Cyan
Write-Host "  2. 编辑 .env.docker 填入真实密钥" -ForegroundColor Cyan
Write-Host "  3. 启动 Docker: cd ${remoteDir} && docker compose up -d --build" -ForegroundColor Cyan
Write-Host "  4. 验证: curl -k https://localhost/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "小程序部署：" -ForegroundColor Yellow
Write-Host "  1. 打开微信开发者工具，导入 miniprogram/ 目录" -ForegroundColor Cyan
Write-Host "  2. 在微信公众平台配置服务器域名: rry.klai.top" -ForegroundColor Cyan
Write-Host "  3. 点击编译 → 上传 → 提交审核" -ForegroundColor Cyan
Write-Host ""
Write-Host "Android App 部署：" -ForegroundColor Yellow
Write-Host "  1. cd android-app && eas build --platform android" -ForegroundColor Cyan
Write-Host "  2. 构建完成后在 Google Play Console 上传 AAB" -ForegroundColor Cyan
Write-Host ""
