// ================================================================
// staff-create
// Creates a staff user in a specific shop. Called by shop admins
// via UserModal.tsx. Bypasses the self-registration trigger's
// shop+membership creation via raw_user_meta_data.staff_creation flag.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VALID_ROLES = ["admin", "manager", "cashier"];

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { shop_id, email, password, name, username, role } = await req.json();

    // ── Validate inputs ──────────────────────────────────────────
    if (!shop_id || !email || !password || !name || !username || !role) {
      return new Response(
        JSON.stringify({ error: "shop_id, email, password, name, username, and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Verify caller JWT and extract user_id ──────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(
      Deno.env.get("URL")!,
      Deno.env.get("ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Verify caller is admin in the target shop ──────────────
    const { data: callerMembership, error: memError } = await userClient
      .from("shop_memberships")
      .select("role, is_active")
      .eq("shop_id", shop_id)
      .eq("user_id", caller.id)
      .single();

    if (memError || !callerMembership) {
      return new Response(
        JSON.stringify({ error: "You are not a member of this shop" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (callerMembership.role !== "admin" || !callerMembership.is_active) {
      return new Response(
        JSON.stringify({ error: "Only active shop admins can create staff" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Tier gate: verify shop has staff_accounts capability ───
    // Per VISION.md §5.5, staff_accounts requires Growth+ tier
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, subscription_tier")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (shop.subscription_tier === "free") {
      return new Response(
        JSON.stringify({
          error: "Staff accounts require Growth or Pro subscription. Please upgrade your plan.",
          code: "TIER_UPGRADE_REQUIRED",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Create auth user with staff_creation metadata ──────────
    // The handle_new_auth_user() trigger's staff branch gates on
    // user_metadata.staff_creation=true. It inserts ONLY a DORMANT cashier
    // profile (role='cashier', active=false) — role/active are hardcoded
    // server-side, so a forged staff_creation flag cannot escalate. The
    // real role/active/shop_id assignment happens in provision_user() below
    // (service_role-only). staff_provisioned in app_metadata is retained
    // for observability only — an AFTER INSERT trigger cannot read it.
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        staff_provisioned: true,
      },
      user_metadata: {
        name,
        username,
        staff_creation: true,
        target_role: role,
        shop_id,
      },
    });

    if (createError || !newUser.user) {
      // Check for duplicate email
      if (createError?.message?.includes("already registered")) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError?.message ?? "Unknown error"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Atomic provisioning via RPC ───────────────────────────
    // provision_user now owns ALL staff authorization: it upserts the
    // users.role/active/shop_id and the shop_membership, and cleans up any
    // phantom shop left by the trigger. Callers are service_role-only
    // (REVOKEd from PUBLIC — migration 20260731170000).
    const { data: provisionResult, error: rpcError } = await adminClient.rpc(
      "provision_user",
      {
        p_user_id: newUser.user.id,
        p_shop_id: shop_id,
        p_invited_by: caller.id,
        p_token: null,
        p_target_role: role,
        p_active: true,
      },
    );

    if (rpcError) {
      console.error("Provision RPC failed for staff user:", rpcError.message);
      return new Response(
        JSON.stringify({
          error: "User profile created but provisioning failed. Please try again or contact support.",
          code: "PROVISION_FAILED",
          user_id: newUser.user.id,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!provisionResult.success) {
      console.error("Provision RPC returned error:", provisionResult.error);
      return new Response(
        JSON.stringify({
          error: `Provisioning failed: ${provisionResult.error}`,
          user_id: newUser.user.id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 6. Return the new user details ──────────────────────────
    return new Response(
      JSON.stringify({
        user_id: newUser.user.id,
        email,
        role,
        message: "Staff user created successfully",
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
