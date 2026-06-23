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

---

# The Solution

## Coffee-POS: fast, warm, built for the counter.

- **Touch-friendly UI** — large tap targets, no tiny dropdowns, works on iPad
- **Espresso & Copper theme** — warm browns, `Fraunces` headings, feels like a coffee shop
- **Real-time cart** — weight-based products, auto discount checks, split payments
- **Multi-currency** — MMK and LKR with live exchange rates
- **Sales tabs** — user-scoped, serve multiple customers, pick up where you left off
- **Role-gated** — baristas see POS only, owners see everything

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

---

# Built with AI

## Full-stack generation from type definitions to UI components.

- **Claude Code** — generated 48 source files, 14 migrations, 13 docs
- **`pos-helper` Skill** — lint runner + Espresso & Copper theme checker
- **`db-guardian` Agent** — schema safety validator against `database.types.ts`
- **Supabase MCPs** — PostgREST queries, migration management, edge functions
- **Documentation-Driven Development** — docs written first, code follows

**Built vibe-to-vibe. Coffee shops deserve good software too.**
