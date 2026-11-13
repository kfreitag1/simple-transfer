# Simple Transfer

Self-hosted file sending. Read `ARCHITECTURE.md` before changing anything: it specifies behaviour and the API. If a change alters behaviour it describes, update it in the same change

## Commands

```sh
bun install
bun run dev          # API on :3000 and Vite on :5173; needs .env (copy .env.example)
bun run check        # lint + typecheck + tests. Must pass before you finish
bun run fix          # apply Biome formatting and safe fixes
bun test <path>      # one file
bun run db:generate  # after editing apps/server/src/db/schema.ts; commit the migration
docker compose -f compose.dev.yaml up -d   # mock OIDC provider for manual sign-in
```

## Stack: exact versions are pinned, and several are pre-releases

Your training data predates these APIs. Read the local docs before writing code against them; do not pattern-match from older versions

| Library | Read first |
|---|---|
| Elysia 2 (rc) | types in `apps/server/node_modules/elysia/dist/*.d.ts`; existing code in `apps/server/src` |
| Solid 2 (rc) | `apps/web/node_modules/solid-js/CHEATSHEET.md` |
| Solid Router 2 (next) | `apps/web/node_modules/@solidjs/router/README.md` |
| Better Auth 1.7 | https://www.better-auth.com/llms.txt |
| Drizzle 0.45 (`bun:sqlite`), TypeBox 1 (`typebox`), Eden 2 (`@elysia/eden`) | package types |

Do not upgrade or add dependencies without being asked. Prefer Bun built-ins (`Bun.file`, `Bun.password`, `bun:sqlite`, `bun:test`)

## Rules

- **One source of truth.** Shapes, limits, error codes and tunables are each defined once (table at the top of `ARCHITECTURE.md`). Import them; never restate a type, a constant or a status code
- **Dependency direction:** `web → shared ← server`. Shared is isomorphic: no Bun, Node or DOM APIs. Web imports only `type App` from server
- **Server:** routes are thin and validate with schemas from `@st/shared/contract`; logic lives in service functions taking `ctx`. State is reached only through `Context`: no module-level singletons, no `Bun.env` outside `env.ts`. Fail by throwing a class from `errors.ts`
- **A new error code** is added in `shared/errors.ts`, `server/errors.ts` and `web/src/i18n/locales/en.ts`; typecheck enforces the last
- **Web:** every user-facing string goes through `t()`; format with `Intl.*`; CSS modules with logical properties. Build pages from `src/ui` and the tokens in `index.css` ("Design system" in `ARCHITECTURE.md`): no literal colours or sizes, no styling of raw form elements in pages, explanations behind `Hinted`
- **Simplicity:** no abstraction with a single use, no speculative options, no new files when an existing one fits. Comments only for what the code cannot say
- **Tests:** follow "Testing" in `ARCHITECTURE.md`. Mostly unit tests of pure logic, a few integration tests of critical flows, nothing for obvious behaviour
- Imports use explicit `.ts`/`.tsx` extensions. IDs come from the schema defaults. Timestamps cross the API as epoch milliseconds

## Pitfalls

Elysia 2
- Route arguments are `(path, hook, handler)`. The 1.x order `(path, handler, hook)` throws at startup
- Macros add context with `derive`; `resolve` and `.error()` are gone. Errors are `HTTPError.id(code, status)` subclasses served as problem JSON; add fields with `extension()` and headers with `headers`
- A method-specific wildcard beats an `.all()` wildcard even with a shorter prefix. That is why `/api/auth/*` is registered with `.get` and `.post`, and why the API ends in a `.get("/*")` that throws `NotFound`
- For a raw body use `{ parse: "none" }` and read `request.body`
- Returning a `Blob` (`Bun.file`) gives `Range` support for free
- Schemas come from `typebox` (`Type.*`) so shared stays free of Elysia

Solid 2
- DOM APIs and JSX types come from `@solidjs/web`. `solid-js/web` and `solid-js/store` no longer exist
- `createEffect` takes `(compute, apply)`. Setters apply after a flush. Async is a memo returning a promise, read under `<Loading>`. Never destructure props
- The router is `createRouter({ routes })`, rendered as a component; there is no `<Route>` JSX
- A keyed `<Show>` needs a child function that takes a parameter; a memo passed to `refresh()` through context is typed `SourceAccessor`, not `Accessor`
- `better-auth/solid` is for Solid 1. Use `better-auth/client` and bridge `authClient.useSession` with `from()`

Better Auth
- The OIDC provider is a social provider: sign in with `signIn.social({ provider: "oidc" })`; callback path `/api/auth/callback/oidc`
- The auth tables in `schema.ts` are dictated by Better Auth. Do not rename their columns
- Tests never use OIDC: `createTestApp().signIn()` creates a user and returns session headers

Bun
- Workspaces use isolated installs: a package can import only its own declared dependencies, and root `node_modules` holds only tooling
- `await Bun.write(path, response)` with a streaming `Response` hung once here; buffer or pipe explicitly
- `Bun.serve` drops `Content-Length` on streamed responses (oven-sh/bun#10507), so the app runs on `node:http` through `src/serve.ts`. Do not switch back to `.listen()`
- In `bun --filter` scripts the working directory is the package. `env.ts` resolves relative paths against the repository root for that reason
