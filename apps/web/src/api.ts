import { treaty } from "@elysia/eden";
import type { App } from "@st/server";

/** Typed client for every route except chunk upload, which goes through `uploadTransfer` in @st/shared/upload. */
export const api = treaty<App>(location.origin).api;
