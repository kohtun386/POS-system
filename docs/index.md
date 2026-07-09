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
| [Inventory Alerts](specs/inventory-alerts.md) | Alert system: 5 alert types, email/SMS, templates, scheduling | Planned |
| [Kitchen Workflow](specs/kitchen-workflow.md) | ~~Kitchen Display System (KDS)~~ — Deprecated. Kitchen printer routing via `printer_integration` (Growth). | Deprecated |
| [Recipe BOM](specs/recipe-bom.md) | Bill of Materials, raw materials, recipes, consumption logging, UoM conversion | Planned |
| [Feature Flags](specs/feature-flags.md) | Capability-based per-shop feature toggling, subscription tier gating (Free/Growth/Pro) | Planned |
| [Waste Tracking](specs/waste-tracking.md) | Recording spoiled/damaged ingredients, waste reports, impact on profitability | Pro tier — Planned |

### User Workflow Guides

User-facing guides written for shop owners and staff — no technical jargon.

| Document | Description | Audience |
|----------|-------------|----------|
| [User Onboarding](specs/user-onboarding.md) | Signup → approval → first login tour → Free tier setup → upgrade flow → grace period | New shop owners |
| [Recipe & Inventory](specs/recipe-bom-user-workflow.md) | Raw materials, recipes, auto-deduction, stock levels, low stock alerts, COGS, profit margins | Growth+ shop owners |
| [Waste Tracking](specs/waste-tracking.md) | Recording waste, waste reports, analyzing waste impact on profitability | Pro tier shop owners |

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
- [Design System](architecture/design-system.md) → [State Management](architecture/state-management.md) → [Patterns](architecture/patterns.md)

**Shop Owner / Non-Technical:**
- [User Onboarding](specs/user-onboarding.md) → [Recipe & Inventory](specs/recipe-bom-user-workflow.md) → [Waste Tracking](specs/waste-tracking.md)

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
