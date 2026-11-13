# Architecture

Self-hosted file sending (WeTransfer "Send" only). A signed-in user uploads files and gets a link; anyone with the link downloads until it expires. Single process, single container, SQLite plus a blob directory.

Code is the source of truth where it exists. This document specifies behaviour and points at the code that defines shapes; it does not repeat them.

| Shape | Defined in |
|---|---|
| Request/response DTOs | `packages/shared/src/contract.ts` |
| Limits, defaults, layer resolution | `packages/shared/src/limits.ts` |
| Error codes and statuses | `packages/shared/src/errors.ts` |
| Tunables (chunk size, TTLs, max lengths, roles) | `packages/shared/src/constants.ts` |
| Path validation | `packages/shared/src/paths.ts` |
| Share ids and their word lists | `packages/shared/src/share-id.ts`, `words.ts` |
| Tables | `apps/server/src/db/schema.ts` |
| Storage port | `apps/server/src/storage/storage.ts` |
| Configuration | `apps/server/src/env.ts`, `.env.example` |

## Layout

```
packages/shared   @st/shared  Isomorphic, no I/O except `fetch` in upload.ts. Imported as @st/shared/<file>.
apps/server       @st/server  Elysia API, Better Auth, Drizzle on bun:sqlite, storage, sweeper. Serves the built web app.
apps/web          @st/web     Solid SPA (Vite). Talks to the API through Eden (`src/api.ts`) and `uploadTransfer`.
```

Dependency direction: `web → shared ← server`. Web imports only the `App` *type* from server. Shared never imports from apps. No build step for shared or server: Bun runs TypeScript directly.

Server module map (existing files marked ✓, the rest are to be written):

```
src/index.ts ✓            boot: env → context → API + web → listen; starts the sweeper
src/app.ts ✓              Context, createContext, createApp (composes route plugins under /api)
src/env.ts ✓  auth.ts ✓  errors.ts ✓  web.ts ✓  db/ ✓  plugins/auth.ts ✓
src/plugins/rate-limit.ts rateLimit macro + clientIp
src/storage/local.ts      local-disk adapter;  storage.contract.ts: reusable adapter test suite
src/limits.ts             limitsFor(user), usedBytes(userId)
src/transfers/service.ts  create, view access, append, finalize, delete, DTO mapping
src/transfers/routes.ts   thin Elysia plugin over the service
src/admin/routes.ts
src/sweeper.ts
test/harness.ts ✓         createTestApp(): in-memory DB, `request`, `signIn`
```

Routes stay thin: validate with contract schemas, call a service function taking `(ctx, …)`, return a DTO. Services throw the error classes in `errors.ts`. `Context` gains `storage: Storage` when the adapter lands; tests then give it a temp directory.

## Auth

- Better Auth, OIDC only, one provider with id `oidc` (`genericOAuth`). No passwords, no other sign-up path. Redirect URI: `${BASE_URL}/api/auth/callback/oidc`. The client starts it with `signIn()` in `apps/web/src/auth.ts`.
- Every user who authenticates at the IdP is provisioned. The first user ever created gets role `admin`, all others `user` (`databaseHooks` in `auth.ts`). Roles are those of the Better Auth admin plugin.
- User administration (list, set role, ban) uses the admin plugin's own endpoints through `authClient.admin.*`. There are no custom user routes. Users are banned, not deleted: `transfer.owner_id` is `ON DELETE RESTRICT` so blobs cannot be orphaned.
- Route protection: `{ auth: true }` / `{ admin: true }` macros (`plugins/auth.ts`). Routes that are public but owner-aware read the session directly.

## Limits

`Limits` has four values, `null` meaning unlimited: `maxTransferBytes`, `quotaBytes`, `maxExpirySeconds`, `defaultExpirySeconds`. "Never expires" is simply `maxExpirySeconds: null`.

All four are configurable per layer. Effective limits are `resolveLimits(global, role, user)` over the built-in `DEFAULT_LIMITS`; layers are rows of `limit_override`, each a partial object where an absent key inherits. `limitsFor(user)` loads the three rows that apply. Changing limits never affects existing transfers.

`usedBytes(userId)` is `SUM(transfer.size)` over the user's existing transfers in either status: quota is reserved at creation and released on deletion or expiry.

`checkTransfer(input, me)` in `shared/limits.ts` is shared by both sides: the web app calls it before submitting; the server calls it as the authority. It returns the first failure of: total size over `maxTransferBytes` → `transfer-too-large`; `usedBytes + total` over `quotaBytes` → `quota-exceeded`; `expiresIn` over `maxExpirySeconds`, or `null` when the max is not `null` → `expiry-too-long`.

## API

All under `/api`. JSON unless noted. Errors are RFC 9457 problem documents with a `code` from `ERROR_STATUS`; on the client they become `ApiError` (`shared/errors.ts`). No pagination in the MVP.

| Method and path | Access | Body → response |
|---|---|---|
| `GET /me` | user | → `Me` |
| `POST /transfers` | user, limit `create` | `TransferCreate` → `Transfer` |
| `GET /transfers` | user | → `TransferSummary[]`, own, newest first |
| `GET /transfers/:id` | view, limit `public` | → `Transfer` |
| `DELETE /transfers/:id` | owner or admin | → 204 |
| `PATCH /transfers/:id/files/:fileId?offset=N` | owner | raw bytes → `ChunkResult` |
| `POST /transfers/:id/finalize` | owner | → `Transfer` |
| `POST /transfers/:id/unlock` | anyone, limit `unlock` | `Unlock` → 204 + cookie |
| `GET /transfers/:id/files/:fileId` | view, limit `public` | → file bytes, `Range` supported |
| `GET /transfers/:id/zip` | view, limit `public` | → streamed zip |
| `GET /admin/transfers` | admin | → `AdminTransfer[]` |
| `GET /admin/limits` | admin | → `AdminLimits` |
| `PUT /admin/limits` | admin | `LimitOverride` → 204; empty `values` deletes the row |
| `GET /admin/stats` | admin | → `AdminStats` |
| `GET,POST /auth/*` | | Better Auth |

**View access**, one function used by the three `view` routes, evaluated in order:
1. No such transfer, or `expiresAt` has passed (do not wait for the sweeper) → `not-found`.
2. Requester is the owner or an admin → allowed.
3. Status is `uploading` → `not-found`.
4. Transfer has a password and the request has no valid unlock cookie → `password-required`.

Owner-only routes answer `not-found`, not `forbidden`, to anyone else.

**Unlock.** Verify with `Bun.password.verify`; failure is `password-invalid`. Success sets Elysia's signed cookie `unlock` (app config `cookie: { secrets: env.authSecret, sign: ["unlock"] }`): value the transfer id, `Path=/api/transfers/<id>`, `Max-Age=UNLOCK_TTL_SECONDS`, `HttpOnly`, `SameSite=Lax`, `Secure` when `BASE_URL` is https. A cookie with a bad signature makes Elysia answer `invalid-cookie`, which the client treats as `password-required`.

**Create.** Normalize every path with `normalizePath` (`shared/paths.ts`, used by client and server): split on `/`, reject empty, `.` and `..` segments, backslashes, control characters, a leading `/`, and lengths over `MAX_PATH_LENGTH`. An invalid or duplicate path → `invalid-path`. Then `checkTransfer`. Insert the transfer and its files in one synchronous transaction that also reads `usedBytes`, so concurrent creates cannot exceed quota. `expiresAt` is fixed here: `now + (expiresIn ?? defaultExpirySeconds)`, or null.

The primary key is a share id, so a collision fails the insert: catch the unique-constraint error and retry the whole transaction with a fresh id (3 attempts, then let it become a 500).

## Upload protocol

1. `POST /transfers` declares every file's path and size. The response carries file ids and `offset: 0`.
2. For each file, `PATCH …/files/:fileId?offset=N` with `Content-Type: application/octet-stream` and the next `CHUNK_BYTES` (less for the final chunk). The server appends and answers `{ offset }`.
3. `POST …/finalize` checks `storage.size` equals the declared size for every file, else `upload-incomplete`, then sets `ready`. Idempotent.

Server rules for PATCH (route uses `parse: "none"` and streams `request.body`, never buffering a chunk):
- Transfer not `uploading` → `transfer-finalized`.
- Offset differs from the stored size → `offset-mismatch` with the true `offset` (thrown by the storage adapter).
- Cap the stream at `min(CHUNK_BYTES, file.size − offset)`; exceeding it → `chunk-too-large`.
- Update `touchedAt`.
- Start Bun with `maxRequestBodySize` slightly above `CHUNK_BYTES`.

Offsets live only in storage. `Transfer.files[].offset` is `storage.size` while uploading and `size` once ready. Zero-byte files need no PATCH and have no blob; download and zip code must not call `storage.read` for them.

`uploadTransfer` (`shared/upload.ts`, signature fixed) is the only uploader:
- Skips complete files; runs `UPLOAD_CONCURRENCY` files in parallel, chunks of a file in sequence.
- `offset-mismatch` → continue from the returned offset.
- Network error, 5xx or 429 → retry the chunk with exponential backoff (1 s doubling to 30 s); reject after 5 consecutive failures. Any other 4xx rejects immediately.
- Abort signal → reject; nothing else to clean up.
- Resume in every case (pause, failure, reload) is `GET /transfers/:id` then `uploadTransfer` again with the same blobs. After a reload the user re-selects the files; the web app matches them to the transfer by path and size.

## Downloads

- File: return `storage.read(key)` so Elysia serves `Range`. Headers: `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename*=UTF-8''<encoded basename>`, `X-Content-Type-Options: nosniff`. User content is never served inline.
- Zip: `client-zip` `downloadZip` over `storage.read(key).stream()` per file, stored uncompressed, entry names are the file paths, `Content-Length` from `predictLength`. Streams with constant memory and supports Zip64. Name: `<title or "transfer">.zip`.
- `downloads` increments once per zip request and once per file request that has no `Range` header.

## Storage

The `Storage` port has four methods and no knowledge of transfers. Keys are `<transferId>/<fileId>`; deleting a transfer is `remove("<transferId>/")`.

`local.ts`: files under `STORAGE_DIR/<key>`, appended in place (no temp files or renames, so nothing depends on other filesystems). It serializes `append` per key with an in-process lock, because check-then-append would otherwise race.

Adding S3 later is a new adapter plus a `STORAGE_DRIVER` setting, with no change to routes or services: `append` maps to multipart `UploadPart` (hence `CHUNK_BYTES ≥ 5 MiB` and full-size non-final chunks), `size` to the sum of uploaded parts, `read` to Bun's `S3File` (also a lazy `Blob`). The one port change it needs is a `commit(key)` called from finalize to complete the multipart upload.

The database and the blobs are configured independently (`DB_PATH`, `STORAGE_DIR`) and may be on different disks. Consistency between them is kept by one rule: **delete blobs first, then the row**. A crash in between leaves a row whose deletion is retried; a blob never exists without a row.

## Lifecycle

`deleteTransfer(ctx, id)` is the single deletion path (owner, admin, sweeper): `storage.remove`, then delete the row (files cascade).

`sweeper.ts` runs at boot and every 5 minutes. It deletes transfers whose `expiresAt` has passed, and `uploading` transfers whose `touchedAt` is older than `UPLOAD_TTL_SECONDS`. Expose the selection as a pure, testable query taking `now`.

## Rate limiting

In-memory fixed-window counters in `plugins/rate-limit.ts`, applied with a `rateLimit: "<policy>"` macro. Exceeding a limit throws `RateLimited(retryAfterSeconds)`. One process, so no shared store; counters reset on restart, which is acceptable.

| Policy | Key | Limit | Purpose |
|---|---|---|---|
| `unlock` | client IP + transfer id | 10 per 10 min | password guessing |
| `public` | client IP | 300 per min | link scraping, download abuse |
| `create` | user id | 60 per hour | runaway clients |

Chunk uploads are not rate limited: they are bounded by authentication, declared sizes and quota. `public` and `unlock` are also what make word-based share ids viable.

`clientIp(request, server)` is the only place that decides the client address: the last `X-Forwarded-For` entry when `TRUST_PROXY=true`, otherwise `server.requestIP`. Better Auth's own limiter covers `/api/auth/*` and is enabled outside tests; give it the same address by having the `/auth/*` handlers overwrite an `x-client-ip` header from `clientIp` and setting `advanced.ipAddress.ipAddressHeaders: ["x-client-ip"]`.

## Web app

| Path | Page | Access |
|---|---|---|
| `/` | Send: pick files or a folder, optional title, message, password, expiry; progress with pause and resume; resulting link | user |
| `/login` | one sign-in button | |
| `/transfers` | own transfers: status, size, expiry, downloads, copy link, delete, resume incomplete | user |
| `/t/:id` | download page: password prompt if locked, file tree, per-file and zip download | public |
| `/admin` | limits (global, per role, per user), users, all transfers, stats | admin |

- Routes are defined once in `src/index.tsx` with `createRouter`; link with the typed `paths`. Unauthenticated users on a protected page go to `/login` and back.
- Folders: `<input webkitdirectory>` and drag-and-drop directory entries; `path` is the relative path. The download page renders paths as a tree; the zip recreates the folders.
- Server data: async memos over `api.*` under `<Loading>`; mutations then `refresh`. No client-side store library.
- Downloads are plain `<a href>` links to the API so the browser streams them.
- Styling: CSS modules beside components, tokens as CSS variables in `src/index.css`, `light-dark()` for themes, logical properties (`margin-inline`, not `margin-left`) so RTL locales work. No UI library.

### i18n

- All user-facing text goes through `t("dotted.key", params)` from `src/i18n`. `locales/en.ts` is the source dictionary and defines the `Dict` type.
- Adding a language is adding `locales/<code>.ts` with `export default { … } satisfies Dict`. It is discovered and lazy-loaded automatically, and a missing key fails typecheck.
- The server sends no prose. API errors are shown as `t("errors.<code>")`; `en.ts` must cover every `ErrorCode`.
- Sizes, dates, durations and numbers are formatted with `Intl.*` using `locale()`. Put formatters in `src/i18n/format.ts`.
- Phrase strings so they need no plural forms (`Files: {count}`).

## Testing

`bun test` from the root runs everything. Tests sit beside the code as `*.test.ts`, except server integration tests in `apps/server/test/`.

Write a test only where a mistake is plausible and would matter. Do not test framework behaviour, schema validation, getters, DTO mapping or plain CRUD. Prefer one test that states a rule in its name over several that restate the code.

**Unit tests (most tests).** Pure logic, no app, no network:
- `shared`: `resolveLimits` ✓, `checkTransfer` boundaries, `normalizePath` rejections, `uploadTransfer` against a fake `fetch` (resume from offset, mismatch recovery, retry then give up, abort).
- `server`: storage contract suite run against `local.ts` (append at wrong offset, concurrent appends, `remove` prefix isolation), rate-limit window arithmetic, sweeper selection, `clientIp`.
- `web`: `t` interpolation and locale fallback. No component tests.

**Integration tests (few).** Through `createTestApp().request`, real SQLite in memory and a temp storage directory. One per critical flow:
- First user is admin ✓.
- Create → upload with the real `uploadTransfer` → finalize → download a file and the zip byte-for-byte.
- An interrupted upload resumes and yields identical bytes.
- Limits are enforced at creation for a user with layered overrides; quota frees on delete.
- Password: locked without cookie, wrong password, unlocked after, owner bypass.
- Expired and unfinished transfers are invisible, and swept with their blobs.
- A non-owner cannot append, finalize or delete; an admin can delete.

## Deployment

One image (`Dockerfile`): installs, builds the web app, runs `bun apps/server/src/index.ts`, which serves API and web on `PORT`. Migrations apply at startup. `compose.yaml` mounts `/data/db` and `/data/files` separately; set `DB_DIR` and `FILES_DIR` to host paths on whichever disks you want. TLS and large-body settings belong to the reverse proxy; it must allow request bodies of `CHUNK_BYTES` (16 MiB) and should not buffer responses.

Development: `compose.dev.yaml` provides a mock OIDC provider; `bun run dev` starts the API on 3000 and Vite on 5173 with `/api` proxied, so the browser sees one origin and there is no CORS.

## Build order

Each step ends with `bun run check` passing.

1. ✓ `shared`: `normalizePath`, `checkTransfer`, `uploadTransfer`, with unit tests.
2. `server`: `storage/local.ts` + contract suite; add `storage` to `Context` and the harness.
3. `server`: limits, transfers service and routes, sweeper, rate limiting; replace the placeholder `/me`.
4. `server`: admin routes. Integration tests for steps 2–4.
5. `web`: session bridge and route guard, then Send, Transfers, Download, Admin.
6. Build the image and run the full flow against the mock provider.
