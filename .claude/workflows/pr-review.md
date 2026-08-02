# PR Workflow

Sequential review → git pipeline for every pull request.

## Decision Tree

```
START
│
├─ Migration files in diff?
│  ├─ YES → db-guardian ⛔ (validate schema → Safe to proceed?)
│  │  ├─ Safe → pr-reviewer →
│  │  └─ Blocked → STOP
│  └─ NO  → pr-reviewer
│
├─ pr-reviewer verdict?
│  ├─ CLEAN → git-pilot → ⛔ HUMAN MERGE
│  ├─ WARNINGS → user accepts? → git-pilot → ⛔ HUMAN MERGE
│  └─ BLOCKED → STOP (fix, then re-run pr-reviewer)
│
└─ MERGED on GitHub?
   └─ git-pilot → post-merge-cleanup
```

## Steps

### 1. Diff Discovery
- `git diff main...HEAD --stat` — count files and lines
- If `supabase/migrations/*.sql` present → flag.

### 2. Gate: Migration Safety (if applicable)
- `@db-guardian` validates live schema against migration
- `@<db-guardian>` returns Safe to proceed / Proceed with caution / Blocked
- Blocked → fix migration, re-check. Never skip.

### 3. pr-reviewer (always)
- `@pr-reviewer` reads full diff → classifies findings
- Cost:
  - Accepted → plug into proposed commit message body
  - Rejected → fix locally, restart from Step 3.

### 4. git-pilot
- G1: Branch safety
- G2: Scan for secrets → abort if found
- G3: Show status; confirm exact files to stage
- G4: Propose branch name, commit message
- G5: Commit
- G6: Push

### 5. PR Open
- `gh pr create --base main --head <branch>` (git-pilot creates)
- Never merge locally — Ko Htun merges on GitHub.

### 6. Post-Merge
- `git fetch --prune && git checkout main && git pull && git branch -d <branch>`

---

## Guardrails
- Never push to main
- Never git-pilot ahead of pr-reviewer
- Never merge (human user merges on GitHub)
- Never bypass db-guardian for migration diffs