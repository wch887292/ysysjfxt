# ========================================
# 健康饮食积分系统 - 安全模块部署（推荐方式）
# 使用方法：
#   1. 直接运行: powershell -ExecutionPolicy Bypass -File deploy-security-update.ps1
#   2. 或手动执行下面列出的命令
# ========================================

param(
    [string]$ServerIP = "111.229.190.132",
    [string]$ServerUser = "root"
)

$localDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$remoteBase = "/www/wwwroot/rry.klai.top"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  安全模块部署工具" -ForegroundColor Cyan
Write-Host "  目标服务器: ${ServerUser}@${ServerIP}" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────
# 方案选择
# ──────────────────────────────────────────
Write-Host "请选择部署方式：" -ForegroundColor White
Write-Host ""
Write-Host "  [1] 自动上传（需要安装 rsync 或使用 Git Bash）" -ForegroundColor Green
Write-Host "  [2] 手动执行命令（复制下面的命令到终端执行）" -ForegroundColor Yellow
Write-Host "  [3] 查看完整部署指南" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "请输入选择 (1/2/3)"

# ──────────────────────────────────────────
# 方案 1：自动上传
# ──────────────────────────────────────────
if ($choice -eq "1") {
    Write-Host ""
    Write-Host "[1/4] 检查部署工具..." -ForegroundColor Green

    # 检查 rsync
    $rsyncPath = Get-Command rsync -ErrorAction SilentlyContinue
    $scpPath = Get-Command scp -ErrorAction SilentlyContinue
    $pscpPath = "C:\Program Files\PuTTY\pscp.exe"

    if ($rsyncPath) {
        Write-Host "  ✓ 检测到 rsync" -ForegroundColor Green
        $deployTool = "rsync"
    } elseif ($scpPath) {
        Write-Host "  ✓ 检测到 scp (Git Bash)" -ForegroundColor Green
        $deployTool = "scp"
    } elseif (Test-Path $pscpPath) {
        Write-Host "  ✓ 检测到 PuTTY pscp" -ForegroundColor Green
        $deployTool = "pscp"
    } else {
        Write-Host "  ✗ 未检测到上传工具，切换到手动模式" -ForegroundColor Yellow
        $choice = "2"
    }

    if ($choice -ne "2" -and $deployTool) {
        Write-Host ""
        Write-Host "[2/4] 上传文件..." -ForegroundColor Green

        # 文件列表
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

        $success = 0
        $failed = 0

        foreach ($f in $files) {
            $localPath = Join-Path $localDir ".." $f
            $remotePath = "${remoteBase}/${f}"

            if (-not (Test-Path $localPath)) {
                Write-Host "  ✗ 本地文件不存在: $f" -ForegroundColor Red
                $failed++
                continue
            }

            Write-Host "  上传: $f" -NoNewline

            if ($deployTool -eq "rsync") {
                $cmd = "rsync -av `"$localPath`" ${ServerUser}@${ServerIP}:${remotePath}"
            } elseif ($deployTool -eq "scp") {
                $cmd = "scp `"$localPath`" ${ServerUser}@${ServerIP}:${remotePath}"
            } else {
                $cmd = "& `"$pscpPath`" -pw `"`" `"$localPath`" ${ServerUser}@${ServerIP}:${remotePath}"
            }

            try {
                $result = Invoke-Expression $cmd 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host " ✓" -ForegroundColor Green
                    $success++
                } else {
                    Write-Host " ✗ (exit code: $LASTEXITCODE)" -ForegroundColor Red
                    $failed++
                }
            } catch {
                Write-Host " ✗ ($($_.Exception.Message))" -ForegroundColor Red
                $failed++
            }
        }

        Write-Host ""
        Write-Host "  上传完成：成功 ${success} / 失败 ${failed}" -ForegroundColor White
    }
}

# ──────────────────────────────────────────
# 方案 2：手动命令
# ──────────────────────────────────────────
if ($choice -eq "2" -or $choice -eq "1") {
    Write-Host ""
    Write-Host "[手动部署命令]" -ForegroundColor White
    Write-Host ""

    $files = @(
        @("server/middleware/securityHeaders.js", "安全响应头中间件"),
        @("server/middleware/fail2ban.js", "IP封禁中间件"),
        @("server/middleware/requestAudit.js", "请求审计中间件"),
        @("server/middleware/paramSanitize.js", "参数净化中间件"),
        @("server/middleware/bruteForce.js", "账号锁定中间件"),
        @("server/middleware/accessControl.js", "访问控制中间件"),
        @("server/middleware/timingSafeCompare.js", "时序安全中间件"),
        @("server/middleware/errorHandler.js", "错误处理中间件（已修改）"),
        @("server/middleware/auth.js", "JWT中间件（已修改）"),
        @("server/routes/auth.js", "认证路由（已修改）"),
        @("server/routes/user.js", "用户路由（已修改）"),
        @("server/models/User.js", "User模型（已修改）"),
        @("server/app.js", "主应用（已修改）"),
        @("android-app/src/utils/storage.js", "Token安全存储（已修改）"),
        @("android-app/src/api/client.js", "API客户端（已修改）")
    )

    Write-Host "步骤1：SSH 登录服务器" -ForegroundColor Cyan
    Write-Host "  ssh ${ServerUser}@${ServerIP}" -ForegroundColor Gray
    Write-Host ""

    Write-Host "步骤2：创建必要目录" -ForegroundColor Cyan
    Write-Host "  mkdir -p ${remoteBase}/server/middleware" -ForegroundColor Gray
    Write-Host "  mkdir -p ${remoteBase}/server/routes" -ForegroundColor Gray
    Write-Host "  mkdir -p ${remoteBase}/server/models" -ForegroundColor Gray
    Write-Host "  mkdir -p ${remoteBase}/server/logs" -ForegroundColor Gray
    Write-Host ""

    Write-Host "步骤3：逐个上传文件（请用 scp 或 WinSCP）" -ForegroundColor Cyan
    Write-Host ""
    $i = 1
    foreach ($file in $files) {
        $localPath = Join-Path $localDir ".." $file[0]
        $remotePath = "${remoteBase}/${file[0]}"
        Write-Host "  ${i}. ${file[1]}" -ForegroundColor Gray
        Write-Host "     本地: $localPath" -ForegroundColor DarkGray
        Write-Host "     远程: $remotePath" -ForegroundColor DarkGray
        Write-Host ""
        $i++
    }

    Write-Host "步骤4：上传管理后台静态文件（如已构建）" -ForegroundColor Cyan
    $adminDist = Join-Path $localDir ".." "admin-web\dist"
    if (Test-Path $adminDist) {
        Write-Host "  scp -r `"$adminDist\*`" ${ServerUser}@${ServerIP}:/www/wwwroot/admin-dist/" -ForegroundColor Gray
    } else {
        Write-Host "  （admin-web/dist 不存在，请先构建）" -ForegroundColor Yellow
    }
    Write-Host ""

    Write-Host "步骤5：上传配置并重启服务" -ForegroundColor Cyan
    Write-Host "  cd ${remoteBase}" -ForegroundColor Gray
    Write-Host "  docker compose up -d --build" -ForegroundColor Gray
    Write-Host "  docker compose ps" -ForegroundColor Gray
    Write-Host ""
}

# ──────────────────────────────────────────
# 方案 3：部署指南
# ──────────────────────────────────────────
if ($choice -eq "3") {
    $guidePath = Join-Path $localDir ".." "DEPLOY-GUIDE.md"
    if (Test-Path $guidePath) {
        Write-Host ""
        Write-Host "完整部署指南: $guidePath" -ForegroundColor Green
        Write-Host ""
        Write-Host "快速步骤：" -ForegroundColor Cyan
        Write-Host "  1. 构建 admin-web: cd admin-web && npm install && npm run build" -ForegroundColor Gray
        Write-Host "  2. 上传代码到服务器（使用 WinSCP 或 scp）" -ForegroundColor Gray
        Write-Host "  3. 编辑 .env.docker 填入真实密钥" -ForegroundColor Gray
        Write-Host "  4. 重启 Docker: docker compose up -d --build" -ForegroundColor Gray
        Write-Host "  5. 验证: curl -k https://111.229.190.132/api/health" -ForegroundColor Gray
    } else {
        Write-Host "  部署指南文件不存在，请查看 DEPLOY.md" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  安全模块文件清单" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "新中间件（7个）：" -ForegroundColor Green
Write-Host "  ✓ securityHeaders.js  - HSTS/CSP/X-Frame防护"
Write-Host "  ✓ fail2ban.js         - IP封禁（20次失败→10分钟）"
Write-Host "  ✓ requestAudit.js     - 请求审计日志"
Write-Host "  ✓ paramSanitize.js    - 注入攻击检测"
Write-Host "  ✓ bruteForce.js       - 账号锁定（10次→5分钟）"
Write-Host "  ✓ accessControl.js    - IDOR防护 + 敏感操作审计"
Write-Host "  ✓ timingSafeCompare.js - 防时序枚举攻击"
Write-Host ""
Write-Host "修改文件（8个）：" -ForegroundColor Yellow
Write-Host "  ✓ errorHandler.js - 日志完整脱敏"
Write-Host "  ✓ auth.js         - JWT移除openid"
Write-Host "  ✓ auth.js (routes) - 集成暴力破解防护"
Write-Host "  ✓ user.js         - IDOR防护"
Write-Host "  ✓ User.js         - bcrypt 10→12轮"
Write-Host "  ✓ app.js          - 集成所有新中间件"
Write-Host "  ✓ storage.js      - Token改用SecureStore"
Write-Host "  ✓ client.js       - HTTPS安全增强"
Write-Host ""
