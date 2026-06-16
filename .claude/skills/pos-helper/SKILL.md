---
name: pos-helper
description: POS Helper — runs linting and validates UI consistency against the Coffee-POS Espresso & Copper design system.
---

# POS Helper

A project-level skill for the CoffeeShop POS application. Use this when you need a quick quality check before committing or when asked to verify code health.

## When to Invoke

Invoke this skill when:
- The user asks for a "lint check" or "code quality check"
- The user asks to "verify the UI" or "check theme consistency"
- Before committing a batch of changes
- When onboarding new contributors to the Coffee-POS codebase

## Instructions

When invoked, perform these steps in order:

### 1. Run the Linter

Execute `npm run lint` in the project root. Report:
- Errors that must be fixed (blocking)
- Warnings that should be addressed (non-blocking)
- If clean, confirm the lint passes

### 2. UI Consistency Check — Espresso & Copper Theme

Scan the current diff (or all `src/components/` if no active diff) for these violations:

| Rule | What to flag |
|---|---|
| **Raw Tailwind on form elements** | Buttons/inputs/selects/textareas must use `.btn`, `.btn-primary`, `.input`, `.select`, `.textarea` CSS classes — NOT raw Tailwind utilities |
| **Color palette drift** | Only these hex values are allowed: `#9a693a` / `#7a4f2c` (primary browns), `#f0ece5` / `#ded7cc` (secondary stones), `#f57323` / `#e55c13` (accent coppers). Flag any other custom hex color as a potential drift |
| **Typography** | Headings must use `font-fraunces` (serif, 600 weight). Body text must use `DM Sans`. Flag any raw `font-family` or improper heading weight |
| **Animation consistency** | Framer Motion transitions should use `duration: 0.2`. Flag anything significantly different or inconsistent `animate`/`initial` props |
| **Import hygiene** | Flag any import from `AppContext.tsx` (deprecated — use `SupabaseAppContext.tsx`). Flag any direct `supabase.from()` call outside `src/lib/services.ts` |
| **CSS class usage** | Cards: `.card`, `.card-glass`, `.card-hover`. Badges: `.badge-{success,warning,danger,info,accent}`. Tables: `.table`, `.table-header`, `.table-row`, `.table-cell`. Modals: `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer` |
| **Touch mode** | If `state.settings.interfaceMode === 'touch'`, verify `.touch-friendly` is applied for larger tap targets |

### 3. Summary

Output a concise report:
- Lint status (pass / fail with count)
- Theme violations found (count by category)
- Any other issues noticed

If everything passes, confirm the codebase is clean and theme-consistent.
