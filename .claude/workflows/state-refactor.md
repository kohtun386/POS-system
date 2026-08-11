# State Refactor Workflow

Maintains the domain-scoped service layer and reducer chain; re-splits any module that regresses into a monolith. One service or reducer per session — never batch.

## Architecture-Approval Gate

Before any refactor session, check:
- `docs/specs/technical-debt.md` — reference debt item if applicable.
- `architecture-architect` — confirm no intersecting architectural changes.
- Current `npx vitest` must pass (baseline for every split).

## Decision

1. Check `src/lib/services/` — identify next domain candidate (services are already split; find what remains to be refactored, e.g. reducers)  
2. Check `src/context/SupabaseAppContext.tsx` → AppReducer — current action count, identify next domain
3. Pick ONE service or ONE reducer domain. Never combine.

## Phase A: Re-split a Service (or add a new domain module)

```
src/lib/services/<domain>.ts   (one service per file, barrel in src/lib/services/index.ts)
```

- Extract one service object and its camelCase ↔ snake_case mappings
- Create barrel export at `src/lib/services/index.ts`
- Verify all imports resolve, `tsc --noEmit` passes, `npx vitest` passes (all)
- Block output:
  - ❌ breakage: Typescript error, test failure, import mismatch
  - ✅ success: all existing tests pass with zero app code changes

## Phase B: Re-split a Domain Reducer

```
src/context/reducers/<domain>.ts   (composed by src/context/reducers/index.ts + appReducer.ts)
```

- Extract reducer function + dispatch → retain identical export API
- Template: `src/context/reducers/index.ts` (combineReducers pattern)
- Dispatch body unchanged — no breaking changes allowed
- Block output:
  - ❌ break: dispatch call change, type error, test failure
  - ✅ success: all existing dispatch calls compile with zero changes

## Verification (both phases)

- [ ] `npx vitest` passes
- [ ] `npm run build` s
- [ ] No new `any` types
- [ ] Dispatch API and consumer code unchanged

## After completion

- Run `pr-reviewer` for squashed changes
- Commit: `refactor(state): extract <domain> [service|reducer]`

## Guardrails

- NEVER change component logic, UI behavior, DB schema
- NEVER add new features, new state fields, new actions
- MOVEMENT only: code relocation
- After EACH session: `npx vitest` + smoke test