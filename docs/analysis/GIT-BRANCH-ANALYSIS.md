# Git Branch Mess Analysis Report

**Date:** 2026-07-08
**Status:** READ-ONLY ANALYSIS
**Branch:** `main`

## 📊 Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Current Branch | `main` (b756084) | ✅ Clean, up to date with origin |
| Local Branches | 2 (`main`, `feature/vision-v3-migration`) | ✅ |
| Remote Branches | 2 (`main`, `feature/vision-v3-migration`) | ✅ |
| Uncommitted Changes | 0 | ✅ Working tree clean |
| Stashed Changes | 1 (Cart/Checkout refactor) | ⚠️ Stale stash |
| Case Sensitivity Issues | **Yes** — `SupaBase/` (capital B) tracked on main | 🔴 |
| Git Corruption | No | ✅ |
| Feature Branch Divergence | 60 ahead, 15 behind main | 🔴 |

## 🔴 Critical Issues Found

### Issue 1: `SupaBase/` (Capital B) Directory Tracked on `main`

- **Severity:** Critical
- **Evidence:** `git ls-files | grep -i supabase` shows both `SupaBase/` and `supabase/` tracked:
  ```
  SupaBase/inventory_alerts_schema.sql
  SupaBase/migration_add_payments_column.sql
  SupaBase/supabase_currency_schema.sql
  SupaBase/supabase_init.sql
  ```
  The `SupaBase/` directory **exists on disk** and contains 4 stale SQL files from early development.
- **Impact:** On Linux (case-sensitive FS), these are two distinct directories. If someone clones on macOS/Windows (case-insensitive), git may silently drop one set. The feature branch attempted to clean this up (commit `eb40c58 chore: cleanup SupaBase/ folder`) but the deletion never reached `main`.
- **Recommended Fix:** Delete `SupaBase/` from `main`. These files are superseded by proper migrations in `supabase/migrations/`.

### Issue 2: 60-Commit Divergence Between `main` and Feature Branch

- **Severity:** High
- **Evidence:**
  ```
  git rev-list --left-right --count main...feature/vision-v3-migration
  15  60
  ```
  - **60 commits on feature not in main:** Platform admin, E2E tests, 24+ new migrations, kitchen display removal, checkout RPC, cash shifts, capability resolution, etc.
  - **15 commits on main not in feature:** Docs (ch-5 interview notes, README), accessibility, POS terminal enhancements, UI polish, Vitest setup, type safety improvements.
  - **Common ancestor:** `69b52b5`
- **Impact:** A merge will have significant conflicts. The feature branch has large structural changes (deleted kitchen components, new platform admin infrastructure, new edge functions) while main has UI/docs work that the feature branch lacks.
- **Recommended Fix:** Merge feature into main, resolving conflicts. The feature branch contains the core product work; main has polish/docs.

### Issue 3: Stale Stash with Major Cart/Checkout Refactor

- **Severity:** Medium
- **Evidence:**
  ```
  stash@{0}: WIP on main: 92393d0 feat: theme Espresso & Copper into components
  ```
  Contents (1,035 lines changed):
  ```
  src/components/pos/Cart.tsx         | 173 ++++-
  src/components/pos/CheckoutModal.tsx | 827 ++-------------------
  src/components/pos/POSTerminal.tsx   |  33 +-
  src/components/transactions/TransactionsManager.tsx | 2 +-
  ```
- **Impact:** This stash appears to be a significant cart/checkout refactor (CheckoutModal shrunk by 823 lines, likely extracted to Cart.tsx). It may be outdated given the feature branch also modified CheckoutModal.
- **Recommended Fix:** Inspect the stash contents (`git stash show -p stash@{0}`), evaluate relevance, and either apply or discard.

## 📋 Detailed Findings

### 1. Branch Status

**Current branch:** `main` at `b756084` (up to date with `origin/main`)

**Local branches:**
| Branch | Commit | Message | Tracking |
|--------|--------|---------|----------|
| `* main` | `b756084` | ch-5: add user interview notes | origin/main ✅ |
| `feature/vision-v3-migration` | `29d85a8` | chore: remove trash files and stale docs | origin/feature/vision-v3-migration ✅ |

**Remote branches:** Both exist on remote at matching commits (no drift).

### 2. Case Sensitivity Check

**`core.ignorecase`:** Not set (defaults to false on Linux — good)

**Files tracked with "supabase" in path (case-insensitive):**
| Path | Directory | Notes |
|------|-----------|-------|
| `SupaBase/inventory_alerts_schema.sql` | Capital B | 🔴 Stale, superseded by migrations |
| `SupaBase/migration_add_payments_column.sql` | Capital B | 🔴 Stale |
| `SupaBase/supabase_currency_schema.sql` | Capital B | 🔴 Stale |
| `SupaBase/supabase_init.sql` | Capital B | 🔴 Stale |
| `src/context/SupabaseAppContext.tsx` | CamelCase | ✅ Correct (PascalCase component) |
| `src/lib/supabase.ts` | lowercase | ✅ Correct |
| `supabase/*` | lowercase | ✅ Correct (21 migration files + config) |

**Filesystem:** Both `/SupaBase/` and `/supabase/` exist on disk. No duplicate paths with different cases detected in `git ls-files`.

**Feature branch cleanup attempt:** Commit `eb40c58` ("chore: cleanup SupaBase/ folder") on the feature branch deleted these files, but this change is not in `main`.

### 3. Feature Branch Analysis

**Divergence:** `main` is 15 commits behind, 60 commits ahead of feature branch (relative to merge-base `69b52b5`).

**Feature branch added (not in main):**
- Platform admin infrastructure (6 new components, 7 edge functions)
- E2E test suite (8 spec files, 3 fixture files)
- 24+ new database migrations (checkout RPC, cash shifts, platform admin RLS, inventory alerts)
- PendingApprovalPage, UpgradePrompt, FeatureDefinitions
- OwnerInsights, ProfitMarginAnalytics, WasteTracking, WhatsAppReportConfig
- Checkout complete RPC, cash shifts service, capabilities resolution
- Vitest config, Playwright config, validate-tiers script

**Feature branch deleted (not in main):**
- Kitchen display components (KitchenDisplay, KitchenOrderCard, KitchenSettings, KitchenStats)
- ExchangeRateManager, CurrencyDisplay, useRealtimeSubscription
- `.planning/` directory (all planning docs)
- Old SupaBase/ files (but not on main!)

**Main has (not in feature):**
- Ch-5 docs (interview notes, tech-stack slide deck)
- README alignment
- Accessibility improvements (focus states, skip link, reduced motion)
- POS terminal enhancements (cart controls, checkout, micro-interactions)
- UI polish (product cards, cart, settings layout)
- Vitest + React Testing Library setup
- Type safety improvements (103 → 32 any errors)

### 4. Migration Files

**On disk:** 21 SQL files in `supabase/migrations/`
**On main (git tracked):** 21 migration files (matching disk)
**On feature branch:** Additional migrations added (20260630-20260705 range)

**Recent migration commits on feature branch:**
- `20260630000001_checkout_complete_rpc.sql` — SECURITY DEFINER RPC for checkout
- `20260630000002_cash_shifts.sql` — Cash shift tracking
- `20260702000001-04` — Platform admin role + RLS bypass
- `20260703000001-10` — Inventory alerts, cash shifts grants, checkout fixes
- `20260704000001-05` — Tier name fixes, trigger cleanup, capabilities RPC
- `20260705000001` — Revoke anon execute on critical functions

### 5. Working Directory

- **Uncommitted changes:** None (clean)
- **Untracked files:** None
- **Stashed changes:** 1 stash — Cart/Checkout refactor (4 files, ~1,035 lines)
- **Lock files:** None (no interrupted git operations)

### 6. Reflog (Recent Activity)

The reflog shows clean history — no branch switch chaos. Recent activity:
- Commits on main (docs, UI, accessibility)
- One `reset: moving to HEAD~1` at `9152641` (commit `c9dc96e` was reset)
- One branch switch from feature to main at `69b52b5`
- Feature branch commits (platform admin, E2E, migrations)

### 7. Git Health

- **fsck:** No errors
- **Index:** 170 tracked files
- **Disk:** 15M `.git/` directory
- **Objects:** 1,573 loose objects, 1 pack file
- **No lock files** (no interrupted operations)

## 🎯 Recommended Action Plan

### Option A: Safe — Clean Main First, Then Merge

**Steps:**
1. On `main`: `git rm -r SupaBase/` and commit
2. Resolve any stash conflicts: inspect stash, decide to apply or drop
3. `git merge feature/vision-v3-migration` from main
4. Resolve conflicts (expect ~10-15 files based on overlapping changes)
5. Run `npm run lint` and verify build
6. Push main

**Pros:** Clean history, each step is atomic and reviewable
**Cons:** More steps, merge conflicts need manual resolution
**Risk Level:** Low
**Time Estimate:** 20-30 minutes

### Option B: Hybrid — Feature Branch as New Main

**Steps:**
1. On `main`: `git rm -r SupaBase/` and commit
2. Create backup branch: `git branch main-backup main`
3. Checkout feature branch
4. Merge main into feature: `git merge main` (resolves the 15 divergent commits)
5. If clean: fast-forward main to feature, or swap branches
6. Force-push (or delete + recreate) main from feature
7. Delete feature branch

**Pros:** Feature branch becomes the new main, includes all new work
**Cons:** Requires force-push or branch swap, more complex
**Risk Level:** Medium
**Time Estimate:** 15-25 minutes

### Option C: Aggressive — Squash Merge Feature into Main

**Steps:**
1. On `main`: `git rm -r SupaBase/` and commit
2. `git merge --squash feature/vision-v3-migration` (squashes 60 commits into 1)
3. Review the diff, resolve conflicts
4. Commit as single "feat: vision v3 — platform admin, E2E tests, checkout RPC" or similar
5. Push main
6. Optionally delete feature branch

**Pros:** Clean single-commit history, easy to revert if needed
**Cons:** Loses individual commit history from feature branch, harder conflict resolution (all at once)
**Risk Level:** Medium
**Time Estimate:** 15-20 minutes

## ⚠️ DO NOT Do These Things

- `git reset --hard` on main (production is deployed from here)
- `git clean -fd` without checking untracked files first
- Delete the feature branch before merging its work
- Force-push main without a backup branch
- Merge main into feature without first cleaning up `SupaBase/` (it'll create case-conflict confusion)
- Ignore the stash — if it's relevant, it'll bit-rot; if not, drop it cleanly
- Apply the stash blindly — CheckoutModal.tsx was also changed on the feature branch

## 📝 Backup Recommendations

Before any fix, create these backups:
1. **Branch backup:** `git branch main-backup-20260708 main` (safety net for main)
2. **Feature branch snapshot:** `git branch feature-backup-20260708 feature/vision-v3-migration`
3. **Export stash:** `git stash show -p stash@{0} > /tmp/stash-export.patch` (preserve the stash diff)
4. **Tag current main:** `git tag backup-main-before-merge b756084` (permanent reference point)
