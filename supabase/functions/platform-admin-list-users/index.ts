// ================================================================
// platform-admin-list-users
// Lists all users across all shops with their membership info.
// Only callable by platform_admin.
//
// VISION.md §17.3 — Edge Function Inventory
// ================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPlatformAdmin, createAdminClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // @deprecated Per VISION.md §4.4, platform_admin cannot manage staff.
  // This function is disabled. All staff management must happen shop-side by shop admins.
  return new Response(
    JSON.stringify({ error: "Platform Admin cannot manage staff per VISION.md §4.4. This function is deprecated." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

  try {
    const { shop_id, role, is_active, page = 1, page_size = 50 } =
      req.method === "POST" ? await req.json() : {};

    await verifyPlatformAdmin(req);
    const adminClient = createAdminClient();

    // 1. Fetch all shop_memberships with user + shop info
    let query = adminClient
      .from("shop_memberships")
      .select(`
        id,
        user_id,
        shop_id,
        role,
        is_active,
        created_at,
        updated_at,
        users:user_id ( id, username, name, email, active, avatar ),
        shops:shop_id ( id, name )
      `);

    // Apply filters
    if (shop_id) {
      query = query.eq("shop_id", shop_id);
    }
    if (role) {
      query = query.eq("role", role);
    }
    if (is_active !== undefined) {
      query = query.eq("is_active", is_active);
    }

    const { data: memberships, error: memError, count } = await query
      .order("created_at", { ascending: false });

    if (memError) {
      return new Response(
        JSON.stringify({ error: `Failed to list users: ${memError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Aggregate by user — each user may have multiple shop memberships
    const userMap = new Map<string, {
      userId: string;
      username: string;
      name: string;
      email: string;
      avatar: string | null;
      isActive: boolean;
      memberships: Array<{
        membershipId: string;
        shopId: string;
        shopName: string;
        role: string;
        isActive: boolean;
        createdAt: string;
      }>;
    }>();

    for (const m of memberships || []) {
      const user = m.users as Record<string, unknown> | null;
      const shop = m.shops as Record<string, unknown> | null;
      if (!user) continue;

      const uid = user.id as string;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          userId: uid,
          username: user.username as string,
          name: user.name as string,
          email: user.email as string,
          avatar: (user.avatar as string) || null,
          isActive: user.active as boolean,
          memberships: [],
        });
      }

      userMap.get(uid)!.memberships.push({
        membershipId: m.id as string,
        shopId: m.shop_id as string,
        shopName: (shop?.name as string) || "Unknown",
        role: m.role as string,
        isActive: m.is_active as boolean,
        createdAt: m.created_at as string,
      });
    }

    const users = Array.from(userMap.values());

    // 3. Paginate
    const offset = (page - 1) * page_size;
    const paginatedUsers = users.slice(offset, offset + page_size);

    return new Response(
      JSON.stringify({
        users: paginatedUsers,
        total: users.length,
        page,
        pageSize: page_size,
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
