# syntax=docker/dockerfile:1
# Ohh My Chicken! API — production image.
#   docker build -t ohh-my-chicken-backend ./backend

# ---- 1. Install production dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- 2. Runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app

# tini forwards signals so the server shuts down cleanly on `docker stop`.
RUN apk add --no-cache tini

# Code stays root-owned and read-only; the app runs as the unprivileged "node" user.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Photo files: the only writable folder (mount a volume here).
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
