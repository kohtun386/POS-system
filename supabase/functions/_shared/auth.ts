import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Resolve an environment variable with fallback.
 * Edge Runtime exposes SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY;
 * older configs use URL / ANON_KEY / SERVICE_ROLE_KEY.
 */
function env(name: string, fallbackName?: string): string {
  return Deno.env.get(name) || (fallbackName ? Deno.env.get(fallbackName) : "") || "";
}

const URL_VAL = env("URL", "SUPABASE_URL");
const ANON_KEY_VAL = env("ANON_KEY", "SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY_VAL = env("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

if (!URL_VAL || !ANON_KEY_VAL || !SERVICE_ROLE_KEY_VAL) {
  console.error(`Missing required env vars: URL=${!!URL_VAL} ANON_KEY=${!!ANON_KEY_VAL} SERVICE_ROLE_KEY=${!!SERVICE_ROLE_KEY_VAL}`);
  throw new Error("Missing required environment variables (URL, ANON_KEY, SERVICE_ROLE_KEY)");
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

function makeErrorResponse(status: number, error: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
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
  corsHeaders: Record<string, string>,
): Promise<PlatformAdminUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw makeErrorResponse(401, "Missing Authorization header", corsHeaders);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Try to decode JWT payload to check role
  let payload: Record<string, unknown>;
  try {
    payload = decodeJwt(token);
  } catch {
    throw makeErrorResponse(401, "Invalid token format", corsHeaders);
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
      throw makeErrorResponse(403, "Forbidden: no platform_admin found", corsHeaders);
    }

    return { userId: admins.id, role: admins.role };
  }

  // User JWT — verify with auth.getUser then check role
  const verifyClient = createClient(
    URL_VAL,
    ANON_KEY_VAL,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await verifyClient.auth.getUser();
  if (authError || !user) {
    throw makeErrorResponse(401, "Invalid or expired token", corsHeaders);
  }

  const { data: profile, error: profileError } = await verifyClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "platform_admin") {
    throw makeErrorResponse(403, "Forbidden: requires platform_admin role", corsHeaders);
  }

  return { userId: user.id, role: profile.role };
}

/**
 * Create an admin client using the service_role key.
 * Used for all DB mutations (bypasses RLS).
 */
export function createAdminClient() {
  return createClient(
    URL_VAL,
    SERVICE_ROLE_KEY_VAL,
  );
}
