import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { type Accessor, createContext, createMemo, from } from "solid-js";

/** Framework-agnostic on purpose: `better-auth/solid` targets Solid 1 */
export const authClient = createAuthClient({ plugins: [adminClient()] });

/** A failed sign-in comes back to the login page with `?error=` */
export const signIn = (callbackURL: string) =>
  authClient.signIn.social({ provider: "oidc", callbackURL, errorCallbackURL: "/login" });

type SessionState = ReturnType<typeof authClient.useSession.get>;
export type Session = NonNullable<SessionState["data"]>;

/** `null` when signed out. Pending until the first answer, so read it under `<Loading>` */
export function createSession(): Accessor<Session | null> {
  const state = createMemo(() => from<SessionState>((next) => authClient.useSession.subscribe(next)));
  return createMemo(() => (state().isPending ? new Promise<never>(() => {}) : state().data));
}

export const SessionContext = createContext<Accessor<Session | null>>();
