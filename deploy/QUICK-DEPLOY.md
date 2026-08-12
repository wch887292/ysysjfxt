# 安全模块部署 - 快速操作指南

> 更新时间：2026-08-03  
> 服务器：`111.229.190.132` | 域名：`rry.klai.top`

---

## 一、三种上传方式（选一种）

### 方式 A：双击批处理文件（最简单）
```powershell
# 双击运行此文件即可自动上传
h:\ysjfxt\deploy\upload-security.bat
```
> 需要已安装 Git for Windows（自带 scp）

### 方式 B：使用 WinSCP（推荐，图形界面）
1. 下载 WinSCP：https://winscp.net/eng/download.php
2. 新建会话：主机 `111.229.190.132`，用户 `root`，输入密码
3. 左侧导航到 `h:\ysjfxt`，右侧导航到 `/www/wwwroot/rry.klai.top/server/`
4. 拖动以下文件到右侧（右键→上传）：

```
server/middleware/securityHeaders.js
server/middleware/fail2ban.js
server/middleware/requestAudit.js
server/middleware/paramSanitize.js
server/middleware/bruteForce.js
server/middleware/accessControl.js
server/middleware/timingSafeCompare.js
server/middleware/errorHandler.js
server/middleware/auth.js
server/routes/auth.js
server/routes/user.js
server/models/User.js
server/app.js
android-app/src/utils/storage.js
android-app/src/api/client.js
```

### 方式 C：手动 Git Bash 命令
打开 Git Bash，逐个执行：
```bash
scp "h:/ysjfxt/server/middleware/securityHeaders.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/securityHeaders.js
scp "h:/ysjfxt/server/middleware/fail2ban.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/fail2ban.js
scp "h:/ysjfxt/server/middleware/requestAudit.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/requestAudit.js
scp "h:/ysjfxt/server/middleware/paramSanitize.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/paramSanitize.js
scp "h:/ysjfxt/server/middleware/bruteForce.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/bruteForce.js
scp "h:/ysjfxt/server/middleware/accessControl.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/accessControl.js
scp "h:/ysjfxt/server/middleware/timingSafeCompare.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/timingSafeCompare.js
scp "h:/ysjfxt/server/middleware/errorHandler.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/errorHandler.js
scp "h:/ysjfxt/server/middleware/auth.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/middleware/auth.js
scp "h:/ysjfxt/server/routes/auth.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/routes/auth.js
scp "h:/ysjfxt/server/routes/user.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/routes/user.js
scp "h:/ysjfxt/server/models/User.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/models/User.js
scp "h:/ysjfxt/server/app.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/server/app.js
scp "h:/ysjfxt/android-app/src/utils/storage.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/android-app/src/utils/storage.js
scp "h:/ysjfxt/android-app/src/api/client.js" root@111.229.190.132:/www/wwwroot/rry.klai.top/android-app/src/api/client.js
```

---

## 二、上传 .env.docker 配置文件

```bash
scp "h:/ysjfxt/.env.docker" root@111.229.190.132:/www/wwwroot/rry.klai.top/.env.docker
```

然后在服务器上编辑：
```bash
ssh root@111.229.190.132
cd /www/wwwroot/rry.klai.top
vi .env.docker
# 将以下占位符替换为真实值：
#   REPLACE_WITH_REAL_WX_SECRET     → 微信小程序密钥
#   REPLACE_WITH_REAL_AI_KEY        → 硅基流动API密钥
#   REPLACE_WITH_REAL_BUCKET        → COS桶名（如使用）
#   REPLACE_WITH_REAL_KEY_ID        → COS AccessKeyId（如使用）
#   REPLACE_WITH_REAL_KEY_SECRET    → COS AccessKeySecret（如使用）
```

---

## 三、重启 Docker 服务

```bash
# SSH 登录服务器
ssh root@111.229.190.132
cd /www/wwwroot/rry.klai.top

# 停止并重建容器
docker compose down && docker compose up -d --build

# 查看状态
docker compose ps

# 验证 API 健康
curl -k https://localhost/api/health

# 验证安全头
curl -sI https://localhost/api/health | grep -iE '(strict-transport|x-frame|content-security)'
```

---

## 四、验证清单

| 检查项 | 命令 | 预期结果 |
|-------|------|---------|
| 后端 API | `curl -k https://111.229.190.132/api/health` | `{"success":true}` |
| 安全头 HSTS | `curl -sI https://111.229.190.132/api/health \| grep Strict-Transport` | 显示 max-age=31536000 |
| X-Frame-DENY | `curl -sI https://111.229.190.132/api/health \| grep X-Frame` | DENY |
| CSP | `curl -sI https://111.229.190.132/api/health \| grep Content-Security` | 显示 directive |
| 审计日志 | `tail -5 /www/wwwroot/rry.klai.top/server/logs/audit.log` | 有日志记录 |

---

## 五、安全加固说明

本次部署的三层安全防线：

**第一道防线（网关层）**
- HSTS + CSP + X-Frame-DENY 安全响应头
- IP 封禁：15分钟内20次失败请求 → 封禁10分钟
- 请求审计日志：敏感操作完整记录
- 请求体5MB上限 + Content-Type 校验

**第二道防线（业务层）**
- 参数净化：递归检测 SQL注入/XSS/原型污染/路径遍历
- 账号锁定：10次密码错误 → 锁定5分钟
- 防时序枚举：登录接口固定100ms延迟
- IDOR防护：防止越权访问他人数据

**第三道防线（数据层）**
- bcrypt 12轮（原10轮，暴力破解成本↑4倍）
- JWT payload 移除 openid（防身份关联）
- 日志完整脱敏（不记录任何敏感字段）
- Token 改用 SecureStore 加密存储（移动端）
