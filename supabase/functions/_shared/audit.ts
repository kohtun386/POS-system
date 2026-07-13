import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  shopId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Insert an audit log entry using the service_role client.
 * Called after every platform admin action.
 */
export async function recordAudit(
  supabaseAdmin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    shop_id: entry.shopId ?? null,
    details: entry.details ?? {},
    ip_address: entry.ipAddress ?? null,
  });

  if (error) {
    console.error("Failed to record audit log:", error.message);
    // Don't throw — the primary action already succeeded.
    // Audit failure is logged but does not roll back the action.
  }
}

/** Extract caller IP from request headers. */
export function extractIp(req: Request): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
}
