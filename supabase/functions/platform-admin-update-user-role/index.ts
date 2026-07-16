// ================================================================
// platform-admin-update-user-role
// Changes a user's role within a specific shop.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

const VALID_ROLES = ["admin", "manager", "cashier"];

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { membership_id, user_id, shop_id, role } = await req.json();

    // Validate inputs
    if (!membership_id || !user_id || !shop_id || !role) {
      return new Response(
        JSON.stringify({ error: "membership_id, user_id, shop_id, and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    // Verify membership exists and matches
    const { data: membership, error: memError } = await adminClient
      .from("shop_memberships")
      .select("id, user_id, shop_id, role, is_active")
      .eq("id", membership_id)
      .eq("user_id", user_id)
      .eq("shop_id", shop_id)
      .single();

    if (memError || !membership) {
      return new Response(
        JSON.stringify({ error: "Membership not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const previousRole = membership.role;

    // Skip if no change
    if (previousRole === role) {
      return new Response(
        JSON.stringify({ message: "Role unchanged", membership_id, role }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update role
    const { error: updateError } = await adminClient
      .from("shop_memberships")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", membership_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update role: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Audit trail
    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "update_user_role",
      targetType: "shop_membership",
      targetId: membership_id,
      shopId: shop_id,
      details: { user_id, previous_role: previousRole, new_role: role },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({
        message: "Role updated successfully",
        membership_id,
        user_id,
        shop_id,
        previousRole,
        newRole: role,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error:", msg, err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
