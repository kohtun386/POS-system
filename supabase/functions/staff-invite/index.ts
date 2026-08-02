// ================================================================
// staff-invite
// Generates a crypto-secure invitation token and persists it to
// shop_invitations. The returned invite link is shared with the
// invited staff member (frontend handles dispatch).
//
// Only callable by active shop admins. Staff accounts require
// Growth+ tier (staff_accounts capability).
//
// VISION.md §6 (Onboarding Pipeline — Stage 1: INVITE)
// VISION.md §4.4 (Role Matrix: Manage Staff = admin-only)
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VALID_ROLES = ["admin", "manager", "cashier"];
const DEFAULT_EXPIRY_DAYS = 7;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  const corsHeaders = getCorsHeaders(req);
  if (corsResponse) return corsResponse;

  try {
    const { shop_id, email, role, expires_in_days } = await req.json();

    // ── Validate inputs ──────────────────────────────────────────
    if (!shop_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: "shop_id, email, and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
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
    // VISION.md §4.4: Manage Staff = admin-only (Finding A from architecture review)
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
        JSON.stringify({ error: "Only active shop admins can invite staff" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Tier gate: verify shop has staff_accounts capability ──
    // staff_accounts requires Growth+ tier (VISION.md §5.5)
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

    // ── 4. Check for existing pending invitation for this email ──
    const { data: existingInvite } = await adminClient
      .from("shop_invitations")
      .select("id, expires_at")
      .eq("shop_id", shop_id)
      .eq("email", email)
      .is("accepted_at", null)
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({
          error: "A pending invitation already exists for this email",
          existing_invitation_id: existingInvite.id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 5. Generate crypto-secure token ──────────────────────────
    // Combine UUID v4 (uniqueness) with random bytes (entropy)
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    const token = `${crypto.randomUUID().replace(/-/g, "")}${hex}`;
    // ponytail: string concat over structured tokens — sufficient entropy for invite flow

    // ── 6. Insert invitation ─────────────────────────────────────
    const expiryDays = typeof expires_in_days === "number" ? expires_in_days : DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: insertError } = await adminClient
      .from("shop_invitations")
      .insert({
        shop_id,
        email,
        role,
        token,
        expires_at: expiresAt,
        invited_by: caller.id,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Failed to create invitation: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 7. Audit trail ───────────────────────────────────────────
    await recordAudit(adminClient, {
      actorId: caller.id,
      action: "create_invitation",
      targetType: "shop_invitation",
      targetId: invitation.id,
      shopId: shop_id,
      details: { email, role, shop_name: shop.name, expires_at: expiresAt },
      ipAddress: extractIp(req),
    });

    // ── 8. Return invite URL ────────────────────────────────────
    const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "https://pos-system-gilt-mu.vercel.app";
    const inviteUrl = `${appUrl}/invite/${token}`;

    return new Response(
      JSON.stringify({
        invitation_id: invitation.id,
        token,
        invite_url: inviteUrl,
        email,
        role,
        expires_at: expiresAt,
        message: "Invitation created successfully",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
