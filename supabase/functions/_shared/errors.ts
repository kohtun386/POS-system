// ================================================================
// _shared/errors.ts
// Client-safe error shaping for Edge Functions.
// Full error is logged server-side (retrievable via Supabase logs);
// clients only ever see a generic message + a reference id.
// ================================================================

/**
 * Log the full error server-side and return a generic, non-leaking
 * client-safe shape. refId ties the client message to server logs.
 * Accepts a single error or an array (multi-step partial failures).
 */
export function sanitizeDbError(
  error: unknown,
  refId?: string,
): { message: string; code?: string } {
  const errors = Array.isArray(error) ? error : [error];
  const ref = refId ?? crypto.randomUUID();

  for (const e of errors) {
    const msg = (e as { message?: string })?.message ?? String(e);
    console.error(`[sanitizeDbError ref=${ref}] ${msg}`, e);
  }

  const code = (errors[0] as { code?: string })?.code;
  return {
    message: `Operation failed. Reference: ${ref}`,
    ...(code ? { code } : {}),
  };
}
