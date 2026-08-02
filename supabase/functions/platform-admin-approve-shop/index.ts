// ================================================================
// platform-admin-approve-shop
// Activates a pending shop via atomic approve_shop() RPC.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
//
// On success, sends an approval email to the shop owner via Resend.
// Email failure is logged but does NOT roll back the approval.
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";


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
  const corsHeaders = getCorsHeaders(req);
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

    // 2. Atomic approval via RPC (single DB transaction)
    const adminClient = createAdminClient();

    const { data: result, error: rpcError } = await adminClient.rpc(
      "approve_shop",
      { p_shop_id: shop_id, p_approver_id: caller.userId },
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

    // 3. Send approval email (best-effort — does not block approval)
    if (result.owner_id) {
      const { data: ownerUser } = await adminClient
        .from("users")
        .select("email")
        .eq("id", result.owner_id)
        .single();

      if (ownerUser?.email) {
        // Fire-and-forget: Supabase Edge Runtime keeps the event loop alive
        // after returning the response, so unawaited promises complete.
        sendApprovalEmail(ownerUser.email, result.shop_name);
      } else {
        console.warn("Approval email skipped: no email found for user", result.owner_id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Shop approved successfully",
        shop_id: result.shop_id,
        shop_name: result.shop_name,
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
