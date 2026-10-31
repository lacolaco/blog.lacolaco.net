# .node-version と同じメジャーに合わせる
FROM node:24-alpine AS base
# corepack は Node 25 以降に同梱されず、Node を上げると壊れるため使わない。pnpm は package.json の packageManager のバージョンへ自動で切り替わる
RUN npm install -g --ignore-scripts pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install Astro runtime dependencies
FROM base AS prod-deps
RUN pnpm install --prod --ignore-scripts --shamefully-hoist

# NOTE: Requires Astro build output before Docker build
FROM base AS build
# Copy Astro build output
COPY ./dist ./dist

# Production image
FROM node:24-alpine
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/ .

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
ENV NODE_ENV=production

CMD ["node", "./dist/server/entry.mjs"]
