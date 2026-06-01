FROM oven/bun:1 AS base

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages/ ./packages/
COPY backend/ingestion/ ./backend/ingestion/

RUN bun install --frozen-lockfile
RUN bun run build --filter=ingestion

FROM base AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget ca-certificates apt-transport-https \
    && wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends powershell \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/backend/ingestion/dist ./backend/ingestion/dist
COPY --from=builder /app/backend/ingestion/package.json ./backend/ingestion/package.json

WORKDIR /app/backend/ingestion
CMD ["bun", "run", "start"]
