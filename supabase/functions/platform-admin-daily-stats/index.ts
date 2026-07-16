// ================================================================
// platform-admin-daily-stats
// Platform-wide metrics (pending shops, active shops, MRR).
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";

const TIER_MONTHLY_PRICES: Record<string, number> = { free: 0, growth: 49000, pro: 149000 };

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    const [shopsRes, membershipsRes] = await Promise.all([
      adminClient.from("shops").select("id, is_active, subscription_tier"),
      adminClient.from("shop_memberships").select("id, is_active"),
    ]);

    const allShops = shopsRes.data || [];
    const allMembers = membershipsRes.data || [];

    const pendingCount = allMembers.filter((m: Record<string, unknown>) => !m.is_active).length;
    const activeShops = allShops.filter((s: Record<string, unknown>) => s.is_active === true);
    const activeCount = activeShops.length;

    // MRR: sum of tier prices for active shops with paid tiers
    const mrr = activeShops.reduce((sum: number, s: Record<string, unknown>) => {
      const tier = s.subscription_tier as string;
      return sum + (TIER_MONTHLY_PRICES[tier] ?? 0);
    }, 0);

    // Total shops
    const totalCount = allShops.length;

    return new Response(
      JSON.stringify({
        stats: {
          totalShops: totalCount,
          activeShops: activeCount,
          pendingApprovals: pendingCount,
          mrr,
          currency: "MMK",
        },
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
