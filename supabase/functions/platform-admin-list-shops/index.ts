// ================================================================
// platform-admin-list-shops
// Lists all shops with optional status/tier filters.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { status, tier } = req.method === "POST" ? await req.json() : {};

    await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    let query = adminClient
      .from("shops")
      .select(`
        id, name, address, email, phone,
        subscription_tier, is_active,
        created_at, updated_at,
        owner_id
      `);

    if (status === "active") {
      query = query.eq("is_active", true);
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    }

    if (tier) {
      query = query.eq("subscription_tier", tier);
    }

    const { data: shops, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: `Failed to list shops: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Enrich with membership info for pending detection
    const shopIds = (shops || []).map((s: Record<string, unknown>) => s.id);
    let membershipMap: Record<string, Record<string, unknown>> = {};
    if (shopIds.length > 0) {
      const { data: memberships } = await adminClient
        .from("shop_memberships")
        .select("shop_id, user_id, is_active, role, created_at")
        .in("shop_id", shopIds);

      for (const m of (memberships || [])) {
        const sid = m.shop_id as string;
        if (!membershipMap[sid]) {
          membershipMap[sid] = m;
        }
      }
    }

    const enriched = (shops || []).map((shop: Record<string, unknown>) => {
      const mem = membershipMap[shop.id as string];
      return {
        ...shop,
        owner_id: shop.owner_id || mem?.user_id || null,
        membership_active: mem?.is_active ?? null,
        membership_role: mem?.role ?? null,
      };
    });

    return new Response(
      JSON.stringify({ shops: enriched }),
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
