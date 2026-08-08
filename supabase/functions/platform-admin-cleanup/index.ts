// ================================================================
// platform-admin-cleanup Edge Function
// Deletes transient E2E onboarding/reject test data (dry‑run supported).
// Auth: verifyPlatformAdmin + service_role client.
// After a successful destructive run, removes matching auth.users via
// the admin client (non‑fatal on failure). Mirrors platform‑admin‑delete‑shop
// and -reject‑shop patterns, but scoped to onboarding test data only.
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp } from "../_shared/audit.ts"; // extractIp helper is in audit.ts

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  const corsHeaders = getCorsHeaders(req);
  if (corsResponse) return corsResponse;

  try {
    const { dry_run = true } = await req.json(); // default to safe dry‑run

    // -------------------------------------------------------------------
    // 1️⃣ Verify caller is platform_admin (both JWT check and role guard)
    // -------------------------------------------------------------------
    const caller = await verifyPlatformAdmin(req, corsHeaders);
    const adminClient = createAdminClient();
    const ipAddress = extractIp(req);

    // -------------------------------------------------------------------
    // 2️⃣ Call the RPC cleanup_test_data
    // -------------------------------------------------------------------
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "cleanup_test_data",
      { p_dry_run: dry_run, p_approver_id: caller.userId },
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message, dry_run, success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------------------------------------------------------------------
    // 3️⃣ If we performed a destructive run, delete matching auth.users.
    // -------------------------------------------------------------------
    let authUsersDeleted = 0;
    if (!dry_run && rpcResult?.success) {
      // List auth users that match the onboarding test email pattern.
      // adminClient.auth.admin.listUsers works with the service_role key.
      const { data: authList, error: authListError } = await adminClient.auth.admin.listUsers();
      if (!authListError && Array.isArray(authList?.users)) {
        const testPattern = /^(onboarding-|reject-).*@coffeeshop\.local$/;
        for (const u of authList.users) {
          if (u.email && testPattern.test(u.email) && !/@test\.local$/.test(u.email)) {
            // Exclude seed fixture emails (tier accounts) – they end with @test.local.
            try {
              await adminClient.auth.admin.deleteUser(u.id);
              authUsersDeleted++;
            } catch (e) {
              // Non‑fatal – log but continue.
              console.warn("Failed to delete auth user", u.id, e);
            }
          }
        }
      } else if (authListError) {
        console.warn("Failed to list auth users for cleanup", authListError);
      }
    }

    // -------------------------------------------------------------------
    // 4️⃣ Record an audit entry (only on successful RPC completion).
    // -------------------------------------------------------------------
    await adminClient.from("audit_logs").insert({
      actor_id: caller.userId,
      action: "cleanup_test_data",
      target_type: "system",
      details: {
        dry_run,
        rpc_counts: rpcResult?.deleted_counts ?? {},
        auth_users_deleted: authUsersDeleted,
      },
      ip_address: ipAddress,
    });

    // -------------------------------------------------------------------
    // 5️⃣ Return the combined result.
    // -------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        rpc_result: rpcResult,
        auth_users_deleted: authUsersDeleted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Unhandled error in platform-admin-cleanup", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", dry_run: true, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
