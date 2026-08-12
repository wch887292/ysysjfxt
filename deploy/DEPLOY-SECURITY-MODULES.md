# ========================================
# 健康饮食积分系统 - 安全模块部署指南
# 使用方法：右键点击此文件 → 编辑，查看所有上传命令
# ========================================

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 步骤 1：安装上传工具（选择其一）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 推荐：WinSCP（免费，图形界面，支持密码登录）
#   下载：https://winscp.net/eng/download.php
#
# 备选：PuTTY（命令行工具 pscp）
#   下载：https://www.putty.org/
#
# 备选：Git for Windows（自带 scp）
#   下载：https://git-scm.com/download/win

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 步骤 2：上传安全模块文件
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 服务器地址：111.229.190.132
# 远程目录：/www/wwwroot/rry.klai.top
#
# 使用 WinSCP（推荐）：
#   1. 打开 WinSCP
#   2. 新建会话：主机名=111.229.190.132，用户名=root
#   3. 输入密码登录
#   4. 左侧导航到：h:\ysjfxt
#   5. 右侧导航到：/www/wwwroot/rry.klai.top/server/
#   6. 拖动以下文件到右侧（右键→上传）：

# 新安全中间件（7个）：
server/middleware/securityHeaders.js    # 安全响应头（HSTS/CSP/X-Frame）
server/middleware/fail2ban.js           # IP封禁（20次失败→10分钟封禁）
server/middleware/requestAudit.js       # 请求审计日志
server/middleware/paramSanitize.js      # 参数净化（防SQL注入/XSS）
server/middleware/bruteForce.js         # 账号锁定（10次失败→5分钟）
server/middleware/accessControl.js      # IDOR防护 + 敏感操作审计
server/middleware/timingSafeCompare.js  # 防时序枚举攻击

# 修改的文件（8个）：
server/middleware/errorHandler.js       # 错误处理（日志脱敏增强）
server/middleware/auth.js               # JWT中间件（移除openid）
server/routes/auth.js                   # 认证路由（集成暴力破解防护）
server/routes/user.js                   # 用户路由（IDOR防护）
server/models/User.js                   # User模型（bcrypt 10→12轮）
server/app.js                           # 主应用（集成所有新中间件）
android-app/src/utils/storage.js        # Token安全存储（SecureStore）
android-app/src/api/client.js           # API客户端（HTTPS安全增强）

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 步骤 3：上传环境变量配置
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 上传 .env.docker 到服务器：
#   WinSCP：将 h:\ysjfxt\.env.docker 拖到 /www/wwwroot/rry.klai.top/
#   或命令行：
scp h:\ysjfxt\.env.docker root@111.229.190.132:/www/wwwroot/rry.klai.top/.env.docker

# 编辑服务器上的 .env.docker，替换以下占位符：
#   REPLACE_WITH_REAL_WX_SECRET     → 你的微信小程序密钥
#   REPLACE_WITH_REAL_AI_KEY        → 你的硅基流动API密钥
#   REPLACE_WITH_REAL_BUCKET        → 你的COS桶名（如使用）
#   REPLACE_WITH_REAL_KEY_ID        → 你的COS AccessKeyId（如使用）
#   REPLACE_WITH_REAL_KEY_SECRET    → 你的COS AccessKeySecret（如使用）

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 步骤 4：重启 Docker 服务
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SSH 登录服务器：
ssh root@111.229.190.132

# 进入项目目录：
cd /www/wwwroot/rry.klai.top

# 重启 Docker 服务（重新构建镜像以包含新代码）：
docker compose down && docker compose up -d --build

# 查看容器状态：
docker compose ps

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 步骤 5：验证部署
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 检查后端健康：
curl -k https://111.229.190.132/api/health

# 检查安全头（应看到 HSTS、X-Frame-DENY 等）：
curl -sI https://111.229.190.132/api/health | grep -iE '(strict-transport|x-frame|content-security|x-content-type)'

# 检查审计日志：
tail -20 /www/wwwroot/rry.klai.top/server/logs/audit.log

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 安全加固总结
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 第一道防线（网关层）：
#   ✓ HSTS + CSP + X-Frame-DENY 安全头
#   ✓ IP封禁（20次失败请求→10分钟封禁）
#   ✓ 请求审计日志（敏感操作记录）
#   ✓ 请求体大小限制（5MB）
#   ✓ Content-Type 校验（防MIME混淆）
#
# 第二道防线（业务层）：
#   ✓ 参数净化（防SQL注入/XSS/原型污染）
#   ✓ 账号锁定（10次密码错误→5分钟锁定）
#   ✓ 防时序枚举攻击（登录接口固定延迟）
#   ✓ IDOR防护（防止越权访问）
#
# 第三道防线（数据层）：
#   ✓ 日志完整脱敏（不记录敏感字段）
#   ✓ JWT移除openid（防身份关联攻击）
#   ✓ bcrypt 12轮（暴力破解成本提升4倍）
#   ✓ Token安全存储（SecureStore加密存储）
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 故障排查
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 如果服务启动失败：
#   docker compose logs backend
#   docker compose logs nginx
#
# 如果数据库连接失败：
#   docker exec -it ysjfxt-backend bash
#   mysql -h127.0.0.1 -P3307 -uroot -pwch@123456 -e "SELECT 1"
#
# 如果安全头未生效：
#   nginx -t && nginx -s reload
#   docker compose restart nginx
