# ADR-003: Add shop_id Placeholder Now

**Status:** Accepted
**Date:** 2026-06-20
**Deciders:** Technical Lead + AI Agent
**Source:** `docs/architecture/foundation-phase-analysis.md` Section 2

---

## Context

All 13 existing tables have no tenant isolation. RLS policies grant `authenticated` users full access. Any authenticated user sees all data. Fine for one shop. Breaks for multiple.

Multi-tenancy requires `shop_id` column on every table + RLS rewrite + service layer changes. Estimated cost: 2-3 weeks full-time.

Two options:
1. **Add now as placeholder** — schema foundation, no UI, no behavior change
2. **Add later when needed** — retrofit onto production data with real customers

## Decision

**Add `shop_id` placeholders now.** Single migration adds column with hardcoded default shop UUID.

## Rationale

### Cost of adding later (5-10x higher)

| Area | Impact |
|------|--------|
| Migrations | `ALTER TABLE … ADD COLUMN shop_id UUID NOT NULL` on tables with production data. Requires backfill migration with default shop creation. Risk of locking large tables. |
| RLS policies | 51+ policies rewritten. Every existing policy gets `AND shop_id = ...` clause. Massive surface area for bugs. |
| Service layer | Every service call injects `shop_id`. `productsService.getAll()` → `productsService.getAll(shopId)`. Breaking change to every component. |
| Indexes | `CREATE INDEX` on production tables with data. Slower than on empty/small tables. |
| Testing | No test suite exists. Retrofitting multi-tenancy without tests = blind refactor. |

### Cost of adding now (cheap)

| Area | Impact |
|------|--------|
| Single migration | `ALTER TABLE … ADD COLUMN shop_id UUID NOT NULL DEFAULT '<uuid>'`. Clean. No backfill pain (tables are small). |
| RLS | Policies written with `shop_id` from day one. No rewrite needed. |
| Services | `shop_id` already in every query. No breaking change later. |
| Indexes | Created alongside columns. No retroactive index building. |

### What "placeholder" means

- `shops` table with one default row
- `shop_memberships` linking all users to default shop
- `shop_id UUID NOT NULL DEFAULT '<default-shop>' REFERENCES shops(id)` on every table
- Indexes on every `shop_id` FK column
- No UI for shop switching
- No shop management screens
- No invite flow
- Existing single-shop operation unchanged

## Consequences

### Positive
- Future multi-tenant migration is schema-ready
- No data migration needed when onboarding second shop
- RLS policies can be extended with `shop_id` scoping without column additions
- Agent can build shop-aware queries incrementally

### Negative
- Every table has extra UUID column (16 bytes per row)
- Every INSERT must include or default `shop_id`
- FK constraint on every table adds join overhead (mitigated by indexes)

### Neutral
- Default shop UUID `4f3dab19-144e-4a29-95a5-2ee82f160ce5` is hardcoded in migration
- `app_settings` remains single-row per shop (will need per-shop scoping in future)

## Migration Chunks

| Chunk | Scope | Risk |
|-------|-------|------|
| **1 (this)** | Schema: create tables, add columns, backfill, indexes | Zero behavior change |
| 2 | RLS: rewrite 51 policies with shop_id scoping | Medium — can break access |
| 3 | Services: update 12 service objects to pass shop_id | Low — frontend only |

## Related

- `docs/architecture/database.md` — Schema map (updated after migration)
- `docs/specs/multi-tenancy.md` — Full multi-tenant spec
- `docs/architecture/foundation-phase-analysis.md` — Original analysis
