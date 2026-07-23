// ================================================================
// platform-admin-approve-shop
// Activates a pending shop: sets shop.is_active, shop.subscription_tier = 'free',
// membership.is_active, and user.active to true. Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
//
// On success, sends an approval email to the shop owner via Resend.
// Email failure is logged but does NOT roll back the approval.
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Send an approval notification email via Resend. Logs errors but never throws. */
async function sendApprovalEmail(
  toEmail: string,
  shopName: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping approval email");
    return;
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "https://pos-system-gilt-mu.vercel.app";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Your Coffee Shop POS has been approved! 🎉",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="color: #9a693a;">Your shop is approved!</h1>
            <p>Great news, <strong>${shopName}</strong> has been approved by the platform admin.</p>
            <p>You can now sign in and start using your POS system.</p>
            <div style="margin: 24px 0;">
              <a href="${appUrl}/login"
                 style="background: #9a693a; color: #fff; padding: 12px 24px;
                        border-radius: 6px; text-decoration: none; display: inline-block;">
                Sign In
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this URL into your browser:<br/>
              <code style="font-size: 12px;">${appUrl}/login</code>
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Failed to send approval email via Resend:", response.status, body);
    } else {
      console.log("Approval email sent to", toEmail);
    }
  } catch (err) {
    console.error("Error sending approval email via Resend:", err);
  }
}

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
      .update({ is_active: true, subscription_tier: 'free', updated_at: new Date().toISOString() })
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

    // 4. Send approval email (best-effort — does not block approval)
    if (membership.user_id) {
      const { data: ownerUser } = await adminClient
        .from("users")
        .select("email")
        .eq("id", membership.user_id)
        .single();

      if (ownerUser?.email) {
        // Fire-and-forget: Supabase Edge Runtime keeps the event loop alive
        // after returning the response, so unawaited promises complete.
        sendApprovalEmail(ownerUser.email, shop.name);
      } else {
        console.warn("Approval email skipped: no email found for user", membership.user_id);
      }
    }

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
