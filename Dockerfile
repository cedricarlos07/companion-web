# ---- Stage 1 : Build frontend ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY src/ src/
COPY public/ public/
COPY index.html tsconfig.json vite.config.ts app.config.ts ./
COPY server/ server/
COPY website/ website/
COPY vite.marketing.config.ts ./
RUN npx tsc --noEmit -p tsconfig.server.json || true
RUN npx vite build
RUN npx vite build --config vite.marketing.config.ts

# ---- Stage 2 : Production ----
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client curl python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/website/dist ./website/dist
COPY server/ server/
COPY scripts/demo-docs/ scripts/demo-docs/
ENV NODE_ENV=production
ENV PORT=5299
EXPOSE 5299
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5299/api/status || exit 1
CMD ["npx", "tsx", "server/index.ts"]
