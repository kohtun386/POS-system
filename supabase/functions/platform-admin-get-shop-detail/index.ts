// ================================================================
// platform-admin-get-shop-detail
// Full shop + owner + membership info. Only callable by platform_admin.
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
    const { shop_id } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: "shop_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("*")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [membershipsRes, usersRes, salesRes] = await Promise.all([
      adminClient.from("shop_memberships").select("id, user_id, role, is_active, created_at").eq("shop_id", shop_id),
      adminClient.from("users").select("id, name, email, role, active, created_at").eq("shop_id", shop_id),
      adminClient.from("sales").select("id, total_amount, created_at").eq("shop_id", shop_id).limit(100),
    ]);

    const sales = salesRes.data || [];
    const totalRevenue = sales.reduce((sum: number, s: Record<string, unknown>) => sum + (Number(s.total_amount) || 0), 0);

    return new Response(
      JSON.stringify({
        shop,
        memberships: membershipsRes.data || [],
        users: usersRes.data || [],
        stats: { salesCount: sales.length, totalRevenue },
      }),
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
