# The always-on services (bots, operator, cup-operator, analysts) in one container.
# Render/Railway/Fly: build this image; it listens on $PORT and answers GET /health.
FROM node:24-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sdk/package.json sdk/package.json
COPY bots/package.json bots/package.json
RUN pnpm install --frozen-lockfile --filter bots...
COPY sdk sdk
COPY bots bots
COPY programs/idl programs/idl
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "bots", "exec", "tsx", "src/host.ts"]
