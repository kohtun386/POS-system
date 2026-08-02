# Post-Merge Cleanup Workflow

Runs after a PR is merged on GitHub by the human operator.

## Steps

```bash
# 1. Fetch and prune stale remote refs
git fetch --prune

# 2. Switch to main and pull latest
git checkout main
git pull origin main

# 3. Delete local feature branch (safe delete - fails if unmerged)
git branch -d <branch-name>
```

## Safety Checks

| Step | What | Block if false |
|------|------|----------------|
| 0 | User is NOT on main when starting? | git checkout main first |
| 1 | `git fetch --prune` succeeds | Retry once, then report |
| 2 | No uncommitted changes on main | Stash first |
| 3 | `git branch -d` fails → report | branch not fully merged → sleep report NOT to use `-D` |

## Post-Cleanup Verification
```bash
git branch --list
git log --oneline -5
```

---

## Guardrails

- Never use `-D` (force delete) — human must explicitly say "force delete <branch>"
- Never commit on `main` during cleanup
- Never push during cleanup