import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

/**
 * The framework-agnostic client on purpose: `better-auth/solid` targets Solid 1. Bridge the
 * `authClient.useSession` nanostore into Solid with `from()`. The admin page manages users through
 * `authClient.admin.*`.
 */
export const authClient = createAuthClient({ plugins: [adminClient()] });

/** Starts the OIDC redirect. The provider id matches `createAuth` on the server. */
export const signIn = (callbackURL = "/") => authClient.signIn.social({ provider: "oidc", callbackURL });
