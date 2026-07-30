# CoffeeShop POS — Documentation Hub

## Governance

# Document Governance

## Precedence Chain

When documents conflict, resolve in this order:

1. **VISION.md** — Business scope authority (WHAT we build)
2. **`docs/specs/tier-spec.md`** — Implementation authority (HOW we gate features)
3. **Architecture docs** — Technical design authority
4. **CLAUDE.md** — Agent instructions (derived from above)
5. **README.md** — Public summary (reflects current state)

**Rule:** When VISION.md excludes a feature but `docs/specs/tier-spec.md` lists it as active, VISION.md wins. Move the feature to `docs/specs/tier-spec.md` §2.2 Dead Keys.

## Document Audience

| Document | Audience | Purpose |
|----------|----------|---------|
| VISION.md | Product + Engineering | Business scope, WHAT we build |
| `docs/specs/tier-spec.md` | Engineering | Feature gating, HOW we implement |
| Architecture docs | Engineering | Technical design decisions |
| CLAUDE.md | Claude Code (AI) | Agent instructions |
| README.md | GitHub public | Project summary |
| docs/README.md (this doc) | Everyone | Document conflict resolution |

## Scope vs Implementation

- **Scope conflicts** (does feature X exist?): VISION.md wins
- **Implementation conflicts** (what tier is feature X?): `docs/specs/tier-spec.md` wins
- **Technical conflicts** (how do we build X?): Architecture docs win

---

## Documentation Index

# CoffeeShop POS — Documentation Index

> Master table of contents for all project documentation.
> Last updated: 2026-06-29 (aligned with VISION.md v3.0.0)

---

## Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [VISION](vision/VISION.md) | Platform vision, 14 locked decisions, subscription tiers, role model, feature flags — **source of truth** | Everyone |
| [Product Requirements (PRD)](specs/prd.md) | User personas, features, acceptance criteria, non-functional requirements | Everyone |
| [Roadmap](specs/roadmap.md) | Short-term and long-term feature roadmap | Everyone |
| [Key Decisions](architecture/decisions.md) | Technology decisions: stack, architecture, database, multi-tenancy, currency, PWA, auth | Developers |
| [Coding Patterns](architecture/patterns.md) | Conventions: component structure, service layer, state updates, RLS, naming | Developers |
| [Technical Debt](specs/technical-debt.md) | Known debt: any types, React Refresh warnings, color drift, workarounds | Developers |
| [Design System](architecture/design-system.md) | Espresso & Copper tokens, component CSS classes, typography, spacing, dark mode | Developers, Designers |

---

## Architecture

| Document | Description | Audience |
|----------|-------------|----------|
| [Database Architecture](architecture/database.md) | 18+ tables, FK map, 30+ indexes, 9 functions, RLS matrix | Backend, Full-stack |
| [Authentication](architecture/auth.md) | Auth flows, role hierarchy, permission matrix, RLS policy patterns, security posture | Backend, Full-stack |
| [State Management](architecture/state-management.md) | Provider tree, 25 reducer actions, cart persistence, data loading, checkout/tab flows | Frontend |
| [Deployment](architecture/deployment.md) | Env vars, local dev, Supabase config, build/deploy, PWA, monitoring, backup | DevOps, Full-stack |

---

## Feature Specifications

| Document | Description | Status |
|----------|-------------|--------|
| [Multi-Tenancy](specs/multi-tenancy.md) | Multi-tenant schema with shop_id foundation, 4 roles, subscription tiers | Foundation complete, dynamic config pending |
| [Inventory Model](specs/inventory-model.md) | Simplified inventory: purchase log, stock overview, low stock alerts, simple profit report | Active (v1) |
| [Inventory Alerts](specs/inventory-alerts.md) | Alert system: 5 alert types, email/SMS, templates, scheduling | Planned |
| [Feature Gating](specs/feature-gating.md) | Capability-based per-shop feature toggling, subscription tier gating (Free/Growth/Pro) | Active |
| [Tier Spec](specs/tier-spec.md) | Canonical tier definitions, capability mapping, v1.0 scope | Active |

### User Workflow Guides

User-facing guides written for shop owners and staff — no technical jargon.

| Document | Description | Audience |
|----------|-------------|----------|
| [User Onboarding](specs/user-onboarding.md) | Signup → approval → first login tour → Free tier setup → upgrade flow → grace period | New shop owners |
| [Inventory Model](specs/inventory-model.md) | Purchase log, stock overview, low stock alerts, simple profit report | Growth+ shop owners |

---

## Quick Reference

### Getting Started
1. Read the [PRD](specs/prd.md) for product context
2. Review [Key Decisions](architecture/decisions.md) for architecture rationale
3. Follow [Deployment](architecture/deployment.md) for local setup
4. Study [Coding Patterns](architecture/patterns.md) before contributing code

### By Role

**New Developer:**
- [PRD](specs/prd.md) → [Decisions](architecture/decisions.md) → [Patterns](architecture/patterns.md) → [Database](architecture/database.md) → [State Management](architecture/state-management.md)

**Backend/Focus:**
- [Database](architecture/database.md) → [Auth](architecture/auth.md) → [Multi-Tenancy](specs/multi-tenancy.md) → [Inventory Model](specs/inventory-model.md)

**Frontend/Focus:**
- [Design System](architecture/design-system.md) → [State Management](architecture/state-management.md) → [Patterns](architecture/patterns.md)

**Shop Owner / Non-Technical:**
- [User Onboarding](specs/user-onboarding.md) → [Inventory Model](specs/inventory-model.md)

**DevOps/Infra:**
- [Deployment](architecture/deployment.md) → [Multi-Tenancy](specs/multi-tenancy.md) → [Feature Gating](specs/feature-gating.md)

### Key Links

| Topic | Location |
|-------|----------|
| Component tree | [CLAUDE.md](../CLAUDE.md#architecture) |
| Service layer | `src/lib/services.ts` |
| Type definitions | `src/types/index.ts` |
| Database schema | `supabase/migrations/` |
| Reducer actions | [State Management](architecture/state-management.md) |
| CSS classes | [Design System](architecture/design-system.md) |
| RLS policies | [Auth Architecture](architecture/auth.md) |

---

## Document Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Current | Up to date, reflects current codebase |
| 🔄 In Progress | Being actively written or updated |
| 📝 Planned | Specification written, implementation pending |
| ⚠️ Outdated | Needs update — check against current code |

---

*This index is the single source of truth for documentation navigation. Update it when adding new docs.*
