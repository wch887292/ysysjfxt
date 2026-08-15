# Health-Diet Points System FAQ (English)

> WeChat mini-program + Node.js health-diet points platform

---

## Table of Contents

- [Basics](#basics)
- [Setup & Deployment](#setup--deployment)
- [AI Features](#ai-features)
- [Roles & Permissions](#roles--permissions)
- [Security & Privacy](#security--privacy)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Basics

### Q: What is the Health-Diet Points System?

A full-stack platform that incentivizes healthy eating via points. Users check in daily and log diet (with AI food recognition), get AI health assessments and reports, learn courses, and redeem gifts in a points mall. It serves users, agents, service providers, and a super admin through a three-tier operations system.

### Q: Which platforms are supported?

The frontend is a **WeChat mini-program**; the backend is a Node.js + Express service deployable on Tencent Cloud (or any Linux server with Node + MySQL).

### Q: Is it open source?

Yes, under the **Apache License 2.0**.

---

## Setup & Deployment

### Q: What are the prerequisites?

- Node.js >= 18.x
- MySQL >= 5.7 (8.0+ recommended)
- WeChat DevTools
- PM2 (production)

### Q: How do I run it locally?

```bash
git clone https://github.com/wch887292/ysjfxt-diet-points.git
cd ysjfxt-diet-points/server
npm install
cp .env.example .env      # fill in DB / WeChat / AI / storage / security
npm run db:sync           # or: npx sequelize-cli db:migrate
npm run dev
```

Import `miniprogram/` in WeChat DevTools to preview the app.

### Q: How do I deploy to production?

See the [Deployment](#deployment) section in README: install Node + PM2 + Nginx, clone code, `npm install --production`, configure `.env`, run migrations, `pm2 start ecosystem.config.js --env production`, then configure Nginx reverse proxy and Certbot SSL.

### Q: Can I use a different object storage?

Yes. Tencent COS is primary; Alibaba OSS is the configured fallback. There is also a local-storage fallback when no cloud storage is available.

---

## AI Features

### Q: How does AI food recognition work?

In photo check-in mode, uploaded images are sent to SiliconFlow Qwen3-VL (multimodal) which recognizes dishes and estimates nutrition, auto-tagging the check-in.

### Q: What does the health assessment do?

Users complete a health questionnaire; the system generates a personalized AI report. Abnormal indicators trigger instant crisis alerts.

### Q: Is an AI API key required?

Yes, for the food-recognition and content-safety features you need a `SILICONFLOW_API_KEY`. Set it in `.env`.

---

## Roles & Permissions

### Q: What are the four roles?

| Role | Flag | Description |
|------|------|------|
| User | `user` | check-in, learning, redemption |
| Agent | `agent` | manages subordinate providers & users |
| Service provider | `service_provider` | manages direct users, content & courses |
| Super admin | `admin` (`is_super=true`) | global config & data |

### Q: How is the three-tier admin isolated?

Agents and service providers get isolated data views (data sandbox); only the super admin sees global data and system configuration.

---

## Security & Privacy

### Q: How is sensitive data protected?

Sensitive fields (phone, ID) are encrypted with **AES-256-GCM**. Keys/IV come from environment variables, never from the code repo.

### Q: How is privacy compliance handled?

- Explicit consent before data collection, with traceable records.
- One-click personal data export.
- User-initiated data deletion (right to be forgotten).

### Q: Are points redemptions safe?

Yes. Redemption is idempotent based on a unique request id, preventing double-charge and over-redemption (replay protection).

### Q: How is content safety enforced?

Uploaded images pass AI content-safety moderation before storage/display; rejected images are intercepted and the user is notified.

---

## Troubleshooting

### Q: Database connection fails?

- Ensure MySQL is running and `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` in `.env` are correct.
- For migrations, ensure the DB exists and the user has privileges.

### Q: Mini-program can't reach the backend?

- Confirm `server` is up and Nginx proxies `/` to `http://127.0.0.1:3000`.
- Add your backend domain to WeChat "request legal domains".

### Q: AI features return errors?

- Check `SILICONFLOW_API_KEY` is valid and has quota.
- Verify network access to the SiliconFlow endpoint.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE). Copyright © 2026 Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center.

*Jinjiang Feihongzhi Technology Enterprise Management Co., Ltd. · Feiyang Qiyuan R&D Center · Lead: Wu Cihong*
