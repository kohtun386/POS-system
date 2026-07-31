// ================================================================
// staff-accept-invitation
// Accepts a staff invitation and provisions the user atomically.
//
// Two branches:
//   A) User already has an auth account → JWT-verified, provision
//   B) New user → auth.admin.createUser() then provision
//
// Both branches delegate to provision_user RPC for atomic
// membership + audit in a single DB transaction. The RPC enforces
// role-from-invitation (privilege escalation prevention) and
// email binding (token theft protection).
//
// VISION.md §6 (Onboarding Pipeline — Stage 2: ACCEPT)
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { token, password, name, username } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createAdminClient();

    // ── 1. Look up invitation by token ──────────────────────────
    const { data: invitation, error: inviteError } = await adminClient
      .from("shop_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({ error: "This invitation has already been accepted" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Check if user already exists by email ────────────────
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id, email")
      .eq("email", invitation.email)
      .maybeSingle();

    let userId: string;
    let invitedBy: string;

    if (existingUser) {
      // ── Branch A: User exists — verify JWT matches invitation ─
      invitedBy = invitation.invited_by;
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({
            error: "Authentication required. Sign in with the invited email first.",
            code: "AUTH_REQUIRED",
          }),
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

      // Verify the authenticated user's email matches the invitation email
      if (caller.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return new Response(
          JSON.stringify({
            error: "This invitation is for a different email address. Sign in with the invited email.",
            code: "EMAIL_MISMATCH",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      userId = existingUser.id;
    } else {
      // ── Branch B: New user — create auth account then provision ─
      // Token is the trust anchor (no JWT since user isn't signed up yet)
      if (!password || !name || !username) {
        return new Response(
          JSON.stringify({
            error: "password, name, and username are required for new accounts",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters long" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        app_metadata: {
          staff_provisioned: true,
        },
        user_metadata: {
          name,
          username,
          staff_creation: true,
          target_role: invitation.role,
          shop_id: invitation.shop_id,
        },
      });

      if (createError || !newUser.user) {
        if (createError?.message?.includes("already registered")) {
          return new Response(
            JSON.stringify({ error: "A user with this email already exists. Please sign in instead." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError?.message ?? "Unknown error"}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      userId = newUser.user.id;
      invitedBy = invitation.invited_by;
    }

    // ── 3. Call provision_user RPC (atomic membership + audit) ──
    const { data: provisionResult, error: rpcError } = await adminClient.rpc(
      "provision_user",
      {
        p_user_id: userId,
        p_shop_id: invitation.shop_id,
        p_invited_by: invitedBy,
        p_token: token,
        p_role: null, // Ignored when p_token is set; role comes from invitation
      },
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Provisioning failed: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!provisionResult.success) {
      return new Response(
        JSON.stringify({ error: provisionResult.error }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Return success ──────────────────────────────────────
    return new Response(
      JSON.stringify({
        message: "Invitation accepted successfully",
        user_id: provisionResult.user_id,
        shop_id: invitation.shop_id,
        role: invitation.role,
        email: invitation.email,
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
