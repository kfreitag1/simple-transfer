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

FROM oven/bun:${BUN_VERSION} AS runtime-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production --filter @st/server

FROM oven/bun:${BUN_VERSION}
WORKDIR /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data/db /data/files \
  && chown bun:bun /data/db /data/files

COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=runtime-deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY --from=build /app/package.json /app/CHANGELOG.md /app/LICENSE ./
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/src ./apps/server/src
COPY --from=build /app/apps/server/migrations ./apps/server/migrations
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production HOME=/home/bun DB_PATH=/data/db/app.sqlite STORAGE_DIR=/data/files
VOLUME ["/data/db", "/data/files"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "apps/server/src/index.ts"]
