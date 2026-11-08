# .node-version と同じメジャーに合わせる
FROM node:26-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# corepack は Node 25 以降に同梱されないため、packageManager と同じ pnpm を npm で入れる。
RUN npm install -g --ignore-scripts "$(node -p 'require("./package.json").packageManager')" && pnpm --version

# Install Astro runtime dependencies
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# NOTE: Requires Astro build output before Docker build
FROM base AS build
# Copy Astro build output
COPY ./dist ./dist

# Production image
FROM node:26-alpine
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/ .

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
ENV NODE_ENV=production

CMD ["node", "./dist/server/entry.mjs"]
