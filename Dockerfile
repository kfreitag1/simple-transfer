# The only pin of the runtime: CI reads it from here, so the checks run on what the image ships
ARG BUN_VERSION=1.3.13

FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION}
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production DB_PATH=/data/db/app.sqlite STORAGE_DIR=/data/files
VOLUME ["/data/db", "/data/files"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "apps/server/src/index.ts"]
