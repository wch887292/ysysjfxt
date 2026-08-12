#!/bin/bash
# ========================================
# 微信小程序 - 构建与发布指南
# 适用于 rry.klai.top 生产环境
# ========================================

echo ""
echo "=========================================="
echo "  微信小程序部署指南"
echo "  域名: rry.klai.top"
echo "=========================================="
echo ""

MINIPROGRAM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd miniprogram && pwd)"
APPID="wxfe26dc17bcb16161"

echo "📱 小程序目录: ${MINIPROGRAM_DIR}"
echo ""

# ============================
# 第一步：检查配置
# ============================
echo "[1/4] 检查配置..."

if [ ! -f "${MINIPROGRAM_DIR}/project.config.json" ]; then
    echo "❌ 找不到 project.config.json"
    exit 1
fi

# 检查 AppID
CURRENT_APPID=$(grep -o '"appid"[[:space:]]*:[[:space:]]*"[^"]*"' "${MINIPROGRAM_DIR}/project.config.json" | head -1 | grep -o '[a-z0-9]\{12,\}')
if [ "${CURRENT_APPID}" != "${APPID}" ]; then
    echo "⚠️  当前 AppID: ${CURRENT_APPID}, 期望: ${APPID}"
    echo "   如需更换，请修改 project.config.json"
fi
echo "✅ AppID: ${APPID}"

# 检查 API 地址配置
if grep -q "rry.klai.top" "${MINIPROGRAM_DIR}/app.js"; then
    echo "✅ API 地址已配置为生产域名"
else
    echo "⚠️  请确认 app.js 中 baseUrl 已指向生产环境"
fi

echo ""

# ============================
# 第二步：配置微信开发者工具
# ============================
echo "[2/4] 微信开发者工具配置..."
echo ""
echo "请在微信开发者工具中完成以下配置："
echo ""
echo "  1. 打开项目: ${MINIPROGRAM_DIR}"
echo ""
echo "  2. 设置 → 项目设置 → 安全设置"
echo "     ✓ 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」"
echo "     （开发调试时使用，上线前需取消勾选）"
echo ""
echo "  3. 设置 → 项目设置 → 上传代码"
echo "     确保「上传时压缩代码」已勾选"
echo ""
echo "  4. 在微信公众平台配置服务器域名："
echo "     登录: https://mp.weixin.qq.com"
echo "     路径: 开发 → 开发设置 → 服务器域名"
echo ""
echo "     需要添加的域名（全部为 rry.klai.top）："
echo "     ┌─────────────────────────────────────────────┐"
echo "     │ request 合法域名  : https://rry.klai.top    │"
echo "     │ uploadFile 域名   : https://rry.klai.top    │"
echo "     │ downloadFile 域名 : https://rry.klai.top    │"
echo "     │ socket 合法域名   : wss://rry.klai.top      │"
echo "     │ web-view 域名     : https://rry.klai.top    │"
echo "     └─────────────────────────────────────────────┘"
echo ""
echo "  5. 设置 → 项目设置 → 小程序代码上传设置"
echo "     确认密码保护已配置"
echo ""

# ============================
# 第三步：本地构建预览
# ============================
echo "[3/4] 本地构建..."
echo ""
echo "方法A：使用微信开发者工具（推荐）"
echo "  1. 打开微信开发者工具"
echo "  2. 导入项目: ${MINIPROGRAM_DIR}"
echo "  3. 点击「编译」预览效果"
echo "  4. 点击「上传」提交代码到微信服务器"
echo ""
echo "方法B：使用命令行构建"
echo "  npm install -g @wechat-miniprogram/miniprogram-cli"
echo "  miniprogram build --project ${MINIPROGRAM_DIR}"
echo ""

# ============================
# 第四步：上传发布
# ============================
echo "[4/4] 上传发布..."
echo ""
echo "步骤："
echo "  1. 在微信开发者工具中点击「上传」"
echo "  2. 填写版本号（如 1.0.1）和备注"
echo "  3. 提交后，登录微信公众平台 → 开发管理 → 版本管理"
echo "  4. 选择版本，点击「提交审核」"
echo "  5. 审核通过后，点击「全量发布」"
echo ""
echo "注意：安全加固后的代码已包含三层防线，无需额外配置"
echo ""

# ============================
# 检查清单
# ============================
echo "=========================================="
echo "  发布前检查清单"
echo "=========================================="
echo ""

CHECKLIST=(
    "API域名已配置为 https://rry.klai.top"
    "服务器域名已在微信公众平台配置"
    "request/upload/download 域名已添加"
    "socket 域名已添加（如需实时通信）"
    "本地开发时「不校验域名」已勾选"
    "版本号已更新（app.json 中的 version）"
    "隐私协议已更新（如有变更）"
)

for item in "${CHECKLIST[@]}"; do
    echo "  □ ${item}"
done

echo ""
echo "部署完成后，在微信公众平台查看审核状态。"
echo "审核通过后，用户即可使用最新版本小程序。"
echo ""
