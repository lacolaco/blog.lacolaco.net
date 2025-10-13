FROM node:lts-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./ 

# Install Astro runtime dependencies 
FROM base AS prod-deps
RUN pnpm install --prod --ignore-scripts --shamefully-hoist

# NOTE: Requires Astro build output before Docker build
FROM base AS build
# Copy Astro build output
COPY ./dist ./dist

# Production image
FROM base
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/ .

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
ENV NODE_ENV=production

CMD ["node", "./dist/server/entry.mjs"]
