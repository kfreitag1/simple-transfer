import type { ErrorCode } from "@st/shared/errors";

/** Source dictionary: its shape is the `Dict` type every other locale must satisfy. */
export default {
  app: { name: "Simple Transfer" },
  errors: {
    unauthorized: "Please sign in.",
    forbidden: "You are not allowed to do that.",
    "password-required": "This transfer is password protected.",
    "password-invalid": "Wrong password.",
    "transfer-too-large": "This transfer exceeds your size limit.",
    "quota-exceeded": "You have run out of storage. Delete a transfer or wait for one to expire.",
    "expiry-too-long": "The expiry is longer than allowed.",
    "invalid-path": "A file has an invalid or duplicate path.",
    "offset-mismatch": "The upload fell out of sync. Resume to continue.",
    "chunk-too-large": "The upload was rejected. Resume to continue.",
    "upload-incomplete": "Some files have not finished uploading.",
    "transfer-finalized": "This transfer has already been sent.",
    "rate-limited": "Too many attempts. Try again in a moment.",
    "not-found": "This transfer does not exist or has expired.",
    validation: "Something in the form is not valid.",
    parse: "Something went wrong. Please try again.",
    "invalid-cookie": "This transfer is password protected.",
    "internal-server-error": "Something went wrong. Please try again.",
  } satisfies Record<ErrorCode, string>,
};
