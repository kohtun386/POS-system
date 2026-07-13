# Supabase CLI Pre-Flight Verification Report

**Date:** 2026-07-13
**Status:** PARTIAL

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Supabase CLI installed | ✅ | v2.109.1 via `npx` (not global binary) |
| Project linked | ✅ | `ejvvwnupiqytximrbmfw` (coffee-pos) — `linked: true` |
| Edge Functions support | ✅ | `supabase functions` subcommand available |
| Deno installed | ❌ | Not found in PATH — required for local Edge Function testing |
| Database connection | ✅ | Remote project reachable via MCP; API URL resolves |
| Authentication | ✅ | `~/.supabase/access-token` exists (44 bytes, 0600 perms) |
| Migrations accessible | ✅ | 24 local / 51 remote |

## Critical Issues (Must Fix Before Phase 3)

### 1. Deno not installed — blocks local Edge Function testing

Deno is not installed anywhere on this system. The Supabase CLI uses Deno under the hood to bundle and serve Edge Functions locally. Without it, `supabase functions serve` will fail.

**Fix:**
```bash
# Option A: Deno installer (recommended)
curl -fsSL https://deno.land/install.sh | sh
# Then add to PATH in ~/.bashrc:
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
```

**Note:** The Supabase Cloud platform runs its own Deno runtime — this only blocks *local* development and testing. Functions can still be scaffolded and deployed via `supabase functions deploy` without Deno locally, but you won't be able to test them before deploying.

### 2. No Edge Functions exist yet

- Local: `supabase/functions/` exists but is empty (no function directories).
- Remote: 0 deployed functions.

This is expected pre-Phase 3, but means Phase 3 starts from scratch.

## Warnings (Non-blocking but should address)

### Migration count mismatch: 24 local vs 51 remote

51 migrations exist on the remote Supabase project but only 24 `.sql` files exist locally under `supabase/migrations/`. This is normal if some migrations were applied directly via the dashboard or MCP `apply_migration` without local files. However, this means:

- Running `supabase db push` could attempt to re-apply migrations that already exist remotely.
- Phase 3 should use `supabase migration new` for all new migrations to avoid drift.

### Supabase CLI is not globally installed

Works fine via `npx supabase` but:
- All commands need the `npx` prefix (e.g., `npx supabase functions serve`).
- Alternatively install globally: `npm i -g supabase` for shorter invocations.

## Recommendations

1. **Install Deno** — required before Phase 3 local testing. Run the install command above and verify with `deno --version`.
2. **Install Supabase CLI globally** (optional but convenient):
   ```bash
   npm i -g supabase
   ```
3. **Verify remote migration state** before writing Phase 3 migrations:
   ```bash
   npx supabase db remote status
   ```
4. **Scaffold first function** once Deno is installed:
   ```bash
   npx supabase functions new my-function
   ```

## Ready for Phase 3?

**NO — one blocker.** Deno must be installed for local Edge Function development (`supabase functions serve`). Once Deno is installed and verified with `deno --version`, the environment is ready. All other prerequisites (CLI, auth, project link, DB connection) are confirmed working.
