// ================================================================
// platform-admin-reject-shop
// Rejects a pending shop application: deactivates membership + user.
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

  try {
    const { shop_id, reason } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: "shop_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, owner_id")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deactivate membership and user
    const errors: string[] = [];

    const { error: memberErr } = await adminClient
      .from("shop_memberships")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("shop_id", shop_id);
    if (memberErr) errors.push(`membership: ${memberErr.message}`);

    const { error: userErr } = await adminClient
      .from("users")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", shop.owner_id);
    if (userErr) errors.push(`user: ${userErr.message}`);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Partial failure", details: errors }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "reject_shop",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: { shop_name: shop.name, reason: reason ?? null },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({ message: "Shop rejected successfully", shop_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
