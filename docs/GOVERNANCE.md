# Document Governance

## Precedence Chain

When documents conflict, resolve in this order:

1. **VISION.md** — Business scope authority (WHAT we build)
2. **tier-spec.md** — Implementation authority (HOW we gate features)
3. **Architecture docs** — Technical design authority
4. **CLAUDE.md** — Agent instructions (derived from above)
5. **README.md** — Public summary (reflects current state)

**Rule:** When VISION.md excludes a feature but tier-spec.md lists it as active, VISION.md wins. Move the feature to tier-spec §2.2 Dead Keys.

## Document Audience

| Document | Audience | Purpose |
|----------|----------|---------|
| VISION.md | Product + Engineering | Business scope, WHAT we build |
| tier-spec.md | Engineering | Feature gating, HOW we implement |
| Architecture docs | Engineering | Technical design decisions |
| CLAUDE.md | Claude Code (AI) | Agent instructions |
| README.md | GitHub public | Project summary |
| GOVERNANCE.md | Everyone | Document conflict resolution |

## Scope vs Implementation

- **Scope conflicts** (does feature X exist?): VISION.md wins
- **Implementation conflicts** (what tier is feature X?): tier-spec.md wins
- **Technical conflicts** (how do we build X?): Architecture docs win
