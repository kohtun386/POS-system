# Agent Swarm Routing — CoffeeShop POS

> **Precedence:** `.claude/CLAUDE.md` (agent rules) → `docs/specs/tier-spec.md` (implementation) → `docs/vision/VISION.md` (scope) → this map (routing).
> When this map contradicts `.claude/CLAUDE.md`, fix or discard it — the map is derived, not authoritative.

---

## 1. pr-reviewer — PR Convention Enforcer

### When to use
- Before opening **any** pull request.
- After `git-pilot` stages files and proposes a commit, but **before** the PR is created.
- After all commits are pushed to the feature branch and the diff is final.

### Must read first
- `.claude/rules/git-workflow.md` — branch naming, PR-only workflow
- `.claude/rules/migration-safety.md` — if `supabase/migrations/` is in the diff
- `.claude/CLAUDE.md` — component patterns, naming, service layer, tier gating
- `.claude/skills/design-system/SKILL.md` — CSS class conventions
- `docs/specs/tier-spec.md` — valid capability keys (18 total)

### Allowed actions
- Read git diff (`git diff main...HEAD`)
- Read changed files
- Classify findings as ❌ Blocking / ⚠️ Warning / ℹ️ Info
- Report verdict as BLOCKED / WARNINGS / CLEAN
- Recommend fixes — never apply them

### Forbidden actions
- ❌ Never commit, amend, or rewrite history
- ❌ Never push or open PRs (that's git-pilot's job)
- ❌ Never modify source files (review only)
- ❌ Never review general code quality — delegate to `gsd-code-reviewer` or `vibecode:code-reviewer`

### Output format
See `.claude/agents/pr-reviewer.md` §Output Format. Standardized verdict block:
```
---
**Verdict:** BLOCKED / WARNINGS / CLEAN
```
If BLOCKED → stop. Do not proceed to git-pilot.

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| user | pr-reviewer | Manual `@pr-reviewer` or `@git-pilot` (git-pilot gates on it) |
| pr-reviewer | git-pilot | Verdict CLEAN / WARNINGS → user decides whether to proceed |
| pr-reviewer | db-guardian | If migration files are in the diff → db-guardian must validate first |

---

## 2. db-guardian — Database Schema Safety Validator

### When to use
- **Before ANY** `supabase db push`, migration apply, or manual schema change
- When a PR diff touches `supabase/migrations/`
- When adding, modifying, or dropping a table/column/function/policy
- User says "clean test data" or "wipe test data"

### Must read first
- **LIVE Supabase schema via `list_tables`** — the authoritative source, never `database.types.ts` or `database.md` alone
- `src/lib/database.types.ts` — secondary cross-check only
- `.claude/rules/migration-safety.md` — the full checklist (RLS, shop_id, no platform_admin bypass, SECURITY DEFINER, TIMESTAMP WITH TIME ZONE, etc.)
- `docs/vision/VISION.md` §4.3 — platform admin bypasses via service_role only
- `docs/specs/multi-tenancy.md` — tenant isolation rules

### Allowed actions
- Read live schema via `supabase-platform` (management API — RLS-aware)
- Cross-check against `database.types.ts`
- Report known type/doc drift (shops missing 7 cols, sales.cashier_id missing, etc.)
- Validate CHECK constraints against TS union types (e.g., `discounts.type` expects `bogo` but DB CHECK only allows `percentage`, `fixed`, `free_gift`)
- Clean test data when explicitly asked — show SQL for human approval FIRST

### Forbidden actions
- NEVER execute a query via `supabase-db-cloud` that you're trying to validate as RLS-safe (service_role bypasses everything — the query always succeeds → false "safe" verdict)
- NEVER modify migrations or source files
- NEVER run DDL without human approval

### Output format
```markdown
## Schema Safety Report
**Operation:** <description>
**Live schema verified:** ✅ / ❌
**database.types.ts drift:** <list or "none">

### ✅ Passed
### ⚠️ Warnings
### ❌ Blocking Issues

**Recommendation:** Safe to proceed / Proceed with caution / Blocked
```

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| user | db-guardian | User about to push a migration or run schema DDL |
| pr-reviewer | db-guardian | Migration files in the PR diff |
| architecture-architect | db-guardian | Architectural change requires a migration |
| db-guardian | user | Always returns to user — user decides whether to apply |

---

## 3. git-pilot — Automated Git Workflow

### When to use
- After all work is done on a feature branch and is ready to commit → push → open PR.
- After pr-reviewer returns CLEAN (or WARNINGS that user accepts).
- When user says "commit", "push", or "open a PR."

### Must read first
- `.claude/rules/git-workflow.md` — the source of truth for branch strategy
- `pr-reviewer` output — must be CLEAN/WARNINGS before any git action

### Allowed actions
- `git branch --show-current`, `git status --short` — safely read current state
- `git reset` — clear pre-existing staged index
- `git add <specific paths>` — after user explicitly confirms which files
- `git checkout -b <branch>` — if on main, create feature branch
- `git commit -m "message"` — only after G2 (secrets scan) passes and G3 (files confirmed)
- `git push -u origin <branch>` — only after commit
- `gh pr create --base main --head <branch>` — only after push

### Forbidden actions
- ❌ NEVER `git push origin main`
- ❌ NEVER `git push --force`
- ❌ NEVER `git add -A` (blind staging)
- ❌ NEVER `gh pr merge`
- ❌ NEVER `git branch -D` without user saying "force delete"
- ❌ NEVER commit secrets (G2 scan must pass)

### Output format
```
## git-pilot — Staged Changes
**Branch:** <name>
**Files staged:** <count>

📋 Proposed Commit: <type(scope)>: <summary>

🚀 Ready to Push → gh pr create → PR URL

Next: user reviews + merges on GitHub, then local cleanup
```

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| pr-reviewer | git-pilot | CLEAN / WARNINGS — user confirms git-pilot x can proceed |
| user | git-pilot | User explicitly asks for commit/push/PR |
| git-pilot | user | PR opened — user merges, then runs local cleanup |

---

## 4. architecture-architect — Architecture Decision Authority

### When to use
- User proposes a change that touches ≥5 files or a new DB table.
- User proposes a feature that might overlap VISION.md §19 (OUT OF SCOPE)
- User asks "should we do X?" where X is a major design choice.
- Change touches Supabase schema design, platform architecture, or auth flows.

### Must read first
- `docs/vision/VISION.md` — full text, especially §19 (NOT Building)
- `docs/architecture/decisions.md` — locked ADRs
- `docs/architecture/database.md` — current schema (with caution — may be aspirational, not live)
- `docs/specs/tier-spec.md` — capability and tier gating to verify feature placement
- `docs/specs/technical-debt.md` — existing tech debt items

### Allowed actions
- Read files, architecture docs, and ADRs
- Classify proposals: `APPROVE` / `REJECT` / `PHASE`
- Suggest phase breakdowns for large changes
- Flag need for migration review (→ db-guardian)
- Flag tech debt intersections

### Forbidden actions
- NEVER write code or configuration
- NEVER approve features in VISION.md §19 OUT OF SCOPE
- NEVER approve architectural changes without explicit user confirmation

### Output format
```
**Decision:** APPROVE / REJECT / PHASE
**Rationale:** [1–2 sentences]
**Phase plan (if PHASE):** ordered steps with file references
**Dependencies:** other agents or documents
```

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| user | architecture-architect | New feature / major change / question about scope |
| architecture-architect | db-guardian | Approved change requires a migration (ADR step 3) |
| architecture-architect | onboarding-pipeline | Approved change touches auth, user flows, or platform admin |
| architecture-architect | state-refactor | Approved change touches services.ts or state management |

---

## 5. onboarding-pipeline — User Onboarding Flows

### When to use
- Modifying `src/components/platform/` or `src/components/auth/`
- Adding or changing Edge Functions under `supabase/functions/`
- Adding shop invitation flow
- **Creating a migration file for an approved Pipeline A/B onboarding change** (architecture-architect approves RLS design first)

### Must read first
- `.claude/agents/onboarding-pipeline.md` — implemented (Pipeline C) vs proposed (A, B)
- `supabase/functions/platform-admin-approve-shop` — existing Edge Function
- `again/functions/staff-create` — staff Edge Function
- `src/context/AuthContext.tsx` — auth wrapper

### Allowed actions
- Implement code ONLY for Pipeline C (Platform Admin Approval) — pipeline A and B are pure and need migration conversations first
- Reference existing UI patterns (Manager/Modal)
- Implement role checks via `shop_memberships.role` (never `users.role`)

### Forbidden actions
- NEVER implement Pipeline A (self-registration) or Pipeline B (invitation) until migrations are added
- NEVER touch checkout flow, discount startup, or reporting
- NEVER redesign auth flow or RLS (unless the change is directly scoped)
- NEVER modify DB schema without db-guardian review

### Output format
```
## Onboarding Change Report
**Pipeline:** A / B / C
**Components touched:** <list>
**Edge Functions touched:** <list>
**Migration Required:** Yes / No

### Implementation Steps
1. ...
2. ...
```

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| architecture-architect | onboarding-pipeline | Approved change involves onboarding flow |
| user | onboarding-pipeline | Direct task: add/modify an onboarding screen, invite logic, or approval queue |
| onboarding-pipeline | db-guardian | Onboarding change requires a new migration |
| onboarding-pipeline | *(self)* | Writes migration file **only** after architecture-architect approves RLS design **and** db-guardian signs off on policy |
| *(global guardrail)* | | No agent may edit an RLS policy without architecture-architect → db-guardian approval first |
| onboarding-pipeline | pr-reviewer | Implementation complete → review |

---

## 6. git-pilot — Post-Merge Cleanup (shared)

Already defined above (§3). This entry is the **post-merge cleanup** workflow only.

### When to use
- After a PR is merged on GitHub.
- User says "clean up after merge" or "sweep the branch."

### Allowed actions (cleanup context)
- `git fetch --prune` — remove remote-tracking refs for deleted branches
- `git checkout main && git pull` — sync to latest
- `git branch -d <branch>`— delete merged feature branches (safe delete, fails if unmerged)
- **NOTE:** `git branch -D` requires user saying "force delete"

### Forbidden actions
- NEVER `git push --force`
- NEVER `git push origin main`
- NEVER commit on main after merge

### Output format
```
## git-pilot — Post-Merge Cleanup
**Branch deleted:** <name>
**Local main:** <synced TARGET>
**PR link:** <url>

✅ Clean. Nb NEXT PR: ...
```

### Handoff rules
| From | To | Trigger |
|------|-----|---------|
| user | git-pilot | user says "clean up" or post-Missouri screenscrape |

---

## Agent Routing Matrix (quick reference)

| User says... | First agent | Next agent(s) |
|-------------|-------------|---------------|
| "Open a PR" or "Commit this" | pr-reviewer | git-pilot (if CLEAN) |
| "Push this migration" | db-guardian | user (if safe) |
| "Is this in scope?" or "Should I build this?" | architecture-architect | db-guardian / onboarding-pipeline / state-refactor |
| "Clean up after merge" | git-pilot | — |
| "Split services.ts" or "refactor state" | state-refactor | pr-reviewer (after impl) |
| "Add onboarding screen / Pipeline A or B" | onboarding-pipeline | architecture-architect (RLS design) → db-guardian (policy sign-off) → create migration → pr-reviewer |

## Agent Hierarchy

```
architecture-architect ←— FIRST (scope, tiers, feasibility)
    ├─→ db-guardian ←— review (migrations)
    ├─→ state-refactor ←— context (code ripples)
    └─→ onboarding-pipeline ←— auth + onboarding ripples

pr-reviewer ←— REVIEW (always runs before git-pilot)

git-pilot ←— RELEASE (pipeline not always required before commit)
```

...

## Reference

- `.claude/CLAUDE.md` — all mandatory rules
- `.claude/rules/git-workflow.md` — PR-only workflow
- `.claude/rules/migration-safety.md` — DB safety checklist, RLS recursion
- `docs/vision/VISION.md` — business scope (esp. §19)
- `docs/specs/tier-spec.md` — capability keys & tier assignments
- Capability-key changes remain enforced by `pr-reviewer` section 6 ("Valid capability keys"); `tier-spec.md` edits flow through the normal PR path.
- `docs/README.md` — document governance (precedence chain)