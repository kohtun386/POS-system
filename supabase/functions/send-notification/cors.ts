const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") ?? [];

if (ALLOWED_ORIGINS.length === 0 && Deno.env.get("DENO_ENV") === "production") {
  console.warn("⚠️ ALLOWED_ORIGINS is empty — all CORS requests will be rejected");
  throw new Error("ALLOWED_ORIGINS must be set in production");
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = origin && ALLOWED_ORIGINS.includes(origin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}