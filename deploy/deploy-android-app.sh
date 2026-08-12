#!/bin/bash
# ========================================
# Android App - EAS 构建与发布指南
# 适用于 rry.klai.top 生产环境
# ========================================

echo ""
echo "=========================================="
echo "  Android App 部署指南"
echo "  App ID: com.kll.health"
echo "  API: https://rry.klai.top"
echo "=========================================="
echo ""

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd android-app && pwd)"

# ============================
# 第一步：检查环境
# ============================
echo "[1/5] 检查环境..."

# 检查 Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node -v)"
else
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

# 检查 EAS CLI
if command -v eas &> /dev/null; then
    echo "✅ EAS CLI: $(eas --version 2>/dev/null || echo 'ok')"
else
    echo "⚠️  EAS CLI 未安装，运行: npm install -g eas-cli"
fi

# 检查 Expo
if [ -f "${APP_DIR}/app.json" ]; then
    echo "✅ Expo 项目配置存在"
else
    echo "❌ 找不到 app.json，请在 android-app 目录下运行"
    exit 1
fi

echo ""

# ============================
# 第二步：检查 API 配置
# ============================
echo "[2/5] 检查 API 配置..."

if [ -f "${APP_DIR}/src/api/client.js" ]; then
    API_URL=$(grep -o "https://[^'\"]*api" "${APP_DIR}/src/api/client.js" | head -1)
    echo "✅ API 地址: ${API_URL}"
else
    echo "⚠️  未找到 client.js，检查 API 地址配置"
fi

if [ -f "${APP_DIR}/app.json" ]; then
    BUNDLE_ID=$(grep -o '"bundleIdentifier"[[:space:]]*:[[:space:]]*"[^"]*"' "${APP_DIR}/app.json" | grep -o '[^"]\+$')
    echo "✅ Bundle ID: ${BUNDLE_ID}"
fi

echo ""

# ============================
# 第三步：构建配置
# ============================
echo "[3/5] EAS 构建配置..."
echo ""
echo "当前 eas.json 配置："
echo "  • 构建平台: Android (Google Play)"
echo "  • 版本代码: 15"
echo "  • 版本名称: 1.2.0"
echo "  • 包名: com.kll.health"
echo ""
echo "构建命令："
echo "  # 构建 Android APK（调试版，用于测试）"
echo "  cd ${APP_DIR} && eas build --platform android --profile development"
echo ""
echo "  # 构建 Android AAB（发布版，用于 Google Play）"
echo "  cd ${APP_DIR} && eas build --platform android --profile production"
echo ""
echo "  # 使用本地 Expo 构建（需要配置 eas.json）"
echo "  cd ${APP_DIR} && eas build --platform android"
echo ""

# ============================
# 第四步：本地构建（替代方案）
# ============================
echo "[4/5] 本地构建（可选）..."
echo ""
echo "方法A：使用 Expo Build（推荐）"
echo "  cd ${APP_DIR}"
echo "  npm install"
echo "  npx expo prebuild --clean  # 生成原生项目"
echo "  eas build --platform android --local  # 本地构建"
echo ""
echo "方法B：使用 Android Studio"
echo "  1. 运行: npx expo prebuild --clean"
echo "  2. 打开 android/ 目录到 Android Studio"
echo "  3. Build → Generate Signed Bundle / APK"
echo "  4. 选择 Keystore，输入密码，构建 release APK"
echo ""
echo "方法C：快速测试构建"
echo "  cd ${APP_DIR}"
echo "  npx expo start --clear  # 启动开发服务器"
echo "  使用 Expo Go App 扫描二维码调试"
echo ""

# ============================
# 第五步：发布到 Google Play
# ============================
echo "[5/5] Google Play 发布..."
echo ""
echo "步骤："
echo "  1. 确保 Google Play Developer 账号已注册（一次性 \$25 费用）"
echo "  2. 在 Google Play Console 创建新应用"
echo "  3. 上传 AAB 文件"
echo "  4. 填写应用信息："
echo "     • 应用名称: 元生AI生态健康饮食"
echo "     • 包名: com.kll.health"
echo "     • 分类: 健康健美"
echo "     • 隐私政策 URL: 需配置"
echo "  5. 完成内容分级问卷"
echo "  6. 选择发布轨道（内部测试/正式版）"
echo "  7. 提交审核"
echo ""
echo "注意事项："
echo "  • 首次发布需要 Google Play 审核（通常1-3天）"
echo "  • 确保 API 域名已在 Google Play 隐私政策中声明"
echo "  • 使用 EAS 构建的 AAB 自动包含签名信息"
echo ""

# ============================
# 检查清单
# ============================
echo "=========================================="
echo "  发布前检查清单"
echo "=========================================="
echo ""

CHECKLIST=(
    "API 地址已配置为 https://rry.klai.top"
    "Bundle ID 为 com.kll.health"
    "安全加固代码已包含（SecureStore 存储 Token）"
    "HTTPS 证书有效且未过期"
    "Google Play Developer 账号已注册"
    "Google Play Console 应用信息已填写"
    "隐私政策页面已配置"
    "用户协议已审核通过"
)

for item in "${CHECKLIST[@]}"; do
    echo "  □ ${item}"
done

echo ""
echo "构建完成！使用 eas submit --platform android --path ./build/output.aab 提交到 Google Play"
echo ""
