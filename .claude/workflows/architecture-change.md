# Architecture Change Workflow

## Decision Tree

```
U S E R proposes change
│
├─ Run: @architecture-architect
│  ├─ SCOPE CHECK ← VISION.md §19
│  │  └─ REJECT → STOP
│  ├─ ADR CHECK ← docs/architecture/decisions.md
│  │  └─ YES → create ADR first (docs/architecture/adr/)
│  ├─ TECH DEBT CHECK ← docs/specs/technical-debt.md
│  ├─ RIPPLE CHECK ← count files touched
│  │  ├─ >10 files → PHASE into pieces
│  │  ├─ ≤10 files → single pass
│  │  └─ 0 files → question the change
│  └─ DECISION: APPROVE / REJECT / PHASE
│
├─ APPROVE → implement
│  │
│  ├─ DB change? → @db-guardian
│  ├─ Auth/user flows? → @onboarding-pipeline
│  └─ State/services.ts touched? → @state-refactor
│
├─ PHASE → break into numbered steps → decide for each
│
└─ REJECT → stop (no further agent calls)
```

## ADR Template

When the change overrides a previous decision, create:

```markdown
# ADR-XXX: <title>

## Context
<what decision changed, why>

## Decision
<new rule>

## Consequences
<pros, cons, migration needed? what breaks without this>
```

ADR files go in `docs/architecture/adr/`.

## Implementation Gate (after architecture approval)

1. **Code**: write → commit → go through pr-review workflow (`.claude/workflows/pr-review.md`)
2. **Migration**: push through db-guardian (`.claude/rules/migration-safety.md`)
3. **Post-merge**: git-pilot cleanup (`.claude/workflows/post-merge-cleanup.md`)

## Guardrails

- Never implement without architecture-architect review for changes touching ≥5 files, DB, auth, or state
- VISION.md §19 is hard law — no bending wins over "it's a small change"
- Always create an ADR for overring a locked decision
- Never approve platform admin changes that bypass service_role