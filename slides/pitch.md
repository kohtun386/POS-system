---
marp: true
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
## Point-of-Sale for Independent Coffee Shops

**Stack:** React + TypeScript + Supabase + Tailwind CSS
**Theme:** Espresso & Copper
**PechaKucha 6×20** — 6 slides, 20 seconds each

---

# The Problem

## Small café owners lose time & money every shift.

- **Slow checkouts** — scribbled orders, mental math, shared tills
- **Messy inventory** — no real-time stock tracking, surprise shortages mid-rush
- **Zero customer memory** — regulars' preferences live in baristas' heads
- **Paper receipts** — lost, faded, useless for end-of-month reconciliation

**Result:** long queues, wasted beans, missed repeat business.

---

# The User

## Independent café owners & their baristas.

| Who | Needs |
|---|---|
| **Owner** | Track sales, manage stock, view reports |
| **Barista** | Fast order entry, split payments, weight-based pricing |
| **Both** | Works on counter tablet — touch-first, not mouse-first |

Role-based access: `admin` → `manager` → `cashier`
Cashiers see only the POS terminal. No distractions.

---

# Solution Sketch

## Coffee-POS: fast, warm, built for the counter.

- **Touch-friendly UI** — `.touch-friendly` mode with larger tap targets, no tiny dropdowns
- **Espresso & Copper theme** — warm browns (`#9a693a` / `#7a4f2c`), `Fraunces` headings, `DM Sans` body
- **Real-time cart** — weight-based products, automatic discount checks, split payments
- **Multi-currency** — MMK and LKR support via `CurrencyContext`
- **Sales tabs** — user-scoped, pick up where you left off
- **Role-gated navigation** — baristas stay in POS, owners access reports + settings

---

# MVP Scope

## Built & running on Supabase.

| Domain | Features |
|---|---|
| **POS Terminal** | Product grid, cart, checkout, split payments, weight-based items |
| **Inventory** | CRUD products, stock tracking, low-stock alerts |
| **Customers** | Customer list, purchase history, detail modal |
| **Discounts** | Percentage, fixed, free-gift discounts with condition engine |
| **Reports** | Sales charts (Recharts), date-range filtering |
| **Auth & RBAC** | Supabase Auth + role-based navigation |
| **Settings** | Interface mode (touch/traditional), currency, logo upload |

---

# Stretch Goals & AI Usage

## What's next. How AI helped.

### Stretch Goals
- Alert system (email/SMS low-stock + sales summary)
- Sales tab sharing between baristas
- Offline mode with local-first sync

### AI-Assisted Development (Vibe Coding Tour)
- **`pos-helper` Skill** — lint runner + Espresso & Copper theme consistency checker
- **`db-guardian` Agent** — schema safety validator against `database.types.ts`
- **Supabase MCPs** — `@supabase-db` for PostgREST queries, `@supabase-platform` for migrations, branch management, edge functions
- **Claude Code** — full-stack generation from type definitions to UI components

**Built vibe-to-vibe. Coffee shops deserve good software too.**
