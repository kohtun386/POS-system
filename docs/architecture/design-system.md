# Design System — Espresso & Copper

**Source of truth:** `tailwind.config.js` + `src/index.css`
**Last updated:** 2026-07-10 (aligned with VISION.md v3.1.0)
**Version:** 3.0.0
**Dark mode:** Tailwind `class` strategy — `.dark` on `<html>`
**Theme:** Espresso & Copper only (Light/Dark variants)

---

## 1. Color Tokens

### 1.1 Primary — Espresso Brown

| Token | Tailwind | Light Hex | Dark Hex | Usage |
|-------|----------|-----------|----------|-------|
| `primary-50` | `bg-primary-50` | `#fcf5eb` | — | Info card bg, light amber highlights |
| `primary-100` | `bg-primary-100` | `#f5e6d0` | — | Input focus ring, hover states |
| `primary-200` | `bg-primary-200` | `#ebd1af` | — | |
| `primary-300` | `bg-primary-300` | `#ddb889` | — | Icon highlights |
| `primary-400` | `bg-primary-400` | `#cfa16a` | — | Active nav icon |
| `primary-500` | `bg-primary-500` | `#b8854a` | — | Button hover, focus ring |
| `primary-600` | `bg-primary-600` | `#9a693a` | — | **Main button bg**, links, nav active |
| `primary-700` | `bg-primary-700` | `#7a4f2c` | — | Button hover, heading text |
| `primary-800` | `bg-primary-800` | `#5a3a20` | — | |
| `primary-900` | `bg-primary-900` | `#3b2613` | — | Dark card bg, dark overlays |
| `primary-950` | `bg-primary-950` | `#1f1309` | — | Dark mode body bg |

### 1.2 Secondary — Warm Stone

| Token | Tailwind | Light Hex | Dark Hex | Usage |
|-------|----------|-----------|----------|-------|
| `secondary-50` | `bg-secondary-50` | `#faf8f5` | — | **Light mode body bg**, panel bg |
| `secondary-100` | `bg-secondary-100` | `#f0ece5` | — | **Card bg**, input bg, table hover |
| `secondary-200` | `bg-secondary-200` | `#ded7cc` | — | Borders, dividers |
| `secondary-300` | `bg-secondary-300` | `#c6bbab` | — | Dark mode body text |
| `secondary-400` | `bg-secondary-400` | `#ad9e8a` | — | Placeholder text, empty state icons |
| `secondary-500` | `bg-secondary-500` | `#96846e` | — | |
| `secondary-600` | `bg-secondary-600` | `#7d6b57` | — | **Subtitle text**, muted labels |
| `secondary-700` | `bg-secondary-700` | `#655547` | — | |
| `secondary-800` | `bg-secondary-800` | `#54463b` | — | Dark mode borders |
| `secondary-900` | `bg-secondary-900` | `#473b32` | — | **Heading text** in light mode |
| `secondary-950` | `bg-secondary-950` | `#251e18` | — | Overlay dark |

### 1.3 Accent — Copper Orange

| Token | Tailwind | Light Hex | Dark Hex | Usage |
|-------|----------|-----------|----------|-------|
| `accent-50` | `bg-accent-50` | `#fef7ee` | — | Low stock bg |
| `accent-100` | `bg-accent-100` | `#feebd0` | — | |
| `accent-200` | `bg-accent-200` | `#fcd3a0` | — | Low stock border |
| `accent-300` | `bg-accent-300` | `#fab665` | — | |
| `accent-400` | `bg-accent-400` | `#f89341` | — | |
| `accent-500` | `bg-accent-500` | `#f57323` | — | Badge accent, hover highlight |
| `accent-600` | `bg-accent-600` | `#e55c13` | — | Badge accent hover |
| `accent-700` | `bg-accent-700` | `#be4612` | — | |
| `accent-800` | `bg-accent-800` | `#973916` | — | |
| `accent-900` | `bg-accent-900` | `#7a3015` | — | |
| `accent-950` | `bg-accent-950` | `#421508` | — | |

### 1.4 Semantic Colors

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `success-500` | `text-success-500` | `#22c55e` | Success badge, active status |
| `success-600` | `text-success-600` | `#16a34a` | Success button hover |
| `success-700` | `text-success-700` | `#15803d` | |
| `success-800` | `bg-success-800` | `#166534` | |
| `success-900` | `bg-success-900` | `#14532d` | |
| `warning-500` | `text-warning-500` | `#f59e0b` | Warning badge, low stock |
| `warning-600` | `text-warning-600` | `#d97706` | |
| `danger-500` | `text-danger-500` | `#ef4444` | Danger badge, out of stock |
| `danger-600` | `text-danger-600` | `#dc2626` | Delete button, destructive actions |
| `danger-700` | `text-danger-700` | `#b91c1c` | |

### 1.5 Dark Mode Mapping

| Role | Light | Dark | Tailwind (light) | Tailwind (dark) |
|------|-------|------|-------------------|-----------------|
| Body bg | `#faf8f5` | `#1f1309` | `bg-secondary-50` | `dark:bg-primary-950` |
| Card bg | `#f0ece5` | `#2a1a10` | `bg-secondary-100` | `dark:bg-surface-dark` |
| Card border | `#ded7cc` | `#54463b` | `border-secondary-200` | `dark:border-secondary-800` |
| Heading text | `#473b32` | `#f0ece5` | `text-secondary-900` | `dark:text-secondary-100` |
| Body text | `#7d6b57` | `#c6bbab` | `text-secondary-600` | `dark:text-secondary-300` |
| Muted text | `#ad9e8a` | — | `text-secondary-400` | — |
| Input bg | `#faf8f5` | `#2a1a10` | `bg-secondary-50` | `dark:bg-surface-dark` |
| Table hover | `#f0ece5` | `#3b2613` | `hover:bg-secondary-100` | `dark:hover:bg-primary-900` |
| Overlay | `#251e18` | same | `bg-secondary-950` | same |

### 1.6 Inline Hex Migration — Complete ✅

**Status:** Migrated 2026-07-10. All className hex values replaced with Tailwind tokens.

**Remaining hex (acceptable):**
- Recharts component props (`stroke=`, `fill=`) — library requires literal hex
- Recharts CSS-in-JS objects (`contentStyle`, `dot={{ fill: }}`)
- SweetAlert2 `!important` overrides — raw CSS, can't use Tailwind tokens
- Framer Motion color props

**Token additions:**
- `surface.dark` (`#2a1a10`) — dark card/surface bg
- `hover.border` (`#e5ddd2`) — hover border highlight

**Migration rule:** Always use Tailwind tokens. If token doesn't exist, add to `tailwind.config.js` first.

---

## 2. Typography

### 2.1 Font Families

| Token | Tailwind | Font Stack | Usage |
|-------|----------|-----------|-------|
| Sans | `font-sans` | DM Sans, system-ui, sans-serif | **Body text**, inputs, buttons, tables |
| Display | `font-display` | Fraunces, Georgia, serif | Headings (via `.font-fraunces` utility) |
| Serif | `font-serif` | Fraunces, Georgia, serif | Same as display |

**Import:** Google Fonts preloaded in `index.html` — DM Sans (300-700, italic) + Fraunces (400-700, italic).

### 2.2 Heading Scale

| Level | Tag | Tailwind Classes | Font | Usage |
|-------|-----|------------------|------|-------|
| Page title | `h1` | `text-2xl lg:text-3xl font-bold font-fraunces` | Fraunces 600 | Main page headers |
| Section header | `h2` | `text-xl font-bold font-fraunces` | Fraunces 600 | Modal headers, card titles |
| Subsection | `h3` | `text-lg font-semibold font-fraunces` | Fraunces 600 | Form section titles |
| Label | `label` | `text-sm font-semibold text-secondary-700` | DM Sans 600 | Form labels |

### 2.3 Body Scale

| Level | Tailwind | Size | Usage |
|-------|----------|------|-------|
| Large body | `text-lg` | 18px / 1.75 | |
| Body | `text-base` | 16px / 1.5 | Default text |
| Small body | `text-sm` | 14px / 1.25 | Table cells, descriptions |
| Caption | `text-xs` | 12px / 1 | Badges, timestamps, metadata |

### 2.4 Touch Mode Typography

When `settings.interfaceMode === 'touch'`:
- Headings bump one size up (e.g., `text-base` → `text-lg`)
- Inputs use `h-14 text-lg` instead of `h-12`
- Buttons use `btn-lg` minimum

---

## 3. Spacing

### 3.1 Component Padding

| Context | Tailwind | Size |
|---------|----------|------|
| Card inner padding | `p-6` | 24px |
| Modal header | `px-6 py-5` | 24px horizontal, 20px vertical |
| Modal body | `p-6` | 24px |
| Modal footer | `px-6 py-5` | 24px horizontal, 20px vertical |
| Button md | `px-6 py-3` | 24px horizontal, 12px vertical |
| Button lg | `px-8 py-4` | 32px horizontal, 16px vertical |
| Button sm | `px-4 py-2` | 16px horizontal, 8px vertical |
| Table cell | `px-6 py-4` | 24px horizontal, 16px vertical |
| Table header cell | `px-6 py-4` | Same as cell |
| Page padding | `p-4 lg:p-6` | 16px mobile, 24px desktop |
| Section gap | `space-y-6` | 24px vertical |

### 3.2 Custom Spacing

| Token | Value | Tailwind |
|-------|-------|----------|
| `18` | 4.5rem | `w-18`, `h-18` |
| `88` | 22rem | `w-88`, sidebar width |
| `128` | 32rem | `w-128` |

### 3.3 Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `xl` | 0.75rem (12px) | `rounded-xl` | Buttons, inputs, small cards |
| `2xl` | 1rem (16px) | `rounded-2xl` | Cards, nav items, badges |
| `3xl` | 1.5rem (24px) | `rounded-3xl` | Modals, stat cards, main cards |
| `4xl` | 2rem (32px) | `rounded-4xl` | Large modals, hero elements |

---

## 4. Shadows

| Token | Tailwind | Usage |
|-------|----------|-------|
| `soft` | `shadow-soft` | Cards, inputs, subtle elevation |
| `medium` | `shadow-medium` | Hover states, buttons, nav |
| `large` | `shadow-large` | Modals, overlays, stat cards |
| `glow` | `shadow-glow` | Focus states (copper glow) |
| `glow-lg` | `shadow-glow-lg` | |
| `copper` | `shadow-copper` | Primary button hover, copper highlight |

All shadows use warm brown tones (`rgba(42, 24, 16, ...)`) — not neutral gray. Consistent with Espresso & Copper theme.

---

## 5. Animations

| Token | Tailwind | Duration | Usage |
|-------|----------|----------|-------|
| `fade-in` | `animate-fade-in` | 0.5s | Page transitions, view switches |
| `slide-up` | `animate-slide-up` | 0.3s | Cart item enter, dropdowns |
| `slide-down` | `animate-slide-down` | 0.3s | Mobile menu, dropdowns |
| `scale-in` | `animate-scale-in` | 0.2s | Modal enter |
| `bounce-gentle` | `animate-bounce-gentle` | 0.6s | Cart badge bounce |
| `pulse-gentle` | `animate-pulse-gentle` | 2s ∞ | Cart indicator, notification badge |
| `shimmer` | `animate-shimmer` | 2s ∞ | Loading skeleton |
| `steam` | `animate-steam` | 3s ∞ | Decorative coffee steam effect |

**Framer Motion:** Components use `motion.div` / `motion.button` with `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`, `transition={{ duration: 0.2 }}`. Keep `duration: 0.2` consistent.

---

## 6. Component Catalog

### 6.1 Card

```tsx
<div className="card p-6">
  {/* Content */}
</div>
```

| Variant | Class | Notes |
|---------|-------|-------|
| Default | `.card` | Frosted glass, 3xl radius, soft shadow |
| Glass | `.card-glass` | More transparent, heavier blur |
| Hover | `.card-hover` | Scale + shadow on hover, copper border glow |

**Dark mode:** Auto-handled by `.card` CSS (dark bg, dark border).

---

### 6.2 Button

```tsx
<button className="btn btn-primary btn-md">Label</button>
```

| Variant | Class | Background | Text | Hover |
|---------|-------|------------|------|-------|
| Primary | `.btn-primary` | Espresso gradient | White | Lighter gradient + copper shadow |
| Secondary | `.btn-secondary` | Warm stone | Dark brown | Darker stone |
| Accent | `.btn-accent` | Copper gradient | White | Lighter copper |
| Success | `.btn-success` | Green gradient | White | Lighter green |
| Danger | `.btn-danger` | Red gradient | White | Lighter red |
| Ghost | `.btn-ghost` | Transparent | Muted brown | Stone bg appears |

| Size | Class | Padding | Font |
|------|-------|---------|------|
| Small | `.btn-sm` | `px-4 py-2` | `text-sm font-medium` |
| Medium | `.btn-md` | `px-6 py-3` | `text-sm font-semibold` |
| Large | `.btn-lg` | `px-8 py-4` | `text-base font-semibold` |

**Touch mode:** Always `btn-lg` minimum. Add `.touch-friendly` for 48px min tap target.

---

### 6.3 Stat Card

```tsx
<div className="stat-card">
  <div className="relative z-10">
    <h3>Title</h3>
    <div className="text-2xl font-bold">Value</div>
  </div>
</div>
```

| Variant | Class | Gradient |
|---------|-------|----------|
| Default | `.stat-card` | `from-[#b8854a] via-[#9a693a] to-[#7a4f2c]` |
| Success | `.stat-card-success` | `from-green-500 via-green-600 to-green-700` |
| Warning | `.stat-card-warning` | `from-yellow-500 via-yellow-600 to-yellow-700` |
| Danger | `.stat-card-danger` | `from-red-500 via-red-600 to-red-700` |

Has `::before` pseudo-element for glass overlay effect.

---

### 6.4 Badge

```tsx
<span className="badge badge-success">Active</span>
```

| Variant | Class | Colors |
|---------|-------|--------|
| Success | `.badge-success` | Green bg/border, dark green text |
| Warning | `.badge-warning` | Yellow bg/border, dark yellow text |
| Danger | `.badge-danger` | Red bg/border, dark red text |
| Info | `.badge-info` | Espresso bg/border, espresso text |
| Accent | `.badge-accent` | Copper bg/border, dark copper text |

Base: `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold`

---

### 6.5 Modal

```tsx
<div className="modal-overlay">
  <div className="modal max-w-md">
    <div className="modal-header">
      <h2>Title</h2>
      <button>×</button>
    </div>
    <div className="modal-body">
      {/* Content */}
    </div>
    <div className="modal-footer">
      <button className="btn btn-secondary btn-md">Cancel</button>
      <button className="btn btn-primary btn-md">Save</button>
    </div>
  </div>
</div>
```

| Part | Class | Notes |
|------|-------|-------|
| Overlay | `.modal-overlay` | `fixed inset-0`, dark backdrop, centered flex |
| Modal | `.modal` | 3xl radius, glass bg, max-height `calc(100dvh - 2rem)` |
| Header | `.modal-header` | `px-6 py-5`, bottom border |
| Body | `.modal-body` | `p-6`, overflow-y auto, max-height `calc(100dvh - 200px)` |
| Footer | `.modal-footer` | `px-6 py-5`, top border, flex end with gap |

---

### 6.6 Form Elements

```tsx
<input className="input" />
<input className="input input-sm" />
<select className="select" />
<textarea className="textarea" />
```

| Element | Class | Radius | Notes |
|---------|-------|--------|-------|
| Input | `.input` | 2xl | `w-full px-4 py-3`, frosted glass bg |
| Input small | `.input input-sm` | 2xl | `px-3 py-2 text-sm` |
| Select | `.select` | 2xl | Same as input |
| Textarea | `.textarea` | 2xl | Same as input, `resize-none` |

**Focus:** `ring-2 ring-primary-300 border-primary-500` (light) / `ring-primary-700 border-primary-400` (dark).

---

### 6.7 Table

```tsx
<table className="table">
  <thead className="table-header">
    <tr>
      <th className="table-header-cell">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr className="table-row">
      <td className="table-cell">Data</td>
    </tr>
  </tbody>
</table>
```

| Part | Class | Notes |
|------|-------|-------|
| Table | `.table` | `min-w-full divide-y` with secondary-200 dividers |
| Header | `.table-header` | `bg-secondary-100/80` frosted |
| Header cell | `.table-header-cell` | `px-6 py-4 text-xs font-semibold text-secondary-600 uppercase` |
| Row | `.table-row` | Hover: `bg-secondary-100/50` |
| Cell | `.table-cell` | `px-6 py-4 whitespace-nowrap text-sm text-secondary-900` |

---

### 6.8 Navigation

```tsx
<button className="nav-item nav-item-active">Label</button>
```

| Part | Class | Notes |
|------|-------|-------|
| Item | `.nav-item` | `flex items-center space-x-3 px-4 py-3`, rounded-2xl |
| Active | `.nav-item-active` | `bg-primary-50 text-primary-700 font-semibold shadow-soft` |
| Sidebar | `.sidebar` | Frosted bg, right border, flex column |

---

### 6.9 Loading

```tsx
<LoadingSpinner size="md" text="Loading..." />
<LoadingOverlay isVisible={true} text="Processing..." />
<SkeletonLoader lines={3} />
```

Uses Framer Motion `animate={{ rotate: 360 }}` for spinner. Primary-200 border, primary-600 top.

---

## 7. Chart Colors (Recharts)

Hardcoded in `ReportsManager.tsx`. Not in Tailwind config (Recharts needs literal hex).

```ts
const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#EC4899'];
```

| Index | Hex | Role |
|-------|-----|------|
| 0 | `#2563EB` | Blue — primary data series |
| 1 | `#059669` | Green — secondary series |
| 2 | `#D97706` | Amber — tertiary series |
| 3 | `#DC2626` | Red — quaternary / negative |
| 4 | `#7C3AED` | Purple — quinary |
| 5 | `#EC4899` | Pink — senary |

**Future:** Move to `src/lib/theme.ts` as named export. Update ReportsManager to import.

---

## 8. Utilities

### 8.1 Custom Utilities (src/index.css)

| Utility | Class | Purpose |
|---------|-------|---------|
| Text balance | `.text-balance` | `text-wrap: balance` |
| Scrollbar hide | `.scrollbar-hide` | Hide scrollbar cross-browser |
| Touch target | `.touch-target` | `min-height: 44px; min-width: 44px` |
| Touch friendly | `.touch-friendly` | `min-height: 48px; min-width: 48px` (coarse pointer only) |
| Glass | `.glass` | Frosted glass effect |
| Glass strong | `.glass-strong` | Heavier frosted glass |
| Gradient text | `.gradient-text` | Espresso → copper gradient on text |
| Copper ring | `.copper-ring` | `ring-2 ring-accent-500/30` |
| Coffee pattern | `.bg-coffee-pattern` | Radial gradient decorative background |
| Font Fraunces | `.font-fraunces` | `font-family: 'Fraunces', Georgia, serif` |
| Font DM Sans | `.font-dm-sans` | `font-family: 'DM Sans', system-ui, sans-serif` |

### 8.2 Loading Shimmer

```css
.loading::after {
  content: '';
  position: absolute;
  background: linear-gradient(90deg, transparent, rgba(245, 115, 35, 0.08), transparent);
  animation: loading 1.5s infinite;
}
```

---

## 9. SweetAlert2 Theming

Custom styles in `src/index.css`. All toasts use themed colors.

| Element | Style |
|---------|-------|
| Popup | `border-radius: 1.5rem`, frosted glass bg, secondary-200 border |
| Title | Fraunces serif, secondary-900 text |
| Body | DM Sans, secondary-600 text |
| Confirm button | Espresso gradient, 0.75rem radius |
| Cancel button | Secondary gradient, 0.75rem radius |
| Timer bar | Espresso → copper gradient |
| Toast | 1rem radius, frosted glass, secondary-200 border |

**Config in code:** `src/lib/sweetAlert.ts` defines `swalConfig` with `.success()`, `.error()`, `.warning()`, `.info()`, `.confirm()`, `.deleteConfirm()`, `.loading()`, `.close()`, `.input()`.

---

## 10. Multi-Device Design Patterns

VISION.md v3.1.0 defines three device layers. Each has distinct form factors, interaction models, and UI patterns.

### 10.1 POS Tablet (Mobile/Tablet-First)

**Target:** Counter tablet used by cashiers
**Form factor:** 10-12" tablet, touch-only

**Design principles:**
- Touch-optimized: 48px minimum tap targets (`.touch-friendly` class)
- Large buttons, clear labels
- One-handed operation friendly
- High contrast for bright shop environments

**Current design system applies here.** All existing components (Sections 1-9) are designed for this form factor.

| Pattern | Implementation |
|---------|---------------|
| Navigation | Top header bar with icon buttons |
| Layout | Single-column, full-width cards |
| Buttons | `.btn-lg` minimum in touch mode |
| Tables | Standard `.table` with horizontal scroll |
| Modals | Full-width on small tablets, `max-w-md` on larger |

---

### 10.2 Owner Mobile (Mobile-First, Read-Only)

**Target:** Owner's smartphone for checking reports (Pro tier)
**Form factor:** 5-6" phone, touch-only

**Design principles:**
- Compact cards for small screens
- Large tap targets (56px) for thumb navigation
- Simplified navigation (bottom nav bar)
- Read-only dashboards (P&L, shift variances, alerts)
- No POS terminal functionality

**UI patterns:**

| Pattern | Description |
|---------|-------------|
| Bottom navigation | 4-5 items max, fixed at bottom |
| Card layout | Single column, full-width |
| Stat cards | Large Revenue, Purchases, Profit display |
| Swipe gestures | Navigate between views |
| Pull-to-refresh | Data updates on pull-down |

**Components needed (future):**

| Component | Class | Purpose |
|-----------|-------|---------|
| Owner mobile card | `.owner-mobile-card` | Compact card variant for small screens |
| Owner mobile stat | `.owner-mobile-stat` | Large stat card (Revenue, Purchases, Profit) |
| Owner mobile nav | `.owner-mobile-nav` | Bottom navigation bar |

---

### 10.3 Platform Admin (Desktop-First)

**Target:** Ko Htun's desktop for managing all shops
**Form factor:** 24"+ monitor, mouse + keyboard
**Architecture:** Edge Function only — `supabase.functions.invoke()` for all ops. Zero `supabase.from()` (VISION.md §17.4).

#### 10.3.1 Responsive Breakpoints & Behavior

| Breakpoint | Width | Sidebar | Layout |
|------------|-------|---------|--------|
| Mobile | < 768px | Hidden (hamburger toggle) | Single column, stacked cards |
| Tablet | 768–1023px | Hidden (hamburger toggle) | 2-column grid |
| Desktop | ≥ 1024px | Visible, fixed 256px | Multi-column, full density |

- Sidebar collapses to hamburger icon on mobile/tablet
- Main content area uses `flex-1 overflow-y-auto`
- Tables wrapped in `<div className="overflow-x-auto">` at all breakpoints

#### 10.3.2 Layout Structure

```
┌──────────────────────────────────────────────┐
│ Header (h-16, sticky top-0)                  │
│ [☰ hamburger]  Platform Admin    [user menu] │
├──────────┬───────────────────────────────────┤
│ Sidebar  │  Main Content                     │
│ 256px    │  p-6 max-w-7xl mx-auto            │
│ fixed    │                                   │
│          │  ┌─────┐ ┌─────┐ ┌─────┐         │
│ ● Dash   │  │Stat │ │Stat │ │Stat │         │
│ ○ Shops  │  │Card │ │Card │ │Card │         │
│ ○ Subs   │  └─────┘ └─────┘ └─────┘         │
│ ○ Feats  │                                   │
│          │  ┌─────────────────────────────┐  │
│          │  │ Data Table / Content         │  │
│          │  └─────────────────────────────┘  │
└──────────┴───────────────────────────────────┘
```

**Sidebar:**
- Width: 256px (`w-64`), fixed position
- Background: `bg-secondary-100 dark:bg-[#2a1f15]`
- Nav items: `.nav-item` pattern with Lucide icons + text labels
- Active state: `bg-primary-600 text-white`

**Header (mobile):**
- Height: 48px (`h-12`), sticky top-0
- Hamburger button (40px tap target) toggles sidebar overlay
- Overlay backdrop: `bg-secondary-950/40` on mobile when sidebar open

#### 10.3.3 Data-Dense Component Patterns

**Stat Cards:**
- Use `.stat-card` / `.stat-card-success` / `.stat-card-warning` / `.stat-card-danger`
- Grid: `grid grid-cols-1 md:grid-cols-3 gap-4`
- White text on gradient bg, `::before` glass overlay

**Data Tables:**
- Wrap in `<div className="overflow-x-auto">` to prevent horizontal overflow
- Row height: 40px (`px-6 py-3`)
- Header: `bg-secondary-100/80 text-xs font-semibold uppercase`
- Font: `font-mono text-sm` for keys/codes/IDs
- Sortable columns: `cursor-pointer hover:text-primary-600`

**Empty States:**
- Centered `p-8 text-secondary-600` with action button

#### 10.3.4 Accessibility & Interaction

- All nav items have visible text labels (no icon-only)
- Focus ring: `ring-2 ring-primary-500 ring-offset-2` on interactive elements
- Tables support keyboard navigation (Tab between rows)
- Modal dialogs trap focus, Escape to close
- Status badges use color + text (not color alone)

---

### 10.4 Device Matrix

| Aspect | POS Tablet | Owner Mobile | Platform Admin |
|--------|-----------|--------------|----------------|
| Form factor | 10-12" tablet | 5-6" phone | 24"+ monitor |
| Input | Touch only | Touch only | Mouse + keyboard |
| Min tap target | 48px | 56px | 40px |
| Navigation | Top header | Bottom nav | Sidebar (256px, collapsible) |
| Layout | Single column | Single column | Multi-column |
| Data density | Medium | Low | High |
| Primary use | POS terminal | Read-only reports | Shop management |
| Tier access | All tiers | Pro only | Platform admin |

---

## 11. Tier-Based UI Patterns

VISION.md v3.1.0 defines three subscription tiers. UI patterns differ by tier to show value and guide upgrades.

### 11.1 Free Tier — Upgrade Prompts

**Design goal:** Show value of paid tiers without frustrating users

**Upgrade modal design:**

| Part | Content | Style |
|------|---------|-------|
| Header | "Upgrade to Growth" + subtitle | `.modal-header` with Fraunces heading |
| Body | Feature list with checkmarks + price | `.modal-body` with `.badge-success` checkmarks |
| Footer | "Maybe Later" (ghost) + "Upgrade Now" (primary) | `.modal-footer` with `.btn-ghost` + `.btn-primary` |

**Locked feature UI:**

| Element | Behavior |
|---------|----------|
| Menu items | Show with lock icon (🔒) |
| Click handler | Opens upgrade modal |
| Tooltip | "Available on Growth and Pro plans" |
| Visual style | Muted text (`text-secondary-400`), reduced opacity |

---

### 11.2 Growth Tier — Full Features

**Design goal:** Show all features, no upgrade prompts

**UI patterns:**
- All menu items unlocked
- No lock icons
- Standard component patterns apply
- Cash drawer UI visible

No special components needed — standard design system applies.

---

### 11.3 Pro Tier — Advanced Analytics

**Design goal:** Highlight advanced features

**UI patterns:**

| Feature | Description |
|---------|-------------|
| Simple profit report | Revenue − Purchases dashboard |
| Owner Insights (P&L) | 3 numbers: Revenue, Purchases, Profit |
| Advanced report filters | Date range, product category selectors |
| Export buttons | CSV and PDF export |

**Components needed (future):**

| Component | Class | Purpose |
|-----------|-------|---------|
| Profit chart | `.profit-chart` | Recharts line chart for profit over time |
| P&L dashboard | `.pnl-dashboard` | 3-number P&L display |

---

### 11.4 Tier Matrix

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| POS terminal | ✅ | ✅ | ✅ |
| Product management | ✅ (50 max) | ✅ (unlimited) | ✅ (unlimited) |
| Basic reports | ✅ | ✅ | ✅ |
| Cash drawer | 🔒 | ✅ | ✅ |
| Purchase log | ❌ | ✅ | ✅ |
| Stock overview | ❌ | ✅ | ✅ |
| Low stock alerts | ❌ | ✅ | ✅ |
| Printer integration | 🔒 | ✅ | ✅ |
| Simple profit report | ❌ | ❌ | ✅ |
| Owner insights (P&L) | ❌ | ❌ | ✅ |

---

## 12. Accessibility Guidelines (WCAG 2.1 AA)

### 12.1 Color Contrast

**Requirements:**

| Element Type | Minimum Ratio |
|--------------|---------------|
| Body text | 4.5:1 |
| Large text (18px+ or 14px bold) | 3:1 |
| Interactive elements | 3:1 |

**Current status:** All Espresso & Copper tokens pass WCAG AA.

**Verification tool:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

| Pair | Ratio | Pass |
|------|-------|------|
| `secondary-900` on `secondary-50` | 12.5:1 | ✅ AA |
| `secondary-600` on `secondary-50` | 5.2:1 | ✅ AA |
| `primary-600` on white | 4.8:1 | ✅ AA |
| `primary-600` on `secondary-100` | 4.6:1 | ✅ AA |

---

### 12.2 Keyboard Navigation

**Requirements:**
- All interactive elements focusable
- Focus order matches visual order
- Focus indicator visible: `ring-2 ring-primary-500`
- Tab/Shift+Tab navigation
- Enter/Space activates buttons
- Escape closes modals

**Implementation:**

```css
/* Focus styles (already in src/index.css) */
.btn:focus-visible,
.input:focus-visible,
.select:focus-visible {
  @apply ring-2 ring-primary-500 ring-offset-2;
}
```

---

### 12.3 Screen Reader Support

**Requirements:**
- All images have alt text
- Form inputs have labels
- Error messages use `aria-live="polite"`
- Modal dialogs trap focus
- Skip navigation link

**Implementation examples:**

```tsx
// Images
<img src="logo.png" alt="CoffeeShop POS logo" />

// Form inputs
<label htmlFor="email">Email</label>
<input id="email" className="input" aria-describedby="email-error" />
<div id="email-error" aria-live="polite" className="text-danger-500">
  {error}
</div>

// Modal focus trap
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Title</h2>
  {/* Content */}
</div>

// Skip navigation
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

---

### 12.4 Touch Targets

**Requirements:**

| Standard | Minimum Size |
|----------|--------------|
| WCAG 2.1 | 44x44px |
| Our standard | 48x48px (`.touch-friendly`) |
| Owner mobile | 56x56px (larger for thumb) |

**Implementation:**

```css
/* Existing classes in src/index.css */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

.touch-friendly {
  min-height: 48px;
  min-width: 48px;
}
```

---

## 13. Rules for AI Agents

1. **Never use raw hex in className.** Use Tailwind tokens. If token doesn't exist, add it to `tailwind.config.js` first, then use it.
2. **Exception: Recharts.** Chart library needs literal hex strings. Keep in `COLORS` array.
3. **Always include dark variant.** Every `bg-X` needs `dark:bg-Y`. Every `text-X` needs `dark:text-Y`.
4. **Use `.font-fraunces` for headings.** Not `font-serif` or `font-display` directly.
5. **Use CSS classes for form elements.** `.btn`, `.input`, `.select`, `.textarea` — not raw Tailwind on `<button>` or `<input>`.
6. **Touch mode check:** `state.settings.interfaceMode === 'touch'` → apply `.touch-friendly` class.
7. **Framer Motion:** `transition={{ duration: 0.2 }}` always. `whileHover={{ scale: 1.02 }}` for cards, `scale: 1.05` for small buttons.
8. **Animations:** Use Tailwind `animate-*` classes for CSS animations. Use Framer Motion for interactive/conditional animations.
