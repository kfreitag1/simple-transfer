# Architecture

Self-hosted file sending. A signed-in user uploads files and gets a link; anyone with the link downloads until it expires. Single process, single container, SQLite plus a blob directory

| Shape | Defined in |
|---|---|
| Request/response DTOs, `transferPath` | `packages/shared/src/contract.ts` |
| Limits, defaults, override resolution | `packages/shared/src/limits.ts` |
| Error codes and statuses | `packages/shared/src/errors.ts` |
| Tunables with observable effect (chunk size, upload concurrency, TTLs, max lengths, roles). Internal timings (retry backoff, sweep and update intervals) stay beside their only use | `packages/shared/src/constants.ts` |
| Path validation | `packages/shared/src/paths.ts` |
| Share ids and their word lists | `packages/shared/src/share-id.ts`, `words.ts` |
| Tables | `apps/server/src/db/schema.ts` |
| Storage port | `apps/server/src/storage/storage.ts` |
| Configuration | `apps/server/src/env.ts`, `.env.example` |
| Version and release notes | `package.json`, `CHANGELOG.md` |

## Layout

```
packages/shared   @st/shared  Isomorphic, no I/O except `fetch` in upload.ts. Imported as @st/shared/<file>
apps/server       @st/server  Elysia API, Better Auth, Drizzle on bun:sqlite, storage, sweeper. Serves the built web app
apps/web          @st/web     Solid SPA (Vite). Talks to the API through Eden (`src/api.ts`) and `uploadTransfer`
```

Web imports only the `App` *type* from server. Shared never imports from apps

Routes are thin: validate with contract schemas, call a service function taking `(ctx, …)`, return a DTO. Services throw the error classes in `errors.ts`. `Context` holds `storage: Storage`; tests give it a temp directory

## Auth

- Better Auth, OIDC only, one provider with id `oidc` (`genericOAuth`). Redirect URI: `${BASE_URL}/api/auth/callback/oidc`. The client starts it with `signIn()` in `apps/web/src/auth.ts`
- Every user authed at the IdP is provisioned. The first user ever created gets role `admin`, all others `user` (`databaseHooks` in `auth.ts`), from the better auth admin plugin
- User administration (list, set role, ban) uses the admin plugin's own endpoints through `authClient.admin.*`. There are no custom user routes. Users are banned, not deleted: `transfer.owner_id` is `ON DELETE RESTRICT` so blobs cannot be orphaned
- Route protection: `{ auth: true }` / `{ admin: true }` macros (`plugins/auth.ts`). Routes that are public but owner-aware use `{ viewer: true }`, which adds the session user if there is one

## Limits

`Limits` has four values, `null` meaning unlimited: `maxTransferBytes`, `quotaBytes`, `maxExpirySeconds`, `defaultExpirySeconds`. "Never expires" is simply `maxExpirySeconds: null`

The built-in `DEFAULT_LIMITS` are all `null`: until an admin sets limits there is no size limit, no quota, and transfers never expire. An admin sets **global limits** for everyone, and **overrides** for a role or a single user. All are rows of `limit_override` (`scope` `global`, `role` or `user`), each a partial object where an absent key inherits and `null` sets unlimited. Effective limits are `resolveLimits(global, role, user)`; `limitsFor(user)` loads the three rows that apply. The default expiry is clamped to the max expiry. Changing limits never affects existing transfers

`usedBytes(userId)` is `SUM(transfer.size)` over the user's existing transfers in either status: quota is reserved at creation and released on deletion or expiry

`checkTransfer(input, me)` in `shared/limits.ts` is shared by both sides: the web app calls it before submitting; the server calls it as the authority. It returns the first failure of: total size over `maxTransferBytes` → `transfer-too-large`; `usedBytes + total` over `quotaBytes` → `quota-exceeded`; `expiresIn` over `maxExpirySeconds`, or `null` when the max is not `null` → `expiry-too-long`

## Instance settings

An admin can give the instance a name, an accent colour and a logo (`Branding` in the contract); each is `null` until set, which keeps the built-in look. The same row (`settings`, one row with id 1) holds `updateCheck`. Both are written whole by `PUT /admin/settings` — a partial write would reset what it left out — and read by everyone through `GET /config`, the admin UI included

The logo is stored and served as a data URL (at most `MAX_LOGO_BYTES` of image), so it needs no route, no cache rules and no blob, and an SVG cannot run script because it is only ever an `<img>` source. The web app applies branding in `Layout.tsx`: document title, favicon, and the `--brand` CSS variable from which `index.css` derives the accent for both themes

## Version and updates

The version lives in the root `package.json` and nowhere else. `CHANGELOG.md` (Keep a Changelog, Semantic Versioning) is written by hand per release; both files ship inside the image

- `GET /admin/releases` (admin only: only admins need to know) returns the running version, the release notes parsed out of `CHANGELOG.md` (`src/changelog.ts`), and `update`, the newer release when one is known and the check is on
- `src/updates.ts` asks GitHub for the latest release a few times a day (`AbortSignal.timeout`, failures silent), compares it with the running version using `Bun.semver.order`, and keeps the answer in memory. Nothing but the request leaves the instance: no identifier, no usage. `updateCheck` in the settings row turns it off
- The admin panel has a Releases tab listing every release newest first, the running version, and a link to the newer release; a dot on the tab label says one is waiting, and the same tab holds the `updateCheck` toggle. Nothing about releases appears anywhere else in the app

**Cutting a release:** add the entries under a new `## [x.y.z]` heading in `CHANGELOG.md`, set the same version in `package.json`, commit, then tag `vx.y.z` and push the tag. The release workflow publishes the image and a GitHub release from that section; the image reports the version it was built with

## API

All under `/api`. JSON unless noted. Errors are RFC 9457 problem documents with a `code` from `ERROR_STATUS`; on the client they become `ApiError` (`shared/errors.ts`). No pagination

| Method and path | Access | Body → response |
|---|---|---|
| `GET /config` | anyone | → `Config` |
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
| `GET /admin/limits` | admin | → `LimitOverride[]`, the global row included |
| `PUT /admin/limits` | admin | `LimitOverride` → 204; empty `values` deletes the row |
| `GET /admin/stats` | admin | → `AdminStats` |
| `GET /admin/releases` | admin | → `Releases`: the running version, the release notes from `CHANGELOG.md`, and a newer release if known |
| `PUT /admin/settings` | admin | `Settings` → 204; replaces all of it |
| `GET,POST /auth/*` | | Better Auth |

**View access**, one function used by the three `view` routes, evaluated in order:
1. No such transfer, or `expiresAt` has passed (do not wait for the sweeper) → `not-found`
2. Requester is the owner or an admin → allowed
3. Status is `uploading` → `not-found`
4. Transfer has a password and the request has no valid unlock cookie → `password-required`

Owner-only routes answer `not-found`, not `forbidden`, to anyone else. `Transfer.owned` tells the requester whether they own it, which is what lets the web app offer the upload, the link and the download count to owners only

**Unlock.** Verify with `Bun.password.verify`; failure is `password-invalid`. Success sets Elysia's signed cookie `unlock` (app config `cookie: { secrets: env.authSecret, sign: ["unlock"] }`): value the transfer id, `Path=transferPath(id)` (the prefix of every route of that transfer), `Max-Age=UNLOCK_TTL_SECONDS`, `HttpOnly`, `SameSite=Lax`, `Secure` when `BASE_URL` is https. A cookie with a bad signature makes Elysia answer `invalid-cookie`, which the client treats as `password-required`

**Create.** Normalize every path with `normalizePath` (`shared/paths.ts`, used by client and server): split on `/`, reject empty, `.` and `..` segments, backslashes, control characters, a leading `/`, and lengths over `MAX_PATH_LENGTH`. An invalid or duplicate path → `invalid-path`. Then `checkTransfer`. Insert the transfer and its files in one synchronous transaction that also reads `usedBytes`, so concurrent creates cannot exceed quota. `expiresAt` is fixed here: `now + (expiresIn ?? defaultExpirySeconds)`, or null

The primary key is a share id from the schema default. The insert uses `ON CONFLICT DO NOTHING`, so a taken id inserts nothing and is retried with a fresh one inside the same transaction (3 attempts, then a 500)

## Upload protocol

1. `POST /transfers` declares every file's path and size. The response carries file ids and `offset: 0`
2. For each file, `PATCH …/files/:fileId?offset=N` with `Content-Type: application/octet-stream` and the next `CHUNK_BYTES` (less for the final chunk). The server appends and answers `{ offset }`
3. `POST …/finalize` checks `storage.size` equals the declared size for every file, else `upload-incomplete`, then sets `ready`. Idempotent

Server rules for PATCH (route uses `parse: "none"` and streams `request.body`, never buffering a chunk):
- Transfer not `uploading` → `transfer-finalized`
- Offset differs from the stored size → `offset-mismatch` with the true `offset` (thrown by the storage adapter)
- Cap the stream at `min(CHUNK_BYTES, file.size − offset)`; exceeding it → `chunk-too-large`
- Update `touchedAt`
- `serve` rejects any request body slightly over `CHUNK_BYTES` (`maxBodyBytes`)

Offsets live only in storage. `Transfer.files[].offset` is `storage.size` while uploading and `size` once ready. Zero-byte files need no PATCH and have no blob; download and zip code must not call `storage.read` for them

`uploadTransfer` (`shared/upload.ts`) is the only uploader:
- Skips complete files; runs `UPLOAD_CONCURRENCY` files in parallel, chunks of a file in sequence
- `offset-mismatch` → continue from the returned offset
- Network error, 5xx or 429 → retry the chunk with exponential backoff (1 s doubling to 30 s); reject after 5 consecutive failures. Any other 4xx rejects immediately
- Abort signal → reject; nothing else to clean up
- Resume in every case (failure, reload) is `GET /transfers/:id` then `uploadTransfer` again with the same blobs. After a reload the user re-selects the files; the web app matches them to the transfer by path and size

## Downloads

- File: return `storage.read(key)` so Elysia serves `Range`. Headers: `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename*=UTF-8''<encoded basename>`, `X-Content-Type-Options: nosniff`. User content is never served inline
- Zip: `client-zip` `downloadZip` over `storage.read(key)` per file, stored uncompressed, entry names are the file paths, `Content-Length` from `predictLength`. Streams with constant memory and supports Zip64. Name: `<title or "transfer">.zip`
- Every download carries `Content-Length`, so browsers show progress (see "HTTP edge")
- `downloads` increments once per zip request and once per file request that has no `Range` header

## Storage

The `Storage` port has four methods and no knowledge of transfers. Keys are `<transferId>/<fileId>`; deleting a transfer is `remove("<transferId>/")`

`local.ts`: files under `STORAGE_DIR/<key>`, appended in place (no temp files or renames, so nothing depends on other filesystems). It serializes `append` per key with an in-process lock, because check-then-append would otherwise race

The database and the blobs are configured independently (`DB_PATH`, `STORAGE_DIR`) and may be on different disks. Consistency between them is kept by one rule: **delete blobs first, then the row**. A crash in between leaves a row whose deletion is retried; a blob never exists without a row

## Lifecycle

`deleteTransfer(ctx, id)` is the single deletion path (owner, admin, sweeper): `storage.remove`, then delete the row (files cascade)

`sweeper.ts` runs at boot and every 5 minutes. It deletes transfers whose `expiresAt` has passed, and `uploading` transfers whose `touchedAt` is older than `UPLOAD_TTL_SECONDS`

## Rate limiting

In-memory fixed-window counters in `plugins/rate-limit.ts`, applied with a `rateLimit: "<policy>"` macro. Exceeding a limit throws `RateLimited(retryAfterSeconds)`. One process, so no shared store; counters reset on restart, which is acceptable

| Policy | Key | Limit | Purpose |
|---|---|---|---|
| `unlock` | client IP + transfer id | 10 per 10 min | password guessing |
| `public` | client IP | 300 per min | link scraping, download abuse |
| `create` | user id | 60 per hour | runaway clients |

Chunk uploads are not rate limited: they are bounded by authentication, declared sizes and quota. `public` and `unlock` are also what make word-based share ids viable

`clientIp` in `serve.ts` is the only place that decides the client address: the last `X-Forwarded-For` entry when `TRUST_PROXY=true`, otherwise the socket peer. `serve` writes it into the `x-client-ip` header (`CLIENT_IP_HEADER`) of every request, replacing whatever the client sent; the rate limiter reads that header, and so does Better Auth's own limiter (`advanced.ipAddress.ipAddressHeaders`), which covers `/api/auth/*` and is enabled outside tests

## HTTP edge

`Bun.serve` replaces a `Content-Length` on any streamed response with chunked encoding (oven-sh/bun#10507), so the zip would download without a total. `serve.ts` therefore serves the Elysia app over Bun's `node:http`, which sends the headers it is given. It bridges `IncomingMessage` to a `Request` and pipes the `Response` back, streaming both ways. Three duties `Bun.serve` used to perform are now explicit:
- `blobLength` (registered first in `createApp`, `global` scope so it also covers the web app) sets `Content-Length` on a non-Range `Blob` response. Elysia sets it for Range responses
- `serve` never writes more than the declared `Content-Length`: Bun streams a sliced file `Blob` (a Range response) to the end of the file, which would corrupt keep-alive connections
- `serve` caps request bodies (`maxBodyBytes`)

When the Bun issue is fixed, `serve.ts` can go back to `Bun.serve` and lose these three

## Web app

| Path | Page | Access |
|---|---|---|
| `/` | Send: drop or pick files and folders (the whole window is a drop target; pasted files are accepted), then title, message, and password and expiry under "Options". Submitting creates the transfer, starts its upload and opens `/:id` | user |
| `/login` | one sign-in button, labelled with `OIDC_PROVIDER_NAME` when set (from `GET /config`) | |
| `/transfers` | own transfers: files, size, downloads, expiry, copy link, delete. Every row opens the transfer | user |
| `/:id` | the transfer page, at the root: three hyphenated words cannot collide with a page of the app's own. Ready: password prompt if locked, file tree, per-file download and everything as a zip (a lone file downloads as itself); the owner also gets the link, and the download count. Still uploading: the owner's upload — its progress if this browser is running it, otherwise the files that still need choosing. Signed-out visitors see the brand and nothing else of the app | public |
| `/admin` | stats, and one tab each (`?tab=`) for users, all transfers, limits (global and overrides per role and per user), instance settings and releases | admin |

- Routes are defined once in `src/index.tsx` with `createRouter`. Unauthenticated users on a protected page go to `/login` and back
- Folders: `<input webkitdirectory>` and drag-and-drop directory entries; `path` is the relative path. The download page renders paths as a tree; the zip recreates the folders
- **One page per transfer, and uploads outlive it.** `/:id` is the transfer's page in every state, so nothing has a second address. Every upload lives in `src/uploads.ts`, created in `Layout` above the routes, so changing pages never interrupts one and the chosen blobs stay in memory for resume. The page shows the live upload when this browser has it, and otherwise the server's copy: for an incomplete transfer that is the files which still lack bytes (finished ones are never asked for again), how many of them are matched, and a "Resume" that stays disabled until all of them have been added, matched by path and size. Uploads are keyed by id, so several can run at once and each page shows only its own. `UploadIndicator` lists every upload still in flight, one row each, on any page; a row opens that transfer's page. An interrupted one offers Resume (the blobs are still in memory), deleting a transfer aborts and drops its upload, and one that finishes while the user is elsewhere says so in a toast
- Server data: async memos over `api.*` under `<Loading>`; mutations then `refresh`. No client-side store library
- Downloads are plain `<a href>` links to the API so the browser streams them

### Design system

Bespoke and small; no UI library. The aim is an interface that goes unnoticed: neutral colours, one accent, system fonts, and explanation kept behind `Hinted` or a tooltip rather than printed on the page

- **Tokens** are CSS variables in `src/index.css`: colour, space, type, radius, shadow, motion. Nothing else contains a literal colour, size or duration. Themes use `light-dark()`; the user's choice of system, light or dark (`src/theme.ts`, in the account menu) sets `color-scheme` through `data-theme` on the root. The accent derives from `--brand` (see "Instance settings") with its lightness clamped per theme
- **`src/ui/`** holds the generic controls, each with its CSS module, knowing nothing of transfers: `Icon`, `Button` / `LinkButton` / `IconButton`, `Input` / `Textarea` / `Select` / `Segmented` / `Field`, `Tooltip` / `Hinted`, `Dialog` with `confirmAction` and `toast` (`overlays.tsx`), and `Panel` / `Page` / `Empty` (`surfaces.tsx`). Pages compose these and do not style raw form elements themselves
- **`src/components.tsx`** holds what is specific to this app and shared by pages
- **Two layouts:** `Panel`, a narrow card for one focused task (login, send, download), and `Page`, a wide one for lists and settings. A flow renders a new `Panel` per step, which gives the step transition
- **Icons** are Iconoir SVGs imported individually into the registry in `ui/Icon.tsx`, so only the ones used are bundled. Counts are shown as an icon and a number (`Stat`), which is also why they need no plural forms
- **Platform first:** popovers and CSS anchor positioning for tooltips and the menu, `<dialog>` for modals, `<details>` for disclosure, `@starting-style` for entry transitions. The build target is `esnext`; there are no fallbacks for older browsers
- **Feedback:** failures of a form appear in the form (`ErrorText`); results and failures of one-off actions are toasts; destructive actions ask first through `confirmAction`
- Logical properties throughout (`margin-inline`, not `margin-left`) so RTL locales work

### i18n

- All user-facing text goes through `t("dotted.key", params)` from `src/i18n`. `locales/en.ts` is the source dictionary and defines the `Dict` type
- Adding a language is adding `locales/<code>.ts` with `export default { … } satisfies Dict`. It is discovered and lazy-loaded automatically, and a missing key fails typecheck
- The locale is a stored choice (`setLocale`), else the first of `navigator.languages` that is supported, else `en` (`pickLocale`). Nothing calls `setLocale` yet: a picker over `LOCALES` comes with the second language
- The server sends no prose. API errors are shown as `t("errors.<code>")`; `en.ts` must cover every `ErrorCode`
- Sizes, dates, durations and numbers are formatted with `Intl.*` using `locale()`. Put formatters in `src/i18n/format.ts`
- Phrase strings so they need no plural forms: show a count as a `Stat`, or as `Files: {count}`

## Testing

`bun test` from the root runs everything. Tests sit beside the code as `*.test.ts`, except server integration tests in `apps/server/test/`

Write a test only where a mistake is plausible and would matter. Do not test framework behaviour, schema validation, getters, DTO mapping or plain CRUD. Prefer one test that states a rule in its name over several that restate the code

**Unit tests (most tests).** Pure logic, no app, no network:
- `shared`: `resolveLimits`, `checkTransfer` boundaries, `normalizePath` rejections, `uploadTransfer` against a fake `fetch` (resume from offset, mismatch recovery, retry then give up, abort)
- `server`: storage contract suite run against `local.ts` (append at wrong offset, concurrent appends, `remove` prefix isolation), rate-limit window arithmetic, sweeper selection, `*_FILE` variables in `loadEnv`, `clientIp`, and `serve` over real HTTP (streamed `Content-Length`, body cap, client address not spoofable)
- `web`: `t` interpolation and locale fallback. No component tests

**Integration tests (few).** Through `createTestApp().request`, real SQLite in memory and a temp storage directory. One per critical flow:
- First user is admin
- Create → upload with the real `uploadTransfer` → finalize → download a file, a range and the zip byte-for-byte over real HTTP (`listen()` in the harness), each with `Content-Length`
- An interrupted upload resumes and yields identical bytes
- Limits are enforced at creation for a user with global limits and role and user overrides; quota frees on delete
- Password: locked without cookie, wrong password, unlocked after, owner bypass
- Expired and unfinished transfers are invisible, and swept with their blobs
- A non-owner cannot append, finalize or delete; an admin can delete

## Deployment

One image (`Dockerfile`): installs, builds the web app, runs `bun apps/server/src/index.ts`, which serves API and web on `PORT`, and answers a `HEALTHCHECK` on `/api/health`

Images are published to `ghcr.io/kfreitag1/simple-transfer` for `linux/amd64` and `linux/arm64`, so `compose.yaml` pulls rather than builds (it has a commented `build:` for running from a checkout). CI and the release pipeline are GitHub Actions and need no secrets: GHCR uses `GITHUB_TOKEN`

- `ci.yml` runs on every pull request and push to `main`: `bun run check` (lint, typecheck, tests), `bun run build`, and a Docker build with layer caching. Nothing is pushed
- `release.yml` runs on a `v*` tag. It refuses a tag that does not match `package.json`, then pushes the image tagged `X.Y.Z`, `X.Y` and — for a final release — `latest`, and afterwards publishes a GitHub release whose notes are that version's `CHANGELOG.md` section (a version without notes fails the job). Pre-release tags (with a `-`) skip `latest` and are marked as pre-releases
- The runtime is pinned once, in the Dockerfile's `ARG BUN_VERSION`; CI reads that value rather than keeping a copy, so the checks run on the Bun the image ships. Migrations apply at startup. `compose.yaml` mounts `/data/db` and `/data/files` separately; set `DB_DIR` and `FILES_DIR` to host paths on whichever disks you want. Any variable can be supplied as `<NAME>_FILE`, a path whose contents are the value (for Docker secrets such as `OIDC_CLIENT_SECRET_FILE`); setting both is an error. TLS and large-body settings belong to the reverse proxy; it must allow request bodies of `CHUNK_BYTES` and should not buffer responses

Development: `compose.dev.yaml` provides a mock OIDC provider; `bun run dev` starts the API on 3000 and Vite on 5173 with `/api` proxied, so the browser sees one origin and there is no CORS
