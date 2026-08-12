#!/bin/bash
# ========================================
# 腾讯云后端热更新脚本
# 仅更新 auth.js（新增移动端登录/注册接口）
# 使用方式：bash deploy-update.sh
# ========================================
set -e

REMOTE_USER="root"
REMOTE_HOST="111.229.190.132"
REMOTE_PATH="/www/wwwroot/rry.klai.top"
SERVER_APP_PATH="${REMOTE_PATH}/server"
LOCAL_AUTH_FILE="server/routes/auth.js"

echo "========================================="
echo "  腾讯云后端热更新"
echo "  目标: ${REMOTE_HOST}"
echo "  域名: rry.klai.top"
echo "========================================="

# 检查本地文件
if [ ! -f "$LOCAL_AUTH_FILE" ]; then
    echo "❌ 未找到本地文件: $LOCAL_AUTH_FILE"
    exit 1
fi
echo "✅ 本地文件: $LOCAL_AUTH_FILE"

# 检查 SSH 连接
if ! command -v ssh &> /dev/null; then
    echo "❌ 未找到 ssh 命令，请确保 SSH 已安装并配置密钥登录"
    exit 1
fi

echo ""
echo "[1/4] 备份服务器上的 auth.js..."
BACKUP_NAME="auth.js.bak.$(date +%Y%m%d%H%M%S)"
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cp ${SERVER_APP_PATH}/routes/auth.js ${SERVER_APP_PATH}/routes/${BACKUP_NAME} 2>/dev/null && echo '备份: ${SERVER_APP_PATH}/routes/${BACKUP_NAME}'"

echo ""
echo "[2/4] 上传更新后的 auth.js..."
scp "${LOCAL_AUTH_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${SERVER_APP_PATH}/routes/auth.js"
echo "  ✅ 上传完成"

echo ""
echo "[3/4] 验证远程文件..."
REMOTE_MD5=$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "md5sum ${SERVER_APP_PATH}/routes/auth.js | awk '{print \$1}'")
LOCAL_MD5=$(md5sum "${LOCAL_AUTH_FILE}" | awk '{print $1}')
echo "  本地 MD5: ${LOCAL_MD5}"
echo "  远程 MD5: ${REMOTE_MD5}"
if [ "$LOCAL_MD5" != "$REMOTE_MD5" ]; then
    echo "  ⚠️  MD5 不匹配，请检查上传结果"
else
    echo "  ✅ 文件校验通过"
fi

echo ""
echo "[4/4] 重启后端容器..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_PATH} && docker compose up -d --build backend"

echo ""
echo "等待容器启动（10秒）..."
sleep 10

# 健康检查
echo ""
echo "========================================="
echo "  验证部署结果"
echo "========================================="

echo ""
echo "=== 容器状态 ==="
ssh "${REMOTE_USER}@${REMOTE_HOST}" "docker compose ps backend --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "=== 最新日志 ==="
ssh "${REMOTE_USER}@${REMOTE_HOST}" "docker compose logs --tail=20 backend 2>&1 | tail -20"

echo ""
echo "=== 健康检查 ==="
curl -s -o /dev/null -w "  HTTP状态码: %{http_code}\n" https://rry.klai.top/api/health 2>/dev/null || echo "  ⚠️ 健康检查失败"

echo ""
echo "=== 新增接口测试 ==="
curl -s -o /dev/null -w "  POST /api/auth/mobile-login: HTTP状态码 %{http_code}\n" -X POST https://rry.klai.top/api/auth/mobile-login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800000000","password":"test1234"}' 2>/dev/null || echo "  ⚠️ 接口测试失败"

curl -s -o /dev/null -w "  POST /api/auth/register:   HTTP状态码 %{http_code}\n" -X POST https://rry.klai.top/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800000001","password":"test12345"}' 2>/dev/null || echo "  ⚠️ 接口测试失败"

echo ""
echo "========================================="
echo "  ✅ 后端更新完成！"
echo "========================================="
echo ""
echo "常用命令："
echo "  查看日志:  ssh ${REMOTE_USER}@${REMOTE_HOST} 'docker compose logs -f backend'"
echo "  进入容器:  ssh ${REMOTE_USER}@${REMOTE_HOST} 'docker exec -it ${REMOTE_PATH//\//_}_backend_1 bash'"
echo "  回滚:      ssh ${REMOTE_USER}@${REMOTE_HOST} 'cp ${SERVER_APP_PATH}/routes/${BACKUP_NAME} ${SERVER_APP_PATH}/routes/auth.js && docker compose up -d --build backend'"
echo ""
echo "新增 API："
echo "  POST /api/auth/mobile-login  - 普通用户手机号登录"
echo "  POST /api/auth/register      - 普通用户手机号注册"
