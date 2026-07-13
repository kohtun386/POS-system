// ================================================================
// platform-admin-update-subscription
// Changes a shop's subscription_tier. Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

const DAILY_ORDER_LIMITS: Record<string, number> = { free: 50, growth: 0, pro: 0 };

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { shop_id, tier, is_active } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: "shop_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate tier if provided
    if (tier !== undefined && !["free", "growth", "pro"].includes(tier)) {
      return new Response(
        JSON.stringify({ error: "tier must be one of: free, growth, pro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, subscription_tier, is_active")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Apply tier change if provided
    if (tier !== undefined) {
      updateData.subscription_tier = tier;
      const limit = DAILY_ORDER_LIMITS[tier];
      if (limit !== undefined) {
        updateData.daily_order_limit = limit;
      }
    }

    // Apply is_active toggle if provided
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { error: updateErr } = await adminClient
      .from("shops")
      .update(updateData)
      .eq("id", shop_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: `Failed to update subscription: ${updateErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "update_subscription",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: { shop_name: shop.name, previous_tier: shop.subscription_tier, new_tier: tier },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({ message: "Subscription updated successfully", shop_id, tier }),
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
