# Key Technology Decisions — CoffeeShop POS

Synthesized from existing documentation. Each decision links to its source.

---

## Stack Choices

### Frontend: React 18.3 + TypeScript 5.5 (strict) + Vite

**What:** React SPA with strict TypeScript, Vite bundler, no framework (no Next.js/Remix).

**Why:** Lightweight POS terminal doesn't need SSR. Vite offers fast HMR and build. Strict TS catches category/sku/type errors at compile time. Team familiar with React.

**Source:** `CLAUDE.md`

### Backend: Supabase (BaaS)

**What:** Supabase for auth, database (Postgres), real-time, and storage. No custom backend server.

**Why:** Eliminates server maintenance. Built-in auth, RLS, and Postgres. Row Level Security provides per-table access control without custom middleware. Edge Functions available for admin operations that need service_role key.

**Source:** `CLAUDE.md`, `docs/architecture/deployment.md`

### Styling: Tailwind CSS 3.4 with Espresso & Copper Theme

**What:** Tailwind utility-first CSS with a custom warm brown/copper color palette. No component library (no MUI/Chakra).

**Why:** Custom POS UI needs full design control. Tailwind's utility classes map directly to the design system tokens. Custom palette gives the coffee shop brand identity. Dark mode via `class` strategy.

**Source:** `CLAUDE.md`, `docs/architecture/design-system.md`

### Animations: Framer Motion

**What:** Framer Motion for component animations (whileHover, whileTap, AnimatePresence for cart items).

**Why:** Declarative React animation API. Cart item enter/exit, modal transitions, and micro-interactions without manual CSS keyframes.

**Source:** `CLAUDE.md`

### Charts: Recharts

**What:** Recharts for sales/inventory/customer reports (LineChart, PieChart).

**Why:** React-native chart library. Adequate for POS reporting needs. No heavy BI tooling required.

**Source:** `CLAUDE.md`

### Notifications: SweetAlert2

**What:** SweetAlert2 for all user-facing toasts and confirmation dialogs. Custom-themed to match Espresso & Copper palette.

**Why:** Rich toast API (success/error/warning/loading/confirm). Custom CSS classes for brand consistency. Replaces raw browser alerts.

**Source:** `CLAUDE.md`, `src/lib/sweetAlert.ts`

---

## Architecture Decisions

### State Management: useReducer (not Redux/Zustand)

**What:** Single `useReducer` in `SupabaseAppContext.tsx` holds all app state. 25 action types. No external state library.

**Why:** App complexity doesn't justify Redux overhead. useReducer provides predictable state transitions with dispatch. Cart, products, customers, sales, users, discounts, settings, and sales tabs all in one reducer. Simpler mental model for a small team.

**Source:** `docs/architecture/state-management.md`

### Service Layer Pattern (not direct Supabase calls)

**What:** 12 service objects in `src/lib/services.ts`. All DB access through services, never `supabase.from()` in components.

**Why:** Centralizes camelCase ↔ snake_case mapping. Single place to change query logic. Components stay focused on UI. Services are testable independently.

**Source:** `CLAUDE.md`

### Lazy-Loaded Route Components

**What:** All view components (POSTerminal, TransactionsManager, InventoryManager, etc.) lazy-loaded via `React.lazy()` + `Suspense`.

**Why:** POS terminal is the primary view — other views (reports, settings, user management) shouldn't block initial load. Code-splitting reduces initial bundle size.

**Source:** `src/App.tsx`

### Provider Tree Hierarchy

**What:** `ThemeProvider → AuthProvider → AppProvider → CurrencyProvider → AppContent`

**Why:** AppProvider depends on `useAuth()`. CurrencyProvider is independent but logically inside App. Theme wraps everything for dark mode support. This exact order is required.

**Source:** `docs/architecture/state-management.md`

---

## Database Decisions

### Row Level Security on All Tables

**What:** Every table has RLS enabled. Policies grant access based on role and shop membership.

**Why:** Supabase exposes Postgres directly to the client via PostgREST. Without RLS, any authenticated user could read/write any row. RLS is the primary security boundary.

**Source:** `docs/architecture/auth.md`

### JSONB for Flexible Fields

**What:** `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` stored as JSONB columns.

**Why:** Sale items and payment breakdowns have variable structure. JSONB avoids complex join tables for nested data. Typed at the application layer via TypeScript interfaces.

**Source:** `CLAUDE.md`, `docs/architecture/database.md`

### shop_id Placeholder Added Now (ADR-003)

**What:** `shop_id UUID NOT NULL` column added to all 13 existing tables with a hardcoded default shop UUID. `shops` and `shop_memberships` tables created. No UI yet.

**Why:** Cost of adding later is 5-10x higher — production data backfill, 51+ RLS policy rewrites, service layer breaking changes, index creation on large tables. Adding now is a single migration with zero behavior change.

**Source:** `docs/architecture/adr/003-shop-id-placeholder-now.md`

### snake_case in DB ↔ camelCase in TypeScript

**What:** All Postgres columns use `snake_case`. All TypeScript interfaces use `camelCase`. Service layer handles the mapping in both directions.

**Why:** Postgres convention is snake_case. JavaScript/TypeScript convention is camelCase. Mapping in services keeps both layers idiomatic.

**Source:** `CLAUDE.md`

### Dates as TIMESTAMP WITH TIME ZONE

**What:** All date columns are `TIMESTAMP WITH TIME ZONE`. Hydrated to `new Date()` in services.

**Why:** Timezone-aware storage prevents ambiguity. Frontend converts to local time for display.

**Source:** `CLAUDE.md`

---

## Multi-Tenancy Approach

### shop_id on All Tables from Day One

**What:** Every table has `shop_id` FK to `shops` table. Default shop seeded. All users linked via `shop_memberships`.

**Why:** Retrofitting multi-tenancy onto production data with real customers is 5-10x more expensive. Schema foundation laid now, UI built later.

**Source:** `docs/architecture/adr/003-shop-id-placeholder-now.md`, `docs/specs/multi-tenancy.md`

### Per-Shop Roles via shop_memberships

**What:** `shop_memberships` table with `user_id`, `shop_id`, `role`, `is_active`. A user can be admin at Shop A and cashier at Shop B.

**Why:** Global `users.role` doesn't support multi-shop scenarios. Per-shop membership allows role flexibility.

**Source:** `docs/specs/multi-tenancy.md`

### RLS Scoped via current_shop_ids()

**What:** All RLS policies include `AND shop_id IN (SELECT public.current_shop_ids())`. The helper function returns shop IDs from the user's active memberships.

**Why:** Single function to query — avoids duplicating the membership subquery in every policy. Change the scoping logic in one place.

**Source:** `docs/architecture/auth.md`

### Phased Migration

**What:** Chunk 1 (schema) → Chunk 2 (RLS rewrite) → Chunk 3 (service layer). Each chunk is independently deployable.

**Why:** Reduces risk. Schema changes are zero-behavior-change. RLS rewrite is medium-risk. Service layer is frontend-only.

**Source:** `docs/architecture/adr/003-shop-id-placeholder-now.md`

---

## Currency & Myanmar Market

### Multi-Currency Support with Exchange Rate Providers

**What:** `currency_config`, `exchange_rates`, `exchange_rate_history` tables. Three API providers (Fixer.io, CurrencyLayer, ExchangeRate-API) plus manual fallback. 5-minute cache on rates.

**Why:** Coffee shop operates in Myanmar (MMK) with possible USD/LKR pricing. Exchange rates change daily. Manual override needed for offline scenarios.

**Source:** `docs/architecture/database.md`, `src/lib/currencyUtils.ts`, `src/lib/exchangeRateService.ts`

### Myanmar Payment Methods

**What:** Payment methods include `kbzpay`, `wavepay`, `ayapay`, `cbpay`, `mpu` in addition to standard `cash`, `card`, `digital`, `credit`.

**Why:** Myanmar market uses mobile payment apps extensively. These are primary payment methods, not add-ons.

**Source:** `src/types/index.ts`, `src/components/pos/CheckoutModal.tsx`

### Sri Lankan Bank List for Card Payments

**What:** 20 Sri Lankan banks listed in CheckoutModal for card payment bank selection.

**Why:** Card payments require bank identification for discount conditions (`bank_name` condition type). Sri Lankan market context.

**Source:** `src/components/pos/CheckoutModal.tsx`

---

## PWA Decision

### Option A: Soft-Offline

**What:** Installable iPad app with cached UI shell. Cart survives refresh. Supabase API calls use NetworkFirst (5-second timeout). Google Fonts cached for 1 year.

**Why:** Coffee shop has intermittent connectivity. Cart persistence prevents lost sales during brief outages. Full offline checkout (Option C) deferred to post-beta based on real connectivity data.

**Source:** `docs/specs/roadmap.md`

---

## Auth Decisions

### Supabase Auth with DB Trigger for Profile Creation

**What:** `handle_new_auth_user()` trigger on `auth.users` INSERT creates `public.users` profile row automatically. Frontend never INSERTs into users table directly.

**Why:** Ensures every auth user has a profile. Trigger runs server-side with elevated privileges. Frontend fetches the trigger-created profile after signUp.

**Source:** `docs/architecture/auth.md`

### Admin Creates Users via signUp + Session Save/Restore

**What:** Admin's `signUp()` call replaces current session. Code saves admin session before signUp, restores it after, then UPDATEs the new user's profile with admin-chosen role.

**Why:** Supabase Auth has no admin "create user" API that doesn't change session. This is the documented workaround.

**Source:** `docs/architecture/auth.md`

### Three Roles: admin, manager, cashier

**What:** `admin` = full access, `manager` = POS + operations + reports (no user management), `cashier` = POS only.

**Why:** Coffee shop has owner (admin), shift supervisors (manager), and baristas (cashier). Role enforced in both UI (App.tsx renderCurrentView, Header nav items) and database (RLS policies).

**Source:** `docs/architecture/auth.md`

---

## Security Decisions

### service_role Key Removed from Client Bundle

**What:** The `supabaseAdmin` client using `VITE_SUPABASE_SERVICE_ROLE_KEY` was removed. Admin operations require Edge Functions.

**Why:** `VITE_` prefixed env vars are inlined into the JS bundle at build time, exposing the key to any visitor via DevTools. Edge Functions run server-side and are not exposed.

**Source:** `src/lib/supabase.ts`

### SECURITY DEFINER Functions Locked Down

**What:** `rls_auto_enable()` and other SECURITY DEFINER functions have EXECUTE revoked from `anon` and `authenticated` roles. Only `service_role` and `postgres` can call them.

**Why:** SECURITY DEFINER functions bypass RLS. If callable by authenticated users, they become privilege escalation vectors.

**Source:** `docs/specs/roadmap.md`

### Function search_path Hardened

**What:** All 7 public functions have `SET search_path = ''`.

**Why:** Prevents search-path injection attacks where a malicious schema is created to shadow expected functions.

**Source:** `docs/specs/roadmap.md`

---

## Not Yet Decided (Pending)

| Topic | Status | Source |
|-------|--------|--------|
| i18n library (react-i18next vs react-intl vs custom) | Scoping needed | `docs/specs/roadmap.md` |
| Food costing module MVP details | Scoped, awaiting implementation | `docs/specs/roadmap.md` |
| Offline checkout queue (PWA Option C) | Post-beta, needs real connectivity data | `docs/specs/roadmap.md` |
| Sales tab sharing between baristas | Not on roadmap | `docs/specs/roadmap.md` |
