# Health-Diet Points System (Yuansheng AI Ecosystem)

> A full-stack **WeChat mini-program + Node.js** health-diet points-incentive platform integrating AI food recognition, health assessment, course learning, and points redemption. It serves four roles — user, agent, service provider, and super admin — with differentiated capabilities.

> **Developer**: Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center
> **Project lead**: Wu Cihong

---

## 🌐 Brand & Official Site

Maintained by **Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center**.

- 🏠 **Official site**: [https://www.klai.top](https://www.klai.top) — Feihongzhi klAI · Quanzhou manufacturing-AI service provider
- 📦 **Open-source matrix**: [https://www.klai.top/opensource.html](https://www.klai.top/opensource.html)
- 🤖 **Enterprise AI platform**: [https://www.klai.top/enterprise.html](https://www.klai.top/enterprise.html)

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## Overview

The **Health-Diet Points System** guides users to build healthy eating habits through points incentives. Users check in daily to log their diet; the system uses AI for food recognition and health scoring; after completing a health questionnaire users get a personalized AI report; points accumulate via check-ins, sign-ins, course learning, and referrals, and can be redeemed for gifts in the points mall.

The system also provides independent admin consoles for **agents** and **service providers**, while the super admin holds global control — forming a three-tier operations management system.

---

## Highlights

| # | Module | Description |
|---|---------|------|
| 1 | **WeChat login** | Silent OpenID-based login, no real-name required, low friction |
| 2 | **Daily check-in** | Icon mode and photo mode; photo mode calls AI food recognition to auto-tag dishes |
| 3 | **Health assessment** | Questionnaire self-assessment → AI generates personalized report, with crisis-alert hooks (abnormal indicators alerted instantly) |
| 4 | **Points system** | Accumulate via check-in, sign-in, course learning, referrals; configurable rules |
| 5 | **Points mall** | Gift redemption with idempotency protection, preventing double-charge and over-redemption |
| 6 | **Course learning** | Video/text courses with progress tracking and persisted completion |
| 7 | **Referral sharing** | Exclusive share code invites friends, two-way points rewards |
| 8 | **Honor badges** | Multi-dimensional achievement badge system to sustain engagement |
| 9 | **Three-tier admin** | Super admin → agent → service provider, permission isolation & data sandbox |
| 10| **Content safety** | Uploaded images pass AI content-safety moderation, filtering violations |
| 11| **Privacy** | AES-256-GCM field encryption, consent management, data export & deletion (right to be forgotten) |

---

## Tech Stack

| Layer | Technology | Notes |
|------|------|------|
| **Frontend** | WeChat mini-program (WXML / WXSS / JS) | native, no extra framework |
| **Backend** | Node.js + Express | RESTful API |
| **ORM** | Sequelize | MySQL modeling & queries |
| **Database** | MySQL | primary relational store |
| **AI – food recognition** | SiliconFlow Qwen3-VL | multimodal model, dish recognition & nutrition estimate |
| **AI – content safety** | SiliconFlow Qwen3-VL | image content compliance moderation |
| **Object storage (primary)** | Tencent Cloud COS | image/file primary storage |
| **Object storage (fallback)** | Alibaba Cloud OSS | degraded storage when COS unavailable |
| **Local storage** | Local Storage | fallback when no cloud storage |
| **Process manager** | PM2 | production process guard & logs |
| **Reverse proxy** | Nginx | request forwarding, SSL termination, load balancing |
| **Deploy env** | Tencent Cloud | cloud server deployment |

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **MySQL** >= 5.7 (8.0+ recommended)
- **WeChat DevTools** (mini-program dev & debug)
- **PM2** (global install, for production)

### Install

```bash
# Clone
git clone https://github.com/wch887292/ysjfxt-diet-points.git
cd ysjfxt-diet-points

# Backend deps
cd server
npm install

# Mini-program deps (if package.json exists)
cd ../miniprogram
npm install
```

### Configure environment variables

Create a `.env` file in `server/` per the [Environment Variables](#environment-variables) section.

### Initialize database

```bash
cd server

# Sync schema (dev)
npm run db:sync

# Or use Sequelize CLI migration
npx sequelize-cli db:migrate
```

### Start

```bash
# Dev
cd server
npm run dev

# Production
pm2 start ecosystem.config.js
```

Import the `miniprogram/` directory in WeChat DevTools to preview.

---

## Project Structure

```
ysjfxt/
├── miniprogram/                  # WeChat mini-program frontend
│   ├── pages/                    # pages
│   ├── components/               # shared components
│   ├── utils/                    # utilities
│   ├── api/                      # request wrappers
│   ├── app.js / app.json / app.wxss
├── server/                       # Node.js backend
│   ├── config/                   # config files
│   ├── controllers/              # controllers (business logic)
│   ├── models/                   # Sequelize models
│   ├── routes/                   # route registration
│   ├── middleware/               # middleware (auth, rate limit, etc.)
│   ├── services/                 # service layer
│   ├── utils/                    # utilities
│   ├── migrations/               # DB migrations
│   ├── seeders/                  # seed data
│   ├── app.js                    # Express entry
│   └── ecosystem.config.js       # PM2 config
├── docs/                         # docs
│   ├── api/                      # API docs
│   ├── design/                   # design docs
│   └── deployment/               # deployment docs
├── .env.example                  # env example
└── README.md                     # this file
```

---

## Environment Variables

Create `.env` in `server/`. Key items:

### Server

| Variable | Description | Example |
|--------|------|------|
| `PORT` | Listen port | `3000` |
| `NODE_ENV` | Runtime env | `production` |

### Database

| Variable | Description | Example |
|--------|------|------|
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | DB name | `ysjfxt` |
| `DB_USER` | DB user | `root` |
| `DB_PASSWORD` | DB password | `your_password` |

### WeChat mini-program

| Variable | Description | Example |
|--------|------|------|
| `WX_APPID` | Mini-program AppID | `wx1234567890` |
| `WX_SECRET` | Mini-program AppSecret | `your_wx_secret` |

### AI service

| Variable | Description | Example |
|--------|------|------|
| `SILICONFLOW_API_KEY` | SiliconFlow API key | `sk-xxx` |
| `SILICONFLOW_MODEL` | Model id | `Qwen/Qwen3-VL` |

### Object storage

| Variable | Description | Example |
|--------|------|------|
| `COS_SECRET_ID` | Tencent COS SecretId | `xxx` |
| `COS_SECRET_KEY` | Tencent COS SecretKey | `xxx` |
| `COS_BUCKET` | COS bucket | `my-bucket-1250000000` |
| `COS_REGION` | COS region | `ap-guangzhou` |
| `OSS_ACCESS_KEY_ID` | Alibaba OSS AccessKeyId | `xxx` |
| `OSS_ACCESS_KEY_SECRET` | Alibaba OSS AccessKeySecret | `xxx` |
| `OSS_BUCKET` | OSS bucket | `my-oss-bucket` |
| `OSS_REGION` | OSS region | `oss-cn-hangzhou` |

### Security

| Variable | Description | Example |
|--------|------|------|
| `JWT_SECRET` | JWT signing secret | `your_jwt_secret` |
| `AES_ENCRYPTION_KEY` | AES-256-GCM key (32 bytes) | `your_32_byte_key_here_xxxxxx` |
| `ENCRYPTION_IV` | Encryption IV (12 bytes) | `your_12_byte_iv` |

---

## Deployment

### Production deployment steps

1. **Prepare server**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install -g pm2
   sudo apt-get install -y nginx
   ```
2. **Deploy code**
   ```bash
   git clone <repository-url> /var/www/ysjfxt
   cd /var/www/ysjfxt/server
   npm install --production
   ```
3. **Configure env**: `cp .env.example .env` and edit.
4. **Init DB**: `npx sequelize-cli db:migrate` (+ optional `db:seed:all`).
5. **Start**: `pm2 start ecosystem.config.js --env production` then `pm2 save` and `pm2 startup`.
6. **Nginx reverse proxy**:
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
7. **SSL (recommended)**: `sudo certbot --nginx -d your-domain.com`.

### User roles

| Role | Flag | Description |
|------|------|------|
| User | `user` | mini-program end user: check-in, learning, redemption |
| Agent | `agent` | manages subordinate providers & users, isolated data view |
| Service provider | `service_provider` | manages direct users, operates content & courses |
| Super admin | `admin` (`is_super = true`) | global permissions, system config & global data |

---

## Security

### Data encryption

- Sensitive fields (phone, ID, etc.) stored with **AES-256-GCM** symmetric encryption.
- Keys and IV injected via environment variables, never committed to the repo.

### Privacy compliance

- **Consent management**: explicit consent before data collection, with traceable consent records.
- **Data export**: users can export all their personal data in one click.
- **Data deletion**: users can request deletion, satisfying right-to-be-forgotten.

### API security

- JWT authentication with configurable token expiry.
- Rate limiting against brute-force.
- Idempotent points redemption based on a unique request id (replay protection).

### Content safety

- Uploaded images are stored/displayed only after passing AI content-safety moderation.
- Rejected images are intercepted and fed back to the user immediately.

---

## 🤝 Community Support

Stay tuned to Feihongzhi klAI for the latest open-source updates and tutorials.

*Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center · Lead: Wu Cihong*

## License

This project is open-sourced under the **Apache License 2.0** — see [LICENSE](LICENSE).

Copyright © 2026 Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center. All rights reserved.
