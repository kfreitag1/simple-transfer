import { treaty } from "@elysia/eden";
import type { App } from "@st/server";
import type { Config } from "@st/shared/contract";
import { ApiError, ERROR_STATUS, type ErrorCode, type Problem } from "@st/shared/errors";
import { createContext, type SourceAccessor } from "solid-js";

/** Instance settings, loaded once by Layout. `refresh` it after changing them */
export const ConfigContext = createContext<SourceAccessor<Config>>();

/** Typed client for every route except chunk upload, which goes through `uploadTransfer` in @st/shared/upload */
export const api = treaty<App>(location.origin).api;

export async function unwrap<T>(
  request: Promise<{ data: T; error: null } | { data: null; error: { value: unknown } }>,
) {
  const { data, error } = await request;
  if (error) throw new ApiError(error.value as Problem);
  return data as T;
}

export function errorCode(error: unknown): ErrorCode {
  if (typeof error === "string" && error in ERROR_STATUS) return error as ErrorCode;
  return error instanceof ApiError && error.problem.code in ERROR_STATUS ? error.problem.code : "internal-server-error";
}

/** A stale unlock cookie means "unlock again" */
export const isLocked = (error: unknown) => ["password-required", "invalid-cookie"].includes(errorCode(error));

export const shareUrl = (id: string) => `${location.origin}/${encodeURIComponent(id)}`;
