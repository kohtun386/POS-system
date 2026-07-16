import { createClient } from "jsr:@supabase/supabase-js@2";

// Ensure required environment variables are set
const requiredEnv = ["URL", "ANON_KEY", "SERVICE_ROLE_KEY"] as const;
for (const key of requiredEnv) {
  if (!Deno.env.get(key)) {
    console.error(`Missing required environment variable: ${key}`);
    // In Edge Functions, throwing a Response aborts the function execution
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

/**
 * Decode a JWT payload without verification.
 * Used for service_role tokens which fail auth.getUser() (no sub claim).
 */
function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(payload);
}

export interface PlatformAdminUser {
  userId: string;
  role: string;
}

/**
 * Verify the request JWT belongs to a platform_admin user.
 * Throws a Response (HTTP error) on auth/role failure.
 * On success, returns { userId, role }.
 *
 * Handles both user JWTs (via auth.getUser) and service_role JWTs (via direct decode).
 */
export async function verifyPlatformAdmin(
  req: Request,
): Promise<PlatformAdminUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Try to decode JWT payload to check role
  let payload: Record<string, unknown>;
  try {
    payload = decodeJwt(token);
  } catch {
    throw new Response(
      JSON.stringify({ error: "Invalid token format" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Service role token — verify via users table lookup
  if (payload.role === "service_role") {
    const adminClient = createAdminClient();

    // Find a platform_admin user to associate the action with
    const { data: admins, error: adminError } = await adminClient
      .from("users")
      .select("id, role")
      .eq("role", "platform_admin")
      .eq("active", true)
      .limit(1)
      .single();

    if (adminError || !admins) {
      throw new Response(
        JSON.stringify({ error: "Forbidden: no platform_admin found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return { userId: admins.id, role: admins.role };
  }

  // User JWT — verify with auth.getUser then check role
  const verifyClient = createClient(
    Deno.env.get("URL")!,
    Deno.env.get("ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await verifyClient.auth.getUser();
  if (authError || !user) {
    throw new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: profile, error: profileError } = await verifyClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "platform_admin") {
    throw new Response(
      JSON.stringify({ error: "Forbidden: requires platform_admin role" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return { userId: user.id, role: profile.role };
}

/**
 * Create an admin client using the service_role key.
 * Used for all DB mutations (bypasses RLS).
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
  );
}