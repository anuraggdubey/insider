# The always-on services (bots, operator, cup-operator, analysts) in one container.
# Render/Railway/Fly: build this image; it listens on $PORT and answers GET /health.
# The services are bundled to plain JavaScript at build time and run with `node` (no pnpm/tsx at
# run time), all in one Node process with a capped heap, so they fit in a 512 MB instance.
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
RUN pnpm --filter bots build
ENV NODE_ENV=production
CMD ["node", "--max-old-space-size=320", "bots/dist/host.mjs"]
