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
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

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

    // Deactivate membership and user
    const errors: string[] = [];

    const { error: memberErr } = await adminClient
      .from("shop_memberships")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("shop_id", shop_id);
    if (memberErr) errors.push(`membership: ${memberErr.message}`);

    const { error: userErr } = await adminClient
      .from("users")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", shop.owner_id);
    if (userErr) errors.push(`user: ${userErr.message}`);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Partial failure", details: errors }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "reject_shop",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: { shop_name: shop.name, reason: reason ?? null },
      ipAddress: extractIp(req),
    });

    // 4. Send rejection email (best-effort — does not block rejection)
    if (shop.owner_id) {
      const { data: ownerUser } = await adminClient
        .from("users")
        .select("email")
        .eq("id", shop.owner_id)
        .single();

      if (ownerUser?.email) {
        // Fire-and-forget: Supabase Edge Runtime keeps the event loop alive
        // after returning the response.
        sendRejectionEmail(ownerUser.email, shop.name, reason);
      } else {
        console.warn("Rejection email skipped: no email found for user", shop.owner_id);
      }
    }

    return new Response(
      JSON.stringify({ message: "Shop rejected successfully", shop_id }),
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
