# 贡献指南

感谢您对 **元生AI生态健康饮食积分系统（ysjfxt-diet-points）** 的关注与贡献！

## 行为准则

请遵循 GitHub 社区准则：尊重他人、建设性反馈、不发布垃圾信息。商业与安全相关内容（授权激活机制、密钥、内部审计报告）请勿提交。

## 如何贡献

### 1. 报告 Issue

- 使用清晰的标题描述问题
- 说明复现步骤、预期行为与实际行为
- 附上环境信息（Node 版本、MySQL 版本、微信开发者工具版本等）

### 2. 提交 Pull Request

```bash
# Fork 仓库后克隆
git clone https://github.com/wch887292/ysjfxt-diet-points.git
cd ysjfxt-diet-points

# 创建功能分支
git checkout -b feature/your-feature

# 提交变更
git add .
git commit -m "feat: 描述你的改动"

# 推送到你的仓库并发起 PR
git push origin feature/your-feature
```

### PR 要求

- **单一职责**：一个 PR 只做一件事
- **代码规范**：保持与现有代码风格一致（ESLint 规则）
- **测试**：涉及后端逻辑的改动需通过 `npm test`（`server/` 目录下）
- **描述**：说明改动的目的、方案与影响范围

## 开发环境

```bash
cd server
npm install
npm run dev        # 启动后端（开发模式）
npm run init-db    # 初始化数据库表结构
```

小程序端使用微信开发者工具导入 `miniprogram/` 目录；管理后台：

```bash
cd admin-web
npm install
npm run dev        # Vite 开发服务器
```

## 分支与版本

- `main`：稳定分支，保持可部署状态
- 功能开发请在独立分支进行，通过 PR 合入

## 许可证

提交代码即视为同意在 [Apache License 2.0](LICENSE) 下发布您的贡献。
