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
import { extractIp, recordAudit } from "../_shared/audit.ts";
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
    // The handle_new_auth_user() trigger reads staff_creation=true
    // and target_role from metadata, then skips shop+membership creation.
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        staff_creation: true,
        target_role: role,
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

    // ── 5. Insert shop_memberships row for the correct shop ──────
    // The trigger inserted public.users but skipped membership.
    // We add it here via service_role client (bypasses RLS).
    const { error: membershipError } = await adminClient
      .from("shop_memberships")
      .insert({
        user_id: newUser.user.id,
        shop_id,
        role,
        is_active: true,
      });

    if (membershipError) {
      // Cleanup: the auth user was created but membership failed.
      // Don't delete the auth user — that would lose the audit trail.
      // The user profile exists but has no shop access — admin can retry.
      console.error("Membership insert failed for staff user:", membershipError.message);
      return new Response(
        JSON.stringify({
          error: "User created but failed to assign shop membership. Please try again or contact support.",
          code: "MEMBERSHIP_CREATION_FAILED",
          user_id: newUser.user.id,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 6. Audit trail ──────────────────────────────────────────
    await recordAudit(adminClient, {
      actorId: caller.id,
      action: "create_staff",
      targetType: "user",
      targetId: newUser.user.id,
      shopId: shop_id,
      details: {
        email,
        role,
        shop_name: shop.name,
      },
      ipAddress: extractIp(req),
    });

    // ── 7. Return the new user details ──────────────────────────
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
