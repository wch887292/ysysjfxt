> **English / 英文文档**：[README_EN.md](README_EN.md) · [FAQ (English)](FAQ_EN.md)

# 健康饮食积分系统（元生AI生态健康饮食积分系统）

> 基于 **微信小程序 + Node.js** 全栈架构的健康饮食积分激励平台，集成 AI 食物识别、健康评估、课程学习与积分兑换等功能，面向用户、代理商、服务商及超级管理员四类角色提供差异化服务。
>
> **研发单位**：晋江市飞虹智科技企业管理有限公司 · 飞扬企源研发中心
> **项目负责人**：吴赐虹

---
---

## 🌐 品牌与官网

本仓库由 **晋江市飞虹智科技企业管理有限公司 · 飞扬企源研发中心** 维护。

- 🏠 **官方网站**：[https://www.klai.top](https://www.klai.top) — 飞虹智 klAI · 泉州制造业 AI 服务商
- 📦 **开源矩阵**：[https://www.klai.top/opensource.html](https://www.klai.top/opensource.html)
- 🤖 **企业AI平台**：[https://www.klai.top/enterprise.html](https://www.klai.top/enterprise.html)



## 目录

- [项目概述](#项目概述)
- [功能亮点](#功能亮点)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [环境变量](#环境变量)
- [部署](#部署)
- [安全](#安全)
- [许可证](#许可证)

---

## 项目概述

**健康饮食积分系统**旨在通过积分激励引导用户养成健康饮食习惯。用户每日打卡记录饮食，系统借助 AI 进行食物识别与健康评分；用户完成健康问卷后可获取个性化 AI 报告；积分可通过打卡、签到、学习课程、邀请好友等途径累积，并在积分商城兑换礼品。

系统同时为**代理商**和**服务商**提供独立管理后台，超级管理员拥有全局管控权限，形成三级运营管理体系。

---

## 功能亮点

| # | 功能模块 | 说明 |
|---|---------|------|
| 1 | **微信登录** | 基于 OpenID 的静默登录，无需实名认证，降低使用门槛 |
| 2 | **每日打卡** | 支持图标模式与拍照模式；拍照模式下调用 AI 食物识别自动标注菜品 |
| 3 | **健康评估** | 问卷式健康自评 → AI 生成个性化报告，内置危机预警钩子（异常指标即时提醒） |
| 4 | **积分体系** | 打卡、签到、课程学习、邀请奖励多渠道积分累积，规则可配置 |
| 5 | **积分商城** | 礼品兑换支持幂等保护，防止重复扣款与超兑 |
| 6 | **课程学习** | 视频/图文课程，进度追踪与完成状态持久化 |
| 7 | **邀请分享** | 专属分享码邀请好友，双向积分奖励 |
| 8 | **荣誉徽章** | 多维度成就徽章体系，激励持续参与 |
| 9 | **三级后台** | 超级管理员 → 代理商 → 服务商，权限隔离与数据沙箱 |
| 10| **内容安全** | 上传图片经 AI 内容安全审核，过滤违规内容 |
| 11| **隐私保护** | AES-256-GCM 字段加密、用户授权同意管理、数据导出与删除（合规可遗忘） |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | 微信小程序 (WXML / WXSS / JS) | 原生小程序开发，无需额外框架 |
| **后端** | Node.js + Express | RESTful API 服务 |
| **ORM** | Sequelize | MySQL 数据库建模与查询 |
| **数据库** | MySQL | 关系型主存储 |
| **AI - 食物识别** | SiliconFlow Qwen3-VL | 多模态大模型，识别菜品与营养估算 |
| **AI - 内容安全** | SiliconFlow Qwen3-VL | 图片内容合规审核 |
| **对象存储（主）** | 腾讯云 COS | 图片与文件上传主存储 |
| **对象存储（备）** | 阿里云 OSS | COS 不可用时的降级存储 |
| **本地存储** | Local Storage | 无云存储时的兜底方案 |
| **进程管理** | PM2 | 生产环境进程守护与日志管理 |
| **反向代理** | Nginx | 请求转发、SSL 终结与负载均衡 |
| **部署环境** | 腾讯云 | 云服务器部署 |

---

## 快速开始

### 前置条件

- **Node.js** >= 18.x
- **MySQL** >= 5.7（推荐 8.0+）
- **微信开发者工具**（小程序开发与调试）
- **PM2**（全局安装，生产部署用）

### 安装

```bash
# 克隆项目
git clone https://github.com/wch887292/ysjfxt-diet-points.git
cd ysjfxt-diet-points

# 安装后端依赖
cd server
npm install

# 安装小程序依赖（如 package.json 存在）
cd ../miniprogram
npm install
```

### 配置环境变量

在 `server/` 目录下创建 `.env` 文件，参照 [环境变量](#环境变量) 章节填写必要配置。

### 初始化数据库

```bash
cd server

# 同步数据库表结构（开发环境）
npm run db:sync

# 或使用 Sequelize CLI 迁移
npx sequelize-cli db:migrate
```

### 启动服务

```bash
# 开发环境
cd server
npm run dev

# 生产环境
pm2 start ecosystem.config.js
```

在微信开发者工具中导入 `miniprogram/` 目录即可预览小程序。

---

## 项目结构

```
ysjfxt/
├── miniprogram/                  # 微信小程序前端
│   ├── pages/                    # 页面目录
│   ├── components/               # 公共组件
│   ├── utils/                    # 工具函数
│   ├── api/                      # 接口请求封装
│   ├── app.js                    # 小程序入口
│   ├── app.json                  # 全局配置
│   └── app.wxss                  # 全局样式
│
├── server/                       # Node.js 后端服务
│   ├── config/                   # 配置文件
│   ├── controllers/              # 控制器（业务逻辑）
│   ├── models/                   # Sequelize 模型定义
│   ├── routes/                   # 路由注册
│   ├── middleware/               # 中间件（鉴权、限流等）
│   ├── services/                 # 业务服务层
│   ├── utils/                    # 工具函数
│   ├── migrations/               # 数据库迁移文件
│   ├── seeders/                  # 数据填充
│   ├── app.js                    # Express 应用入口
│   └── ecosystem.config.js       # PM2 部署配置
│
├── docs/                         # 项目文档
│   ├── api/                      # API 接口文档
│   ├── design/                   # 设计文档
│   └── deployment/               # 部署文档
│
├── .env.example                  # 环境变量示例
└── README.md                     # 本文件
```

---

## 环境变量

在 `server/` 目录下创建 `.env` 文件，以下为关键配置项：

### 服务器配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 服务监听端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |

### 数据库配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DB_HOST` | MySQL 主机地址 | `127.0.0.1` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_NAME` | 数据库名 | `ysjfxt` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |

### 微信小程序配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `WX_APPID` | 小程序 AppID | `wx1234567890` |
| `WX_SECRET` | 小程序 AppSecret | `your_wx_secret` |

### AI 服务配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SILICONFLOW_API_KEY` | SiliconFlow API 密钥 | `sk-xxx` |
| `SILICONFLOW_MODEL` | 使用的模型标识 | `Qwen/Qwen3-VL` |

### 对象存储配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `COS_SECRET_ID` | 腾讯云 COS SecretId | `xxx` |
| `COS_SECRET_KEY` | 腾讯云 COS SecretKey | `xxx` |
| `COS_BUCKET` | COS 存储桶名称 | `my-bucket-1250000000` |
| `COS_REGION` | COS 地域 | `ap-guangzhou` |
| `OSS_ACCESS_KEY_ID` | 阿里云 OSS AccessKeyId | `xxx` |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 OSS AccessKeySecret | `xxx` |
| `OSS_BUCKET` | OSS 存储桶名称 | `my-oss-bucket` |
| `OSS_REGION` | OSS 地域 | `oss-cn-hangzhou` |

### 安全配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | `your_jwt_secret` |
| `AES_ENCRYPTION_KEY` | AES-256-GCM 加密密钥（32字节） | `your_32_byte_key_here_xxxxxx` |
| `ENCRYPTION_IV` | 加密初始向量（12字节） | `your_12_byte_iv` |

---

## 部署

### 生产环境部署步骤

1. **服务器准备**

   ```bash
   # 安装 Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # 安装 PM2
   npm install -g pm2

   # 安装 Nginx
   sudo apt-get install -y nginx
   ```

2. **部署代码**

   ```bash
   git clone <repository-url> /var/www/ysjfxt
   cd /var/www/ysjfxt/server
   npm install --production
   ```

3. **配置环境变量**

   ```bash
   cp .env.example .env
   vim .env  # 填写生产环境配置
   ```

4. **初始化数据库**

   ```bash
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all  # 可选：填充初始数据
   ```

5. **启动服务**

   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup  # 开机自启
   ```

6. **配置 Nginx 反向代理**

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

7. **配置 SSL（推荐）**

   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### 用户角色说明

| 角色 | 标识 | 说明 |
|------|------|------|
| 普通用户 | `user` | 小程序端使用者，打卡、学习、兑换 |
| 代理商 | `agent` | 管理下属服务商与用户，独立数据视图 |
| 服务商 | `service_provider` | 管理直属用户，运营内容与课程 |
| 超级管理员 | `admin`（`is_super = true`） | 全局权限，系统配置与全局数据管控 |

---

## 安全

### 数据加密

- 敏感字段（手机号、身份证等）采用 **AES-256-GCM** 对称加密存储
- 密钥与 IV 通过环境变量注入，不写入代码仓库

### 隐私合规

- **授权同意管理**：用户数据采集前需获得明确同意，同意记录可追溯
- **数据导出**：用户可一键导出个人全量数据
- **数据删除**：支持用户发起数据删除请求，满足可遗忘合规要求

### 接口安全

- JWT Token 鉴权，Token 有效期可配置
- 接口限流防止暴力攻击
- 积分兑换幂等保护，基于唯一请求标识防重放

### 内容安全

- 用户上传图片经 AI 内容安全审核后方可存储与展示
- 审核不通过的图片即时拦截并反馈用户

---


---

## 🤝 社区支持

关注飞虹智 klAI 动态，获取最新开源项目更新与技术教程：

![社区支持二维码](https://github.com/ysysjfxt/releases/download/v1.0.0-community/qrcode-community.png)

扫码加入 **飞虹智企微小助手**，获取：
- 技术答疑与部署指导
- 开源项目更新通知
- 本地化服务预约（泉州地区）
- 企业 AI 数字化咨询

---

*晋江市飞虹智科技企业管理有限公司 · 飞扬企源研发中心 · 负责人：吴赐虹*

## 许可证

本项目基于 **Apache License 2.0** 开源发布，详见 [LICENSE](LICENSE)。

Copyright © 2026 晋江市飞虹智科技企业管理有限公司 · 飞扬企源研发中心. All rights reserved.
