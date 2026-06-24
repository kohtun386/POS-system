# CoffeeShop POS — Documentation Index

> Master table of contents for all project documentation.
> Last updated: 2026-06-23

---

## Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
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
| [Database Architecture](architecture/database.md) | 13 tables, FK map, 30+ indexes, 9 functions, RLS matrix | Backend, Full-stack |
| [Authentication](architecture/auth.md) | Auth flows, role hierarchy, permission matrix, RLS policy patterns, security posture | Backend, Full-stack |
| [State Management](architecture/state-management.md) | Provider tree, 25 reducer actions, cart persistence, data loading, checkout/tab flows | Frontend |
| [Deployment](architecture/deployment.md) | Env vars, local dev, Supabase config, build/deploy, PWA, monitoring, backup | DevOps, Full-stack |

---

## Feature Specifications

| Document | Description | Status |
|----------|-------------|--------|
| [Multi-Tenancy](specs/multi-tenancy.md) | Multi-tenant gap analysis and migration strategy | Planned |
| [Inventory Alerts](specs/inventory-alerts.md) | Alert system: 5 alert types, email/SMS, templates, scheduling | Planned |
| [Kitchen Workflow](specs/kitchen-workflow.md) | Kitchen Display System (KDS), real-time orders, print jobs, station routing | Planned |
| [Recipe BOM](specs/recipe-bom.md) | Bill of Materials, raw materials, recipes, consumption logging, UoM conversion | Planned |
| [Feature Flags](specs/feature-flags.md) | Feature flag system for progressive rollout, A/B testing, kill switches | Planned |

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
- [Database](architecture/database.md) → [Auth](architecture/auth.md) → [Multi-Tenancy](specs/multi-tenancy.md) → [Recipe BOM](specs/recipe-bom.md)

**Frontend/Focus:**
- [Design System](architecture/design-system.md) → [State Management](architecture/state-management.md) → [Patterns](architecture/patterns.md) → [Kitchen Workflow](specs/kitchen-workflow.md)

**DevOps/Infra:**
- [Deployment](architecture/deployment.md) → [Multi-Tenancy](specs/multi-tenancy.md) → [Feature Flags](specs/feature-flags.md)

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
