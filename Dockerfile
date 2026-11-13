FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production DB_PATH=/data/db/app.sqlite STORAGE_DIR=/data/files
VOLUME ["/data/db", "/data/files"]
EXPOSE 3000
CMD ["bun", "apps/server/src/index.ts"]
