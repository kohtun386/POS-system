// ================================================================
// platform-admin-approve-shop
// Activates a pending shop: sets shop.is_active, membership.is_active,
// and user.active to true. Only callable by platform_admin.
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
    const { shop_id } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: "shop_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Verify caller is platform_admin
    const caller = await verifyPlatformAdmin(req);

    // 2. Perform mutations with service_role (bypasses RLS)
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, is_active, owner_id")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (shop.is_active) {
      return new Response(
        JSON.stringify({ error: "Shop is already active" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: membership, error: membershipError } = await adminClient
      .from("shop_memberships")
      .select("id, user_id, is_active")
      .eq("shop_id", shop_id)
      .eq("role", "admin")
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: "No pending membership found for this shop" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const errors: string[] = [];

    const { error: shopUpdateErr } = await adminClient
      .from("shops")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", shop_id);
    if (shopUpdateErr) errors.push(`shop: ${shopUpdateErr.message}`);

    const { error: memberUpdateErr } = await adminClient
      .from("shop_memberships")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", membership.id);
    if (memberUpdateErr) errors.push(`membership: ${memberUpdateErr.message}`);

    const { error: userUpdateErr } = await adminClient
      .from("users")
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq("id", membership.user_id);
    if (userUpdateErr) errors.push(`user: ${userUpdateErr.message}`);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Partial failure", details: errors }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Record audit log
    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "approve_shop",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: { shop_name: shop.name, owner_id: membership.user_id },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({ message: "Shop approved successfully", shop_id, shop_name: shop.name }),
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
