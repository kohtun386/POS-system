// ================================================================
// platform-admin-toggle-user-active
// Activates or deactivates a user's membership in a specific shop.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // @deprecated Per VISION.md §4.4, platform_admin cannot manage staff.
  // This function is disabled. All staff management must happen shop-side by shop admins.
  return new Response(
    JSON.stringify({ error: "Platform Admin cannot manage staff per VISION.md §4.4. This function is deprecated." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

  try {
    const { membership_id, user_id, shop_id, is_active } = await req.json();

    // Validate inputs
    if (!membership_id || !user_id || !shop_id || is_active === undefined) {
      return new Response(
        JSON.stringify({ error: "membership_id, user_id, shop_id, and is_active are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof is_active !== "boolean") {
      return new Response(
        JSON.stringify({ error: "is_active must be a boolean" }),
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

    const previousActive = membership.is_active;

    // Skip if no change
    if (previousActive === is_active) {
      return new Response(
        JSON.stringify({ message: "Status unchanged", membership_id, is_active }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update is_active
    const { error: updateError } = await adminClient
      .from("shop_memberships")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", membership_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update status: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Audit trail
    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: is_active ? "activate_user" : "deactivate_user",
      targetType: "shop_membership",
      targetId: membership_id,
      shopId: shop_id,
      details: {
        user_id,
        previous_active: previousActive,
        new_active: is_active,
        role: membership.role,
      },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({
        message: is_active ? "User activated" : "User deactivated",
        membership_id,
        user_id,
        shop_id,
        is_active,
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
