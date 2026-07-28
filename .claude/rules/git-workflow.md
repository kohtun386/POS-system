# Git Workflow Rules (MANDATORY — Safety First)

## Branch Strategy — PR-Only, Never Direct to Main
1. NEVER commit or push directly to `main`.
2. For EVERY change:
   - `git checkout -b <type>/<description>` (e.g. `feat/recipe-bom`, `fix/rls-recursion`)
   - Commit with conventional message (`feat:`, `fix:`, `docs:`, `refactor:`)
   - `git push -u origin <branch>`
   - Open PR: `gh pr create --base main --head <branch>`
3. Merging is a human decision (Ko Htun). You open the PR; he merges.

## Forbidden
- ❌ `git push origin main` (direct push)
- ❌ `git push --force` on main (or any shared branch)
- ❌ Committing secrets (.env, API keys) — use env vars