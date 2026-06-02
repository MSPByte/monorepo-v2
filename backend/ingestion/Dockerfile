FROM oven/bun:1 AS base

FROM base AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune ingestion --docker

FROM base AS builder
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN bun run turbo build --filter=ingestion

FROM base AS runner
WORKDIR /app

ARG PWSH_VERSION=7.5.1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libicu72 \
    && curl -fsSL "https://github.com/PowerShell/PowerShell/releases/download/v${PWSH_VERSION}/powershell-${PWSH_VERSION}-linux-x64.tar.gz" \
       -o /tmp/pwsh.tar.gz \
    && mkdir -p /opt/microsoft/powershell/7 \
    && tar -xzf /tmp/pwsh.tar.gz -C /opt/microsoft/powershell/7 \
    && chmod +x /opt/microsoft/powershell/7/pwsh \
    && ln -s /opt/microsoft/powershell/7/pwsh /usr/bin/pwsh \
    && rm /tmp/pwsh.tar.gz \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/backend/ingestion/dist ./backend/ingestion/dist
COPY --from=builder /app/backend/ingestion/package.json ./backend/ingestion/package.json

WORKDIR /app/backend/ingestion
CMD ["bun", "run", "start"]
