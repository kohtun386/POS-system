# CLAUDE.md — CoffeeShop POS

## 📋 Mandatory Rules (imported)

@.claude/rules/git-workflow.md
@.claude/rules/migration-safety.md

> Design system: see `.claude/skills/design-system/SKILL.md`
> Tier gating: see `.claude/skills/tier-gating/SKILL.md`
> Scope guard: see `.claude/skills/scope-guard/SKILL.md`
> Governance: see `docs/README.md` (Governance section)

## Architecture

### Service Layer (`src/lib/services/*`)

All DB access goes through service objects, not raw `supabase.from()`. Each service maps **camelCase** (frontend) ↔ **snake_case** (PostgreSQL). `settingsService.update()` updates by finding the existing record's ID first — not by name.

### Database

**Schema to front-end mapping rules:**
- Column names: `snake_case` in DB ↔ `camelCase` in TypeScript
- Dates: stored as `TIMESTAMP WITH TIME ZONE`, hydrated to `new Date()` in services
- JSONB columns: `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` — map directly to typed arrays/objects
- Boolean columns: `is_weight_based`, `track_inventory`, `is_active` — drop `is_` prefix in DB

**RLS:** All tables have Row Level Security enabled. Policies use `shop_id = ANY(current_shop_ids())` scoping. Sales tabs are user-scoped.

> ⚠️ **RLS Recursion:** NEVER call `current_shop_ids()` in a policy ON `shop_memberships` (infinite recursion → 500). Full checklist: `.claude/rules/migration-safety.md`.

### Capability-Based Feature Gating

Features are gated by `capabilities: string[]` in state, resolved server-side from subscription tier and business type. Components use `useCapability('key')` — never check `shop.subscriptionTier` directly.

```typescript
const canUsePrinter = useCapability('printer_integration');
const canUseCashDrawer = useCapability('cash_drawer');
```

### Tier & Feature Gating Protocol

See `.claude/skills/tier-gating/SKILL.md` for tier protocol, precedence rules, and the 18 valid capability keys.

### Checkout Pattern

Checkout uses `checkoutService.complete()` — single atomic RPC call. Handles sale creation, inventory deduction, stock deduction, print jobs, and customer stats in one transaction. Never use sequential JS calls.

## Code Style

### Naming
- React components: `PascalCase` (e.g., `ProductGrid`, `CheckoutModal`)
- Functions/callbacks: prefixed with `handle` (e.g., `handleAddToCart`, `handleCheckout`)
- Service objects: `camelCase` + `Service` suffix (e.g., `productsService`)
- Context exports: `PascalCase` for Provider, `use`-prefix for hooks (e.g., `useApp`, `useAuth`)

### Component Patterns
- One component per file, named export (never default export inside `src/components/`)
- Props interfaces defined above the component
- Modals: use `.modal-overlay` + `.modal` CSS classes from `src/index.css`
- Buttons/inputs: use custom CSS classes (`.btn`, `.btn-primary`, `.input`, `.select`, `.textarea`) — NOT raw Tailwind for form elements
- Touch mode: check `state.settings.interfaceMode === 'touch'` and apply `.touch-friendly` class for larger tap targets

### Accessibility (MANDATORY)
- **Use `<button>` not `<div onClick>`** — every clickable element must be a semantic button or have `role="button"` + `tabIndex={0}` + `onKeyDown`
- **Label all inputs** — add `aria-label` to search inputs and icon-only buttons
- **Modal Escape to close** — use `useModalEscape(onClose, isOpen)` from `src/hooks/useModalEscape.ts`
- **Color contrast** — text must meet WCAG AA (≥4.5:1); use `secondary-500` or darker for text on light backgrounds
- **No emoji as UI icons** — use Lucide React icons; emojis only in content text with `role="img" aria-label`

### async/Await & Error Handling
- Wrap Supabase calls in try/catch
- Use `swalConfig.error()` for user-facing error toasts (from `src/lib/sweetAlert.ts`)
- Use `swalConfig.success()` for success toasts
- Destructive operations: confirm first with `swalConfig.deleteConfirm(itemName)`
- Show loading state: `swalConfig.loading('message...')`

## Design System (Espresso & Copper)

See `.claude/skills/design-system/SKILL.md` for colors, typography, CSS classes, and animation patterns. Key rule: use `.btn`/`.input`/`.modal-overlay` CSS classes — NOT raw Tailwind for form elements.

## v1 Scope Boundaries (Non-Negotiable)

### Currency
**MMK only.** The app operates exclusively in Myanmar Kyat. No multi-currency, no exchange rates, no currency conversion. `multi_currency` is DEAD (VISION.md v3.1.0 §19).

### OUT OF SCOPE — Do NOT Build

See `.claude/skills/scope-guard/SKILL.md` for the full OUT OF SCOPE list and guard clause.

### Documentation-Driven Development (DDD)

**ALWAYS refer to `docs/vision/VISION.md` v3.1.0 as the Single Source of Truth for business logic.** Technical implementation details belong in architecture docs (`docs/architecture/`) and feature specs (`docs/specs/`).

**When in doubt about feature scope, check VISION.md §19 (What We Are NOT Building).**


### Valid Capability Keys (18 total — VISION.md v3.1.0 §5.5)

See `.claude/skills/tier-gating/SKILL.md` for the full capability keys table.

### Platform Admin Pattern

Platform admin operations MUST use `supabase.functions.invoke()` only. Never use `supabase.from()` for platform admin operations. All operations route through Edge Functions with `service_role` key, bypassing RLS entirely (VISION.md v3.1.0 §4.3, §17).

---

## Common Pitfalls

- **Don't import from `AppContext.tsx`** — it's deleted v3.1.0. Always use `SupabaseAppContext.tsx`.
- **Don't call `supabase.from()` directly in components** — route through service objects.
- **Don't forget camelCase ↔ snake_case mapping** — services handle this; if you add a new field, add mapping in both directions.
- **Stock updates** — the checkout flow in `CheckoutModal.tsx` already handles inventory deduction. Don't duplicate this logic.
- **Invoice numbers** — use `useInvoiceGeneration()` from `src/hooks/useInvoiceStats.ts`, not manual string construction.
- **Discount eligibility** — use `checkDiscountEligibility()` from SupabaseAppContext; don't reimplement condition checking.
- **Alerts access** — the AlertManager component exists but is NOT wired into the nav yet. It's accessible if needed but not in the main navigation flow.
- **SalesTabs** — are user-scoped in the DB (RLS). Each user only sees their own tabs. The initial tab is auto-created on first data load if none exist.

> DB safety: see `.claude/rules/migration-safety.md` (§db-guardian)
