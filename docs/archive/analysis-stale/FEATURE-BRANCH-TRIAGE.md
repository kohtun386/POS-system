# Feature Branch Commit Triage

**Date:** 2026-07-08
**Branch:** `feature/vision-v3-migration` → `main`
**Total commits:** 60

## 📊 Triage Summary

| Category | Count | Description |
|----------|-------|-------------|
| 🟢 KEEP | 40 | Core platform work, migrations, tests, cleanup, docs |
| 🔴 DISCARD | 8 | Debug artifacts, WIP session files, stale analysis docs |
| 🟡 REVIEW | 12 | WIP commits with valuable work mixed with noise |

## 🟢 KEEP — Core Platform Work (40 commits)

These are the commits that contain the actual deliverable work. They build on each other and form the backbone of the feature branch.

### Platform Infrastructure (Phase 1–10)

| Hash | Message | Files Changed |
|------|---------|---------------|
| `b8447dd` | chore: remove .planning directory from git tracking | Deletes `.planning/` (11 stale files) |
| `263e65e` | fix: make REVOKE conditional to prevent migration failures | Fixes `20260618000002_security_fixes.sql` |
| `9cdf9ae` | feat(phase-1): complete Phase 1 schema alignment and checkout RPC | Adds `checkout_complete_rpc`, `cash_shifts`, `timezone_note` migrations; updates `database.md` |
| `a9cdc21` | feat(phase-2): complete TypeScript types alignment | Updates `src/types/index.ts` |
| `4ad1a79` | feat(phase-3): complete service layer | Adds `checkoutService`, `cashShiftsService`, `resolveCapabilities` to `services.ts` |
| `320ec0e` | feat(phase-4): complete context layer | Adds capabilities, cashShifts, `useCapability` hook to `SupabaseAppContext.tsx` |
| `f00d10f` | feat(phase-5): complete auth layer | Adds `PendingApprovalPage`, pending approval flow in `AuthContext.tsx` |
| `c447335` | feat(phase-6): complete UI layer | Checkout RPC, capability gating, `UpgradePrompt` in 9 components |
| `38b7c0e` | feat(phase-7): complete platform admin UI | 6 platform components, 7 edge functions, routing |
| `f4f03aa` | feat(phase-8): complete Pro tier owner insights | `OwnerInsights`, `ProfitMarginAnalytics`, `WasteTracking`, `WhatsAppReportConfig` |
| `e6b2d30` | feat(phase-9): add comprehensive test suite | 35 tests across 6 files, vitest config, test setup |
| `3398a28` | chore(phase-10): cleanup dead code, deprecate legacy flags | Updates `CLAUDE.md`, `FeatureFlagsManager`, `useFeatureFlag` |

### Environment & Configuration

| Hash | Message | Files Changed |
|------|---------|---------------|
| `3bcc5b8` | feat(harness): add db-guardian hook, safety scripts | `.claude/hooks/pre-tool-use.json`, `scripts/safe-supabase.sh` |
| `e4a1820` | feat(env): setup hybrid environment | `.env.example`, `database.types.ts` |
| `3f07a7d` | feat(db): add platform_admin role constraint | Migration `20260702000001` |

### Platform Admin Completion

| Hash | Message | Files Changed |
|------|---------|---------------|
| `17b5297` | fix(blocking): resolve 4 platform admin gaps | `FeatureDefinitions.tsx`, fixes to 2 existing migrations |
| `b7166d2` | fix(cash_shifts): add GRANT and RLS bypass for platform admin | Migrations `20260702000003`, `20260702000004` |

### E2E Test Infrastructure

| Hash | Message | Files Changed |
|------|---------|---------------|
| `2e102a4` | feat(testing): add E2E test infrastructure + onboarding tests | `playwright.config.ts`, `tests/e2e/` (fixtures, onboarding spec) |
| `ab37ba5` | chore(deps): update package-lock.json after Playwright | `package-lock.json` |
| `86411fa` | chore: add test-results to .gitignore | `.gitignore` |
| `8460076` | security: add .env.test to .gitignore | Deletes leaked `.env.test`, updates `.gitignore` |

### Checkout RPC & Migration Fixes

| Hash | Message | Files Changed |
|------|---------|---------------|
| `62ee5e2` | wip: fix checkout_complete RPC — 5 migrations | Adds migrations `20260703000001`–`20260703000005` |
| `1c402e8` | feat(e2e): POS checkout tests 4/5 passing | Fixes to deduction trigger, checkout migrations, adds `20260703000009` |
| `23885e3` | fix: align subscription_tier CHECK constraint | Migration `20260704000001` (enterprise → growth) |
| `dd3adbc` | fix: resolve duplicate migration timestamp | Renames `20260703000001` → `20260703000010` |
| `93aa1e7` | fix: trigger search_path fixes + E2E test improvements | Migration `20260703000008` |
| `eb40c58` | chore: cleanup SupaBase/ folder | Deletes `SupaBase/`, adds inventory alerts + security definer migrations |

### Core Bug Fixes & Features

| Hash | Message | Files Changed |
|------|---------|---------------|
| `e1ddec7` | fix: P0 capability bugs — cash_shifts key + resolution override | `SalesTabManager.tsx`, `services.ts` |
| `d38fd68` | feat: remove kitchen display dead code | Deletes 4 kitchen components, updates docs |
| `d8ccd8b` | feat: add resolve_capabilities() RPC | Migration `20260704000003`, updates context + tests |
| `6ad0c09` | fix: add missing username to trigger | Migration `20260704000004` |
| `ed5f5bd` | feat: remove multi_currency feature | Deletes `ExchangeRateManager`, `CurrencyDisplay`, `exchangeRateService` |
| `66b3380` | fix: correct feature flag wiring across 4 components | `RawMaterialManager`, `SalesTabManager`, `RecipeManager`, `UserManager` |
| `34e2ebd` | feat: add routing for RecipeManager and RawMaterialManager | `App.tsx`, `Header.tsx` |
| `eabf5f3` | wip: Fix checkout RLS — invoice generation moves to SECURITY DEFINER | `CheckoutModal.tsx`, `services.ts`, migration `20260704000005` |

### Final Cleanup & Production Readiness

| Hash | Message | Files Changed |
|------|---------|---------------|
| `3ed15d1` | fix: resolve v1.0 blockers — RLS, security, nav wiring, dead code cleanup | Deletes `useRealtimeSubscription`, `kitchenUtils`, adds migration `20260705000001` |
| `ef044d5` | fix: add DROP FUNCTION to checkout_complete migration | Updates migration, `technical-debt.md`, `database.types.ts` |
| `58a5d69` | chore: remove unused code and fix lint errors | (on main, not feature — skip) |
| `0fe8705` | fix: improve type safety — reduce any errors from 103 to 32 | (on main, not feature — skip) |

### Documentation

| Hash | Message | Files Changed |
|------|---------|---------------|
| `7eee902` | feat(governance): implement Tier Harness System | `docs/TIER-SPEC.md`, `scripts/validate-tiers.ts` |
| `19460ef` | fix(docs): align documentation with TIER-SPEC.md | Updates 7 doc files |
| `5d62f39` | docs: reconcile feature-flags.md with TIER-SPEC.md | `docs/specs/feature-flags.md` |
| `4e58ec9` | feat: complete critical gaps — trigger removal, doc reconciliation, E2E tests | Removes raw materials trigger, adds RBAC + tenant isolation tests |

### E2E Test Iterations (Final Working State)

| Hash | Message | Files Changed |
|------|---------|---------------|
| `ae109b9` | wip: pos-checkout E2E test — 5 scenarios | Adds `pos-checkout.spec.ts`, updates fixtures |
| `21f04f3` | wip: pos-checkout E2E test fixes | Updates spec, fixtures |
| `b311834` | test(e2e): add POS checkout E2E tests with debug logging | Updates spec |
| `e2a59cd` | wip: fix checkout_complete RPC — test fixture updates | Updates fixtures, spec |
| `7eec777` | wip: fix E2E tests — seedShop UPSERT, checkoutService UUID fix | Adds `debug-data.spec.ts`, updates fixtures |
| `de23f8a` | wip: fix E2E checkout — trigger search_path | Updates fixtures, spec |
| `080a77a` | wip: fix E2E checkout — deduct_raw_materials search_path | `CheckoutModal.tsx`, adds migration |
| `cc97bc5` | wip: E2E test fixes — signUp isPendingApproval | `AuthContext.tsx`, auth fixtures |
| `6e939a5` | fix: Phase 2 E2E test infrastructure improvements | Updates auth fixtures, onboarding, tenant-isolation |
| `09df7a6` | wip: Bug 1-3 fixes + RPC migration + seedShop invoice prefix | `AuthContext.tsx`, fixtures, pos-checkout, tenant-isolation |

## 🔴 DISCARD — Debug Artifacts & Stale Files (8 commits)

These commits contain files that should not exist in the final codebase.

| Hash | Message | What to Discard | Why |
|------|---------|----------------|-----|
| `80c8b87` | chore: ignore remote schema dumps, update MCP config files | MCP config updates | MCP config is project-specific tooling, not product code |
| `71408cd` | wip: session handoff — tier formalization paused | `.continue-here.md`, `TIER-SYSTEM-COMPARISON.md` | Session handoff file + intermediate analysis (superseded by `29d85a8`) |
| `b0362aa` | wip: session handoff — tier formalization phase 2 | `.continue-here.md` | Session handoff file (superseded by `29d85a8`) |
| `2b1acea` | wip: E2E assessment — 3 bugs identified | `E2E-TEST-ANALYSIS-2026-07-04.md` | Intermediate analysis doc (superseded by `29d85a8`) |
| `ab51628` | fix: resolve pre-existing test failures | `PHASE-1-COMPLETION.md`, `TEST-REGRESSION-REPORT.md` | Intermediate analysis docs (superseded by `29d85a8`) |
| `145816f` | chore: exclude mcp config from repo | `.gitignore` update | MCP config exclusion — tooling detail |
| `51812c2` | chore: add sensitive files to .gitignore | `.gitignore` update | Already on main — will merge cleanly or be redundant |
| `29d85a8` | chore: remove trash files and stale docs | Deletes 11 intermediate analysis/session files | **KEEP THIS ONE** — it cleans up the mess from the other discards |

**Note:** Commit `29d85a8` (the final commit) should be KEPT — it deletes the intermediate analysis files and `.continue-here` files that the discarded commits created.

## 🟡 REVIEW — WIP with Valuable Work (12 commits)

These are `wip:` commits that contain real work but also noise. The work they do is already captured in later `KEEP` commits, but they're worth reviewing if you want to understand the evolution.

| Hash | Message | Contains | Covered By |
|------|---------|----------|------------|
| `3a1c644` | wip: platform-admin paused at frontend debug | Platform admin UI tweaks + migration `20260702000002` | `17b5297` (blocking fix), `b7166d2` (RLS bypass) |
| `efaf519` | wip: Playwright E2E testing framework | Playwright config, onboarding spec, fixtures, `.continue-here.md` | `2e102a4` (clean E2E infra) |
| `ae109b9` | wip: pos-checkout E2E test — 5 scenarios | Initial pos-checkout spec + fixtures | Later test iterations (`b311834`, `1c402e8`) |
| `21f04f3` | wip: pos-checkout E2E test fixes | Spec fixes + `.continue-here.md` | Later test iterations |
| `62ee5e2` | wip: fix checkout_complete RPC — 5 migrations | 5 new migrations + test updates | `1c402e8` + `dd3adbc` (final state) |
| `e2a59cd` | wip: fix checkout_complete RPC — test fixture updates | Fixture + spec updates | Later iterations |
| `7eec777` | wip: fix E2E tests — seedShop UPSERT | Debug spec + `.continue-here` files | `29d85a8` cleans up `.continue-here` |
| `de23f8a` | wip: fix E2E checkout — trigger search_path | Fixture + spec updates | Later iterations |
| `080a77a` | wip: fix E2E checkout — deduct_raw_materials | `CheckoutModal.tsx` changes + migration | `eabf5f3` (final checkout RLS fix) |
| `cc97bc5` | wip: E2E test fixes — signUp | `AuthContext.tsx` changes | `09df7a6` (final bug fixes) |
| `09df7a6` | wip: Bug 1-3 fixes + RPC migration | Auth + fixture + spec updates | `3ed15d1` (v1.0 blockers) |
| `eabf5f3` | wip: Fix checkout RLS — invoice generation | `CheckoutModal.tsx`, `services.ts`, migration | Final state in `ef044d5` |

## 🔀 Merge Strategy Recommendation

### Why Not Cherry-Pick Individual Commits?

The 60 commits are **sequential and dependent** — each builds on the previous. Cherry-picking individual commits would break the dependency chain. For example:
- Phase 3 (services) depends on Phase 1 (migrations) and Phase 2 (types)
- Phase 6 (UI) depends on all prior phases
- E2E test fixes depend on the migrations they're testing

### Recommended: Full Merge (Option A from Git Analysis)

Since the valuable work is 52 out of 60 commits (87%), and the 8 discardable commits are just `.gitignore` tweaks and session handoff files that get cleaned up by `29d85a8`, a **clean merge is the safest approach**.

```bash
# Step 1: Backup
git branch main-backup-20260708 main
git tag backup-main-before-merge b756084

# Step 2: Merge feature into main
git merge feature/vision-v3-migration

# Step 3: Resolve conflicts (expect ~10-15 files)
# Key conflict areas:
#   - src/App.tsx (both branches modified routing)
#   - src/components/layout/Header.tsx (both modified nav)
#   - src/components/settings/Settings.tsx (feature removed currency, main polished)
#   - src/context/SupabaseAppContext.tsx (feature added capabilities)
#   - CLAUDE.md (both modified)
#   - README.md (both modified)
#   - .gitignore (both modified)

# Step 4: Verify
npm run lint
npm run build

# Step 5: Push
git push origin main
```

### Alternative: Squash Merge (Option B)

If you want a cleaner history:

```bash
# Step 1: Backup
git branch main-backup-20260708 main
git tag backup-main-before-merge b756084

# Step 2: Squash merge (all 60 commits → 1)
git merge --squash feature/vision-v3-migration

# Step 3: Review the massive diff, resolve conflicts
git diff --stat  # See what changed

# Step 4: Commit
git commit -m "feat: vision v3 — platform admin, checkout RPC, E2E tests, tier system

- Platform admin infrastructure (6 components, 7 edge functions)
- Checkout complete RPC with SECURITY DEFINER
- Cash shifts tracking
- Capability resolution system
- E2E test suite (Playwright, 8 spec files)
- Tier harness system (TIER-SPEC.md)
- Kitchen display removal (Myanmar market is printer-first)
- Multi-currency removal (Myanmar market is MMK-only)
- 24+ database migrations
- 35 unit tests across 6 files"

# Step 5: Verify & push
npm run lint && npm run build
git push origin main
```

### Post-Merge Cleanup (Either Option)

After merge, clean up the 8 discardable items that come along:

```bash
# The .continue-here files and intermediate analysis docs
# are already deleted by commit 29d85a8 (the final feature commit).
# No additional cleanup needed if doing a full merge.

# If any stray files remain:
git rm .continue-here.md 2>/dev/null
git rm .claude/.continue-here 2>/dev/null
git rm .claude/.continue-here.md 2>/dev/null

# Clean up feature branch
git branch -d feature/vision-v3-migration
git push origin --delete feature/vision-v3-migration
```

## ⚠️ Conflict Prediction

Based on both branches modifying the same files, expect conflicts in:

| File | Main Changed | Feature Changed | Conflict Type |
|------|-------------|-----------------|---------------|
| `src/App.tsx` | POS enhancements, routing | Platform admin routing, kitchen removal | Routing merge |
| `src/components/layout/Header.tsx` | UI polish | Nav wiring, kitchen removal | Nav items |
| `src/components/settings/Settings.tsx` | Coffee theme polish | Currency removal | UI + feature removal |
| `src/context/SupabaseAppContext.tsx` | Type safety | Capabilities, cash shifts | State additions |
| `src/components/pos/CheckoutModal.tsx` | POS enhancements | Checkout RPC, RLS fixes | Checkout logic |
| `CLAUDE.md` | Docs updates | Phase docs, tier system | Documentation |
| `README.md` | Codebase alignment | Tier docs | Documentation |
| `.gitignore` | Sensitive files, playwright | MCP, test-results, .env.test | Append-only |
| `src/lib/services.ts` | (not changed on main) | Service additions | Clean merge |
| `src/types/index.ts` | (not changed on main) | Type additions | Clean merge |

Most conflicts are **additive** (both sides added different things) and should resolve cleanly with manual review.

## 📋 Final Triage Table

| # | Hash | Message | Category | Reason |
|---|------|---------|----------|--------|
| 1 | `80c8b87` | chore: ignore remote schema dumps, update MCP config | 🔴 DISCARD | MCP config is tooling detail, not product code |
| 2 | `b8447dd` | chore: remove .planning directory | 🟢 KEEP | Cleanup of stale planning docs |
| 3 | `263e65e` | fix: make REVOKE conditional | 🟢 KEEP | Migration safety fix |
| 4 | `9cdf9ae` | feat(phase-1): schema alignment + checkout RPC | 🟢 KEEP | Core: migrations + database.md |
| 5 | `a9cdc21` | feat(phase-2): TypeScript types alignment | 🟢 KEEP | Core: type definitions |
| 6 | `4ad1a79` | feat(phase-3): service layer | 🟢 KEEP | Core: checkout, cashShifts, capabilities services |
| 7 | `320ec0e` | feat(phase-4): context layer | 🟢 KEEP | Core: SupabaseAppContext additions |
| 8 | `f00d10f` | feat(phase-5): auth layer | 🟢 KEEP | Core: pending approval, platform admin |
| 9 | `c447335` | feat(phase-6): UI layer | 🟢 KEEP | Core: capability gating, upgrade prompts |
| 10 | `38b7c0e` | feat(phase-7): platform admin UI | 🟢 KEEP | Core: 6 components, 7 edge functions |
| 11 | `f4f03aa` | feat(phase-8): Pro tier insights | 🟢 KEEP | Core: analytics reports |
| 12 | `e6b2d30` | feat(phase-9): test suite | 🟢 KEEP | Core: 35 tests, vitest config |
| 13 | `3398a28` | chore(phase-10): cleanup dead code | 🟢 KEEP | Core: legacy flag deprecation |
| 14 | `3bcc5b8` | feat(harness): db-guardian, safety scripts | 🟢 KEEP | Dev tooling: pre-tool-use hook |
| 15 | `17b5297` | fix(blocking): platform admin gaps | 🟢 KEEP | Critical fix: signup, capabilities |
| 16 | `e4a1820` | feat(env): hybrid environment setup | 🟢 KEEP | Environment: .env.example, types |
| 17 | `3f07a7d` | feat(db): platform_admin role | 🟢 KEEP | Migration: role constraint |
| 18 | `3a1c644` | wip: platform-admin paused at debug | 🟡 REVIEW | WIP: migration + UI tweaks (covered by later commits) |
| 19 | `b7166d2` | fix(cash_shifts): GRANT + RLS bypass | 🟢 KEEP | Migration: platform admin RLS |
| 20 | `efaf519` | wip: Playwright E2E framework | 🟡 REVIEW | WIP: initial E2E setup (cleaned by `2e102a4`) |
| 21 | `2e102a4` | feat(testing): E2E infrastructure | 🟢 KEEP | E2E: Playwright config, fixtures, onboarding |
| 22 | `ab37ba5` | chore(deps): package-lock.json | 🟢 KEEP | Dependency lockfile update |
| 23 | `86411fa` | chore: add test-results to .gitignore | 🟢 KEEP | Gitignore: test artifacts |
| 24 | `8460076` | security: add .env.test to .gitignore | 🟢 KEEP | Security: remove leaked env file |
| 25 | `ae109b9` | wip: pos-checkout E2E — 5 scenarios | 🟡 REVIEW | WIP: initial checkout spec (iterated on) |
| 26 | `21f04f3` | wip: pos-checkout E2E fixes | 🟡 REVIEW | WIP: spec fixes (iterated on) |
| 27 | `b311834` | test(e2e): POS checkout with debug | 🟢 KEEP | E2E: working checkout tests |
| 28 | `62ee5e2` | wip: fix checkout RPC — 5 migrations | 🟡 REVIEW | WIP: migrations (finalized by later commits) |
| 29 | `e2a59cd` | wip: fix checkout RPC — fixtures | 🟡 REVIEW | WIP: fixture updates (iterated on) |
| 30 | `7eec777` | wip: fix E2E — seedShop UPSERT | 🟡 REVIEW | WIP: fixture fixes (cleaned by `29d85a8`) |
| 31 | `de23f8a` | wip: fix E2E checkout — search_path | 🟡 REVIEW | WIP: spec updates (iterated on) |
| 32 | `eb40c58` | chore: cleanup SupaBase/ folder | 🟢 KEEP | Critical: removes stale `SupaBase/` dir |
| 33 | `080a77a` | wip: fix E2E — deduct_raw_materials | 🟡 REVIEW | WIP: CheckoutModal fix + migration |
| 34 | `93aa1e7` | fix: trigger search_path fixes | 🟢 KEEP | Migration: trigger safety |
| 35 | `1c402e8` | feat(e2e): POS checkout 4/5 passing | 🟢 KEEP | E2E: working test state + migration fixes |
| 36 | `23885e3` | fix: align subscription_tier constraint | 🟢 KEEP | Migration: tier name fix |
| 37 | `dd3adbc` | fix: resolve duplicate migration timestamp | 🟢 KEEP | Migration: naming fix |
| 38 | `4e58ec9` | feat: complete critical gaps | 🟢 KEEP | Migrations + RBAC/tenant tests |
| 39 | `71408cd` | wip: session handoff — tier paused | 🔴 DISCARD | Session handoff file + intermediate analysis |
| 40 | `7eee902` | feat(governance): Tier Harness System | 🟢 KEEP | Docs: TIER-SPEC.md + validation script |
| 41 | `19460ef` | fix(docs): align with TIER-SPEC.md | 🟢 KEEP | Docs: 7 files aligned |
| 42 | `b0362aa` | wip: session handoff — tier phase 2 | 🔴 DISCARD | Session handoff file |
| 43 | `5d62f39` | docs: reconcile feature-flags.md | 🟢 KEEP | Docs: feature flags alignment |
| 44 | `e1ddec7` | fix: P0 capability bugs | 🟢 KEEP | Bug fix: cash_shifts key |
| 45 | `d38fd68` | feat: remove kitchen display | 🟢 KEEP | Feature removal: Myanmar market decision |
| 46 | `d8ccd8b` | feat: add resolve_capabilities() RPC | 🟢 KEEP | Core: capabilities RPC + migration |
| 47 | `6ad0c09` | fix: add missing username to trigger | 🟢 KEEP | Migration: trigger fix |
| 48 | `ed5f5bd` | feat: remove multi_currency feature | 🟢 KEEP | Feature removal: MMK-only decision |
| 49 | `66b3380` | fix: correct feature flag wiring | 🟢 KEEP | Bug fix: 4 components |
| 50 | `34e2ebd` | feat: add routing for RecipeManager | 🟢 KEEP | Feature: routing |
| 51 | `ab51628` | fix: resolve pre-existing test failures | 🔴 DISCARD | Intermediate analysis docs |
| 52 | `6e939a5` | fix: Phase 2 E2E improvements | 🟢 KEEP | E2E: fixture + spec improvements |
| 53 | `cc97bc5` | wip: E2E test fixes — signUp | 🟡 REVIEW | WIP: AuthContext changes (covered by later) |
| 54 | `2b1acea` | wip: E2E assessment — 3 bugs | 🔴 DISCARD | Intermediate analysis doc |
| 55 | `09df7a6` | wip: Bug 1-3 fixes + RPC migration | 🟡 REVIEW | WIP: Auth + fixture fixes (covered by later) |
| 56 | `eabf5f3` | wip: Fix checkout RLS | 🟢 KEEP | Core: SECURITY DEFINER RPC |
| 57 | `145816f` | chore: exclude mcp config | 🔴 DISCARD | Tooling detail |
| 58 | `3ed15d1` | fix: resolve v1.0 blockers | 🟢 KEEP | Critical: RLS, security, dead code cleanup |
| 59 | `ef044d5` | fix: DROP FUNCTION + debt resolved | 🟢 KEEP | Migration fix + type updates |
| 60 | `29d85a8` | chore: remove trash files | 🟢 KEEP | Cleanup: removes intermediate analysis files |
