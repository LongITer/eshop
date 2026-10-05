FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma
COPY scripts ./scripts
COPY tsconfig.base.json ./
RUN npm ci --include=dev
RUN npx prisma generate
RUN node scripts/build-services.cjs admin-service
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.build/admin-service ./dist
COPY --from=build --chown=node:node /app/apps/admin-service/src ./apps/admin-service/src
USER node
CMD ["node", "dist/main.js"]
