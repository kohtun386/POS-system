---
marp: true
auto-advance: 20
theme: default
paginate: true
backgroundColor: #faf8f5
color: #473b32
style: |
  section {
    font-family: 'DM Sans', sans-serif;
    padding: 60px 80px;
  }
  h1 {
    font-family: 'Fraunces', serif;
    color: #7a4f2c;
  }
  h2 {
    font-family: 'Fraunces', serif;
    color: #9a693a;
  }
  strong {
    color: #e55c13;
  }
  code {
    background: #f0ece5;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85em;
  }
---

# Tech Stack — Coffee POS

## The tools behind the build

**Stack:** React · TypeScript · Vite · Tailwind CSS · Supabase · Vercel
**Theme:** Espresso & Copper

---

# Frontend

## React 18 + TypeScript 5.5 (strict)

- **Vite 5.4** — fast HMR, code-splitting, PWA via `vite-plugin-pwa`
- **Tailwind CSS 3.4** — custom "Espresso & Copper" design system
  - Primary: `#9a693a` (espresso brown)
  - Accent: `#f57323` (copper orange)
  - Typography: Fraunces (headings) + DM Sans (body)
- **Framer Motion** — cart transitions, micro-interactions
- **Recharts** — sales/inventory analytics charts

---

# Backend

## Supabase — Postgres + Auth + RLS

- **29 tables** with Row Level Security on every one
- **3 roles:** Admin, Manager, Cashier — enforced at DB level
- **`shop_id` scoping** — multi-tenant foundation, no cross-shop leaks
- **21 migrations** — version-controlled schema
- **RLS helper:** `current_shop_ids()` — scoped query function
- **Triggers:** invoice generation, customer stats, user profile creation

---

# Deploy

## Vercel — zero-config, instant deploys

- **PWA** — installable on iPad & Android (Add to Home Screen)
- **Service worker** — precaches app shell, NetworkFirst for API
- **Cart persistence** — survives page refresh via localStorage
- **Live:** [pos-system-gilt-mu.vercel.app](https://pos-system-gilt-mu.vercel.app)

---

# db-guardian Agent

## Schema safety before every migration

**File:** `.claude/agents/db-guardian.md`

Validates proposed queries/migrations against `database.types.ts`:

- ✅ Table & column existence
- ✅ Type safety (camelCase ↔ snake_case mapping)
- ✅ Enum values & foreign key integrity
- ✅ RLS compatibility
- ✅ JSONB structure validation
- ✅ Migration safety (no breaking DDL)

Outputs a structured **Schema Safety Report** with pass/warn/block.

---

# pos-helper Skill

## Lint + design-theme enforcement

**File:** `.claude/skills/pos-helper/SKILL.md`

Two-step quality gate:

**1. Lint** — runs `npm run lint`, reports errors/warnings

**2. Theme check** — scans `src/components/` for:
- Raw Tailwind on form elements (must use `.btn`, `.input`, etc.)
- Color palette drift (only Espresso & Copper hex values allowed)
- Typography violations (headings must use `font-fraunces`)
- Import hygiene (no deprecated `AppContext.tsx` imports)
- Animation consistency (Framer Motion `duration: 0.2`)

---

# How to Trigger

## Skill & Agent commands

**Start Claude Code:**
```
source ~/vibe-key.env && cd ~/personal/coffee-pos && claude
```

**Invoke the skill** — just ask:
> "Run a lint check" / "Verify the UI" / "Check theme consistency"

**Invoke the agent** — Claude calls it automatically before:
- Any Supabase query or migration
- Schema changes or DDL operations

Or explicitly: *"Run db-guardian on this migration"*

---

# MCP Servers

## 4 external tool connections

| Server | Package | Purpose |
|--------|---------|---------|
| `supabase-platform` | `@supabase/mcp-server-supabase` | Migrations, edge functions, project management |
| `supabase-db-cloud` | `@supabase/mcp-server-postgrest` | Production DB queries via PostgREST |
| `supabase-db-local` | `@supabase/mcp-server-postgrest` | Local dev DB queries (localhost:54321) |
| `context7` | `@upstash/context7-mcp` | Up-to-date library documentation |

---

# Methodology

## Spec-first, phased implementation

**Documentation-Driven Development:**
- `docs/specs/prd.md` — acceptance criteria written first
- Code follows specs, not the other way around

**Phased build** (git history):
- Phase 4 — Context layer (capabilities, hooks)
- Phase 5 — Auth layer (approval flow, platform admin)
- Phase 6 — UI layer (checkout RPC, capability gating)
- Phase 7 — Platform admin UI (edge functions)
- Phase 8 — Pro tier analytics
- Phase 9 — Test suite (35 tests, 6 files)
- Phase 10 — Cleanup & deprecation

**Result:** 65 source files, 21 migrations, 13 docs — all AI-assisted.
