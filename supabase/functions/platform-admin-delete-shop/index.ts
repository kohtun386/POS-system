// ================================================================
// platform-admin-delete-shop
// Hard-delete a pending/inactive shop from the database.
// Safety checks prevent active-shop deletion.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
//
// Deletion order: audit_logs → app_settings → shops (CASCADE handles
// remaining FK tables). An audit log entry is recorded on success.
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

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

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    // SAFETY: Only allow deletion of inactive shops
    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .select("id, name, is_active")
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
        JSON.stringify({ error: "Cannot delete active shops. Deactivate first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete in order: audit_logs → app_settings → shops (CASCADE handles remaining FK tables)
    const errors: string[] = [];

    const { error: auditErr } = await adminClient
      .from("audit_logs")
      .delete()
      .eq("shop_id", shop_id);
    if (auditErr) errors.push(`audit_logs: ${auditErr.message}`);

    const { error: settingsErr } = await adminClient
      .from("app_settings")
      .delete()
      .eq("shop_id", shop_id);
    if (settingsErr) errors.push(`app_settings: ${settingsErr.message}`);

    const { error: shopDelErr } = await adminClient
      .from("shops")
      .delete()
      .eq("id", shop_id);
    if (shopDelErr) errors.push(`shops: ${shopDelErr.message}`);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Partial failure", details: errors }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await recordAudit(adminClient, {
      actorId: caller.userId,
      action: "delete_shop",
      targetType: "shop",
      targetId: shop_id,
      shopId: shop_id,
      details: { shop_name: shop.name },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify({ message: "Shop deleted permanently", shop_id }),
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
