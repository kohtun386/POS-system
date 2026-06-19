# Foundation Phase — Analysis Report

**Date:** 2026-06-19  
**Context:** Pre-multi-tenant, single-shop POS. 15+ tables. Supabase-backed. RLS active on all tables.

---

## 1. Docs Folder Structure

### Current state
```
docs/
  product-roadmap.md
  technical-debt.md
```

Two flat files. Won't scale. Need domain separation before foundation work begins.

### Recommended layout

```
docs/
  architecture/           # System design, decisions, schemas
    database.md           # Schema map, RLS strategy, migrations policy
    auth.md               # Auth flow, role hierarchy, RLS matrix
    state-management.md   # Context/reducer design, data flow
    deployment.md         # Hosting, CI/CD, Supabase config
  ops/                    # Runbooks, troubleshooting
    backup-restore.md
    incident-response.md
    performance.md
  specs/                  # Feature specifications
    multi-tenancy.md      # shop_id rollout plan (this doc's scope)
    inventory-alerts.md
    discounts-engine.md
  design-system.md        # Color/font/spacing/tokens (detailed below)
  roadmap.md              # Product roadmap (existing, move here)
  technical-debt.md       # Known tech debt (existing, move here)
```

**Why this layout:**
- `architecture/` — for contributors who need to understand how things connect. Read once, reference forever.
- `ops/` — for on-call/urgent situations. Flat list of runbooks. No nesting.
- `specs/` — one file per feature domain. Spec lives next to design decisions. Becomes ADR (Architecture Decision Record) when decision is made.
- Root-level `.md` files for cross-cutting concerns (design system, roadmap).

**Challenge:** Docs rot if not tied to PR process. **Recommendation:** Add "docs update" checkbox to PR template. Spec doc must exist before migration is written.

---

## 2. Multi-Tenancy: `shop_id` — Now vs Later

### Current schema (no shop_id)

All tables are implicitly scoped to a single shop. RLS policies grant `authenticated` users full access. No tenant isolation.

### Tables affected (16+)

```
app_settings      → per-shop config (currently single-row assumption)
categories        → product categories
customers         → customer records
suppliers         → supplier records
products          → product catalog
product_batches   → inventory batches
discounts         → discount rules
users             → staff accounts (currently profiles, not shop-scoped)
sales             → transactions
sales_tabs        → open tabs (already user-scoped, needs shop-scope too)
alert_recipients  → alert notification targets
alert_templates   → alert message templates
alert_configurations → alert rules
alert_history     → alert delivery log
notification_service_config → notification channels
```

### Add later: Cost

| Area | Impact |
|------|--------|
| **Migrations** | Every table needs `ALTER TABLE … ADD COLUMN shop_id UUID NOT NULL REFERENCES shops(id)`. Existing rows have no shop → need backfill migration with default shop creation. |
| **RLS policies** | Every existing policy rewritten from `USING (auth.uid() = user_id)` or `USING (true)` to `USING (shop_id = current_shop_id())`. Massive surface area. 50+ policies. |
| **Service layer** | Every service call must inject `shop_id`. `productsService.getAll()` becomes `productsService.getAll(shopId)`. Breaking change to every component. |
| **Indexes** | Every FK join needs `CREATE INDEX ON <table>(shop_id)`. Without indexes, multi-tenant queries degrade linearly. |
| **Testing** | No test suite exists yet. Retrofitting multi-tenancy without tests = blind refactor. High regression risk. |

### Add now: Cost

| Area | Impact |
|------|--------|
| **Single migration** | One migration adds `shop_id` to all tables with a hardcoded default shop UUID. Clean. No backfill. |
| **RLS** | Policies written with `shop_id` from day one. No rewrite. |
| **Services** | `shop_id` already in every query. No breaking change later. |
| **Indexes** | Created alongside columns. No retroactive index building on production data. |

### Verdict

**Add `shop_id` placeholders now.** Cost of adding later is 5-10x higher. Specifically:

1. Create `shops` table now with a single default row.
2. Add `shop_id UUID NOT NULL DEFAULT '<default-shop-uuid>' REFERENCES shops(id)` to every table.
3. Add indexes on every `shop_id` FK column.
4. Update RLS policies to scope by `shop_id`.
5. Update service layer to include `shop_id` in all queries.

The "placeholder" approach means: no UI for shop switching, no shop management screens, no invite flow. Just the schema foundation. Migration is cheap now. Retrofitting onto production data later is expensive and risky.

**Challenge:** `app_settings` is currently single-row. With multi-tenancy, it becomes `shop_id`-scoped. The `settingsService.get()` / `settingsService.update()` pattern (finds existing row by ID) must be updated to filter by `shop_id`. Do this during the placeholder migration.

---

## 3. Design System → Tailwind CSS Linkage

### Current state

`tailwind.config.js` already has rich design tokens defined:
- Full color palettes (primary/espresso, secondary/warm-stone, accent/copper, success, warning, danger)
- Font families (DM Sans, Fraunces)
- Custom shadows, animations, keyframes
- Border radii, spacing extensions

`CLAUDE.md` documents the design system conventions. `src/index.css` defines CSS component classes (`.btn`, `.card`, `.modal`, etc.).

**Problem:** Design tokens live in three places:
1. `tailwind.config.js` — the source of truth for generated classes
2. `CLAUDE.md` — prose documentation (human-readable, not machine-readable)
3. `src/index.css` — custom component classes using raw values

These can drift. No single file links token names to their usage. A new contributor sees `primary-600` but doesn't know that's "main button brown" without reading CLAUDE.md.

### Recommendation: Design System `.md` as token catalog

Create `docs/design-system.md` with this structure:

```markdown
# Design System — Espresso & Copper

## Color Tokens
| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Primary Button | primary-600 | #9a693a | Main CTAs, nav links |
| Primary Hover | primary-700 | #7a4f2c | Button hover state |
| Card BG | secondary-100 | #f0ece5 | Card backgrounds |
| ... | | | |

## Typography Tokens
| Token | Tailwind Class | CSS | Usage |
|-------|---------------|-----|-------|
| Heading Serif | font-display | Fraunces, 600 | Page titles, modal headers |
| Body Sans | font-sans | DM Sans | All body text, inputs, tables |
| ... | | | |

## Component Tokens
| Component | Tailwind Classes | CSS Class | Notes |
|-----------|-----------------|-----------|-------|
| Primary Button | bg-primary-600 text-white hover:bg-primary-700 | .btn .btn-primary | 44px height |
| ... | | | |
```

**Linkage rule:** Every token in `design-system.md` MUST reference an existing Tailwind class from `tailwind.config.js`. Every new Tailwind class added to config MUST be documented in `design-system.md`. Bidirectional traceability.

**Challenge:** This adds maintenance burden. Without enforcement, docs drift. **Recommendation:** Keep the `.md` as a *catalog*, not a *spec*. Tailwind config stays the single source of truth. The `.md` is a human-readable index. When in doubt, Tailwind config wins.

---

## 4. DB Guardian: Schema Change Risks

### Current state

DB Guardian exists at `.claude/agents/db-guardian.md`. It's a Claude agent that validates queries/migrations against `src/lib/database.types.ts`. It also has a test-data cleanup workflow.

### What it protects against

| Risk | Coverage |
|------|----------|
| Typo in column name | ✅ Validates against database.types.ts |
| Wrong type assignment | ✅ Checks JSONB structure, enum values |
| Missing table reference | ✅ Validates table existence |
| Broken camelCase↔snake_case | ✅ Checks naming convention |
| Foreign key violations | ✅ Checks FK integrity |
| Migration dropping active columns | ✅ Checks types still reference column |

### What it does NOT protect against (gaps)

| Risk | Gap |
|------|-----|
| **RLS policy regression** | Guardian validates column/type safety, not RLS policy correctness. A migration can silently weaken a policy → data leak. |
| **Performance regression** | Adding a column with a poor default or missing index. Guardian doesn't check execution plans. |
| **Data loss in backfills** | `UPDATE … SET shop_id = X` without WHERE clause. Guardian doesn't validate DML safety. |
| **Type drift** | `database.types.ts` can fall out of sync with actual DB schema. Guardian trusts the types file blindly. |
| **Enum value explosion** | `payment_method` constraint already wide (MMK + LKR methods). Adding more values without cleanup bloats CHECK constraints. |
| **Cascading deletes** | Guardian doesn't trace FK cascade chains. A `DROP TABLE` with CASCADE can silently destroy data. |

### Recommended DB Guardian upgrades

1. **Add RLS audit step:** Before every migration, dump current RLS policies. After migration, diff. Flag any policy that changed or was removed.
2. **Add index check:** New FK columns (`shop_id`) MUST have a corresponding `CREATE INDEX` in the same migration. Guardian should flag missing indexes.
3. **Add type-sync verification:** Periodically compare `database.types.ts` against live Supabase schema (via `list_tables` with verbose=true). Flag drift.
4. **Add DML safety rules:** Any `UPDATE` or `DELETE` without `WHERE` clause should be blocked. Any `DROP` with `CASCADE` requires explicit justification comment.
5. **Add enum freeze rule:** Adding values to enums is fine. Removing or renaming enum values requires a separate migration with data migration first.

### Long-term risk: Guardian bypass

Guardian is a Claude agent. It only runs when invoked. A human (or another agent) can push a migration directly via Supabase dashboard or CLI without Guardian review. **Recommendation:** Add a pre-commit hook that runs `supabase db lint` + schema diff check. Guardian is the design-time validator. A CI check is the commit-time gate.

---

## Summary: Prioritized Action Items

| # | Action | Effort | Impact | Blocking? |
|---|--------|--------|--------|-----------|
| 1 | Create `docs/` folder structure | Small | Organizes all future work | Yes — foundation |
| 2 | Write `docs/design-system.md` | Small | Single source for design tokens | No |
| 3 | Add `shop_id` placeholder migration | Medium | Saves 5-10x retrofit cost | **Do now** |
| 4 | Upgrade DB Guardian with RLS + index checks | Medium | Prevents silent regressions | Before next migration |
| 5 | Add pre-commit schema diff check | Small | Enforces Guardian at commit time | After #4 |

**Key principle:** Schema changes get exponentially more expensive as data grows. Pay the cost now while tables are small. `shop_id` is the textbook case — cheap placeholder migration today vs. painful backfill migration on production data tomorrow.
