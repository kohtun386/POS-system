// ================================================================
// platform-admin-manage-features
// CRUD for feature_definitions rows. Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { action } = body;

    if (!action || !["list", "create", "update", "delete"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be one of: list, create, update, delete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    // --- LIST ---
    if (action === "list") {
      const { data, error } = await adminClient
        .from("feature_definitions")
        .select("*")
        .order("key");

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ features: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- CREATE ---
    if (action === "create") {
      const { key, name, description, subscription_tier, default_enabled } = body;
      if (!key || !name) {
        return new Response(
          JSON.stringify({ error: "key and name are required for create" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await adminClient
        .from("feature_definitions")
        .insert({
          key,
          name,
          description: description ?? "",
          subscription_tier: subscription_tier ?? "free",
          default_enabled: default_enabled !== undefined ? default_enabled : true,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await recordAudit(adminClient, {
        actorId: caller.userId,
        action: "create_feature",
        targetType: "feature_definition",
        targetId: data.id,
        details: { key: data.key, name: data.name },
        ipAddress: extractIp(req),
      });

      return new Response(
        JSON.stringify({ feature: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- UPDATE ---
    if (action === "update") {
      const { feature_id, ...updates } = body;
      if (!feature_id) {
        return new Response(
          JSON.stringify({ error: "feature_id is required for update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Only allow specific fields
      const allowed = ["name", "description", "subscription_tier", "default_enabled", "key"];
      const updateData: Record<string, unknown> = {};
      for (const field of allowed) {
        if (updates[field] !== undefined) updateData[field] = updates[field];
      }

      const { data, error } = await adminClient
        .from("feature_definitions")
        .update(updateData)
        .eq("id", feature_id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await recordAudit(adminClient, {
        actorId: caller.userId,
        action: "update_feature",
        targetType: "feature_definition",
        targetId: feature_id,
        details: updateData,
        ipAddress: extractIp(req),
      });

      return new Response(
        JSON.stringify({ feature: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- DELETE ---
    if (action === "delete") {
      const { feature_id } = body;
      if (!feature_id) {
        return new Response(
          JSON.stringify({ error: "feature_id is required for delete" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error } = await adminClient
        .from("feature_definitions")
        .delete()
        .eq("id", feature_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await recordAudit(adminClient, {
        actorId: caller.userId,
        action: "delete_feature",
        targetType: "feature_definition",
        targetId: feature_id,
        ipAddress: extractIp(req),
      });

      return new Response(
        JSON.stringify({ message: "Feature deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
