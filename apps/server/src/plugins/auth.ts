import { Elysia } from "elysia";
import type { Auth } from "../auth.ts";
import { Forbidden, Unauthorized } from "../errors.ts";

export const authPlugin = (auth: Auth) => {
  const sessionUser = async (request: Request) => (await auth.api.getSession({ headers: request.headers }))?.user;
  const requireUser = async (request: Request) => {
    const user = await sessionUser(request);
    if (!user) throw new Unauthorized();
    return user;
  };

  return new Elysia({ name: "auth" }).macro({
    viewer: { derive: async ({ request }) => ({ viewer: await sessionUser(request) }) },
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
