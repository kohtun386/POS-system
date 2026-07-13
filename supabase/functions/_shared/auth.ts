// Ensure required environment variables are set
const requiredEnv = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
for (const key of requiredEnv) {
  if (!Deno.env.get(key)) {
    console.error(`Missing required environment variable: ${key}`);
    // In Edge Functions, throwing a Response aborts the function execution
    throw new Error(`Missing required environment variable: ${key}`);
  }
}


export interface PlatformAdminUser {
  userId: string;
  role: string;
}

/**
 * Verify the request JWT belongs to a platform_admin user.
 * Throws a Response (HTTP error) on auth/role failure.
 * On success, returns { userId, role }.
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

  // Client with anon key — used ONLY to verify JWT and check role
  const verifyClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
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
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}