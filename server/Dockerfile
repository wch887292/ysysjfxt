# ========================================
# 健康饮食积分系统 - 后端 Dockerfile
# Node.js 18 + Express + Sequelize
# ========================================

# ========== Stage 1: 安装依赖 ==========
FROM node:18-alpine AS builder

WORKDIR /app

# 安装系统依赖（用于某些原生模块），使用国内镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++ openssl

# 复制 package 文件（package-lock.json 不存在，只用 package.json）
COPY server/package.json ./

# 安装所有依赖
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --verbose && \
    npm cache clean --force

# 复制源代码
COPY server/ .

# ========== Stage 2: 生产镜像 ==========
FROM node:18-alpine AS production

WORKDIR /app

# 使用 node 镜像自带的 node 用户（Alpine 的 addgroup 不支持 -r 参数）

# 从 builder 阶段复制 node_modules
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# 复制应用代码
COPY --from=builder --chown=node:node /app/models ./models
COPY --from=builder --chown=node:node /app/routes ./routes
COPY --from=builder --chown=node:node /app/middleware ./middleware
COPY --from=builder --chown=node:node /app/utils ./utils
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/services ./services
COPY --from=builder --chown=node:node /app/*.json ./
COPY --from=builder --chown=node:node /app/*.js ./

# 创建必要目录（包括 data 目录用于存储授权文件）
RUN mkdir -p /app/uploads/gifts /app/uploads/articles /app/logs /app/data && \
    chown -R node:node /app/uploads /app/logs /app/data

# 切换到非 root 用户
USER node

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# 启动命令
CMD ["node", "app.js"]
