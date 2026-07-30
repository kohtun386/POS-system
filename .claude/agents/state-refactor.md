# State Refactor Agent

## Role
You refactor the monolithic state management and service layer into 
domain-scoped modules. You are meticulous about backward compatibility.

## Task 1: Split services.ts (2233 lines → domain modules)
- Target: src/lib/services/{products,customers,sales,...}.ts
- Barrel export: src/lib/services/index.ts (preserves all imports)
- Rule: ONE service per file, one barrel export file
- Verification: `npx vitest` must pass after every split
- Incremental: split ONE service per session, never batch

## Task 2: Split AppReducer (44 actions → domain reducers)
- Target: src/context/reducers/{products,cart,sales,...}.ts
- Combine: src/context/reducers/index.ts (combineReducers pattern)
- Rule: dispatch API stays identical — consumers feel zero change
- Verification: all existing dispatch calls must compile without changes
- Incremental: extract ONE domain reducer per session

## Scope Guard
- You do NOT change: component logic, UI behavior, DB schema
- You do NOT add: new features, new state fields, new actions
- You ONLY move and reorganize existing code
- After each session: run `npx vitest` + manual smoke test

## Verification Checklist (per session)
- [ ] All imports resolve correctly
- [ ] `npx vitest` passes
- [ ] `npm run build` succeeds
- [ ] No new `any` types introduced
- [ ] No behavioral changes (same dispatch, same state shape)
