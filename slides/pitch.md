---
marp: true
auto-advance: 20
theme: default
paginate: true
backgroundColor: #faf8f5
color: #473b32
style: |
  section {
    font-family: 'DM Sans', sans-serif;
    padding: 60px 80px;
  }
  h1 {
    font-family: 'Fraunces', serif;
    color: #7a4f2c;
  }
  h2 {
    font-family: 'Fraunces', serif;
    color: #9a693a;
  }
  strong {
    color: #e55c13;
  }
---

# Coffee-POS
## Point-of-Sale for Myanmar Coffee Shops

**Stack:** React + TypeScript + Supabase + Tailwind CSS
**Theme:** Espresso & Copper
**PechaKucha 6×20** — 6 slides, 20 seconds each

<!-- Speaker Notes (20s):
This is Coffee-POS — a web-based point-of-sale built specifically for Myanmar coffee shops. React, TypeScript, Supabase, and a custom Espresso & Copper design system. Six slides, twenty seconds each. Let's go.
-->

---

# The Problem

## Small café owners in Myanmar lose time & money every shift.

- **Slow checkouts** — scribbled orders, mental math, shared tills
- **Messy inventory** — no real-time stock tracking, surprise shortages mid-rush
- **Zero customer memory** — regulars' preferences live in baristas' heads
- **No local payment support** — generic POS systems don't handle KBZpay, WavePay, AYAPay

**Owner** needs reports & stock control.
**Barista** needs fast touch entry & split payments.
Both need it on a counter tablet — touch-first, not mouse-first.

<!-- Speaker Notes (20s):
Café owners in Myanmar face four problems every shift. Slow checkouts with mental math. No stock tracking — beans run out mid-rush. Customer preferences live only in baristas' heads. And generic POS systems don't support local payments like KBZpay or WavePay. Owners need reports. Baristas need speed. Both need it on a tablet.
-->

---

# The Solution

## Coffee-POS: fast, warm, built for the counter.

- **Touch-friendly UI** — large tap targets, no tiny dropdowns, works on iPad
- **Espresso & Copper theme** — warm browns, `Fraunces` headings, feels like a coffee shop
- **Real-time cart** — weight-based products, auto discount checks, split payments
- **Multi-currency** — MMK and LKR with live exchange rates
- **Sales tabs** — user-scoped, serve multiple customers, pick up where you left off
- **Role-gated** — baristas see POS only, owners see everything

<!-- Speaker Notes (20s):
Coffee-POS is touch-first — large tap targets designed for iPad on a counter. The Espresso & Copper theme feels warm, not clinical. Real-time cart with weight-based pricing, automatic discounts, and split payments. Multi-currency for MMK and LKR. Sales tabs let baristas serve multiple customers. Role-based: baristas see POS only, owners see everything.
-->

---

# Core Features

## Everything a coffee shop needs. Nothing it doesn't.

| Domain | What's Built |
|---|---|
| **POS Terminal** | Product grid, cart, checkout, 9 payment methods, weight-based items |
| **Inventory** | CRUD products, stock tracking, batch expiry, low-stock alerts |
| **Customers** | Credit system, price tiers, purchase history |
| **Discounts** | Percentage, fixed, free-gift with 6 condition types |
| **Reports** | Sales trends, category charts, inventory analytics, CSV export |
| **Auth & RBAC** | Supabase Auth, 3 roles, RLS on every table |

<!-- Speaker Notes (20s):
Six domains, all built. POS terminal with 9 payment methods and weight-based items. Inventory with batch tracking and low-stock alerts. Customer credit system with price tiers. A discount engine with 6 condition types that auto-apply at checkout. Reports with charts and CSV export. Auth with 3 roles and row-level security on every table.
-->

---

# Multi-Tenant Architecture

## One codebase, many shops. Data isolated by design.

- **`shop_id` on all 18 tables** — every row scoped to its shop
- **RLS policies** — `current_shop_ids()` helper, no cross-shop data leaks
- **Per-shop config** — each shop owns its name, currency, tax rate, invoice prefix
- **`shop_memberships`** — users can be admin at Shop A, cashier at Shop B
- **`business_type` column** — future feature toggling per shop category
- **Single deployment** — one Vercel build serves all tenants

Schema foundation is live. Shop switching UI is next.

<!-- Speaker Notes (20s):
The architecture is multi-tenant. Every table has a shop_id column. Row-level security ensures no shop sees another shop's data. Each shop configures its own name, currency, tax rate, and invoice prefix. Users can have different roles at different shops. One deployment on Vercel serves all tenants. The schema is live — shop switching UI is next.
-->

---

# Built with AI

## Full-stack generation from type definitions to UI components.

- **Claude Code** — generated 48 source files, 14 migrations, 13 docs
- **`pos-helper` Skill** — lint runner + Espresso & Copper theme checker
- **`db-guardian` Agent** — schema safety validator against `database.types.ts`
- **Supabase MCPs** — PostgREST queries, migration management, edge functions
- **Documentation-Driven Development** — docs written first, code follows

**Built vibe-to-vibe. Coffee shops deserve good software too.**

<!-- Speaker Notes (20s):
This entire project was built with AI assistance. Claude Code generated 48 source files, 14 migrations, and 13 documentation files. Custom skills handle linting and schema validation. Supabase MCPs manage the database. We practiced Documentation-Driven Development — docs written first, code follows. Built vibe-to-vibe. Coffee shops deserve good software too.
-->
