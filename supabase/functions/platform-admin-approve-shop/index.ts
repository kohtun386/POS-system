// ================================================================
// platform-admin-approve-shop
// Activates a pending shop: sets shop.is_active, membership.is_active,
// and user.active to true. Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import { extractIp, recordAudit } from "./_shared/audit.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // ---------------------------------------------------------------
    // 1. Verify caller JWT and confirm platform_admin role
    // ---------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Client with anon key — used ONLY to verify JWT and check role
    const verifyClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await verifyClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check platform_admin role
    const { data: profile, error: profileError } = await verifyClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "platform_admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: requires platform_admin role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------------------------------------------------------------
    // 2. Perform mutation with service_role (bypasses RLS)
    // ---------------------------------------------------------------
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch shop and related entities to validate existence
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

    // Find the membership for this shop (should be pending/inactive)
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

    // --- Apply all three mutations (non-atomic, but acceptable for admin ops) ---
    const errors: string[] = [];

    // a) Activate the shop
    const { error: shopUpdateErr } = await adminClient
      .from("shops")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", shop_id);
    if (shopUpdateErr) errors.push(`shop: ${shopUpdateErr.message}`);

    // b) Activate the membership
    const { error: memberUpdateErr } = await adminClient
      .from("shop_memberships")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", membership.id);
    if (memberUpdateErr) errors.push(`membership: ${memberUpdateErr.message}`);

    // c) Activate the user account
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

    // ---------------------------------------------------------------
    // 3. Record audit log
    // ---------------------------------------------------------------
    await recordAudit(adminClient, {
      actorId: user.id,
      action: "approve_shop",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: {
        shop_name: shop.name,
        owner_id: membership.user_id,
      },
      ipAddress: extractIp(req),
    });

    // ---------------------------------------------------------------
    // 4. Return success
    // ---------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Shop approved successfully",
        shop_id,
        shop_name: shop.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
