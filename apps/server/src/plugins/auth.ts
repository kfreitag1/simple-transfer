import { Elysia } from "elysia";
import type { Auth } from "../auth.ts";
import { Forbidden, Unauthorized } from "../errors.ts";

/**
 * Route macros. `{ auth: true }` requires a session and adds `user` to the context;
 * `{ admin: true }` additionally requires the admin role.
 */
export const authPlugin = (auth: Auth) => {
  const requireUser = async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Unauthorized();
    return session.user;
  };
  return new Elysia({ name: "auth" }).macro({
    auth: { derive: async ({ request }) => ({ user: await requireUser(request) }) },
    admin: {
      derive: async ({ request }) => {
        const user = await requireUser(request);
        if (user.role !== "admin") throw new Forbidden();
        return { user };
      },
    },
  });
};
