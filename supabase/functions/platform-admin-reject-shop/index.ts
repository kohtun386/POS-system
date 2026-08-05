// ================================================================
// platform-admin-reject-shop
// Rejects a pending shop application: deactivates membership + user.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
//
// On success, sends a rejection email to the shop owner via Resend.
// Email failure is logged but does NOT roll back the rejection.
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

/** Send a rejection notification email via Resend. Logs errors but never throws. */
async function sendRejectionEmail(
  toEmail: string,
  shopName: string,
  reason?: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping rejection email");
    return;
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

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
        subject: "Update on your Coffee Shop POS registration",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h1 style="color: #9a693a;">Registration update</h1>
            <p>Thank you for your interest in Coffee Shop POS.</p>
            <p>After reviewing your application for <strong>${shopName}</strong>, we are unable to approve your registration at this time.</p>
            ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ""}
            <p style="color: #666; font-size: 14px;">
              If you have questions, please contact the platform admin.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Failed to send rejection email via Resend:", response.status, body);
    } else {
      console.log("Rejection email sent to", toEmail);
    }
  } catch (err) {
    console.error("Error sending rejection email via Resend:", err);
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  const corsHeaders = getCorsHeaders(req);
  if (corsResponse) return corsResponse;

  try {
    const { shop_id, reason } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: "shop_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, owner_id")
      .eq("id", shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Atomic rejection via RPC (single DB transaction)
    const { data: result, error: rpcError } = await adminClient.rpc(
      "reject_shop",
      { p_shop_id: shop_id, p_approver_id: caller.userId, p_reason: reason ?? null },
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!result.success) {
      const status = result.error === "SHOP_NOT_FOUND" ? 404
        : result.error === "SHOP_ALREADY_ACTIVE" ? 409
        : result.error === "UNAUTHORIZED" ? 403
        : result.error === "NO_ADMIN_MEMBERSHIP" ? 404
        : 500;
      return new Response(
        JSON.stringify({ error: result.error }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send rejection email (best-effort — does not block rejection)
    if (result.owner_id) {
      const { data: ownerUser } = await adminClient
        .from("users")
        .select("email")
        .eq("id", result.owner_id)
        .single();

      if (ownerUser?.email) {
        sendRejectionEmail(ownerUser.email, shop.name, reason);
      } else {
        console.warn("Rejection email skipped: no email found for user", result.owner_id);
      }
    }

    return new Response(
      JSON.stringify({ message: "Shop rejected successfully", shop_id: result.shop_id, shop_name: result.shop_name }),
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
