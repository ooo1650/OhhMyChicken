# syntax=docker/dockerfile:1
# Ohh My Chicken! frontend — React build (Vite) served by a small Node server
# that renders each page's SEO <head>, serves /sitemap.xml and proxies /api.
#   docker build -t ohh-my-chicken-frontend ./frontend

# ---- 1. Build the React app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- 2. Server dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

# ---- 3. Runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    BACKEND_URL=http://backend:4000 \
    ADMIN_PATH=admin
WORKDIR /app
# tini forwards signals so the server shuts down cleanly on `docker stop`.
RUN apk add --no-cache tini
# Code stays root-owned and read-only; the server runs as the unprivileged "node" user.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY src/shared/seo.js ./src/shared/seo.js
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
