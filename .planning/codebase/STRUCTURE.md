# Codebase Structure

## Directory Layout

```
coffee-pos/
├── .claude/                        # Claude Code project config and memory
├── .planning/                      # Planning documents (this file)
│   └── codebase/
│       ├── ARCHITECTURE.md
│       ├── CONVENTIONS.md
│       ├── INTEGRATIONS.md
│       ├── STACK.md
│       └── STRUCTURE.md
├── docs/                           # Project documentation
│   ├── architecture/               # Architecture docs (decisions, patterns, database, auth, etc.)
│   ├── archive/                    # Historical docs (foundation-phase-analysis)
│   ├── ops/                        # Operational docs
│   ├── screenshots/                # App screenshots
│   ├── specs/                      # Feature specs (PRD, roadmap, multi-tenancy, etc.)
│   ├── superpowers/                # Pitch decks and presentations
│   └── index.md                    # Documentation index
├── dist/                           # Production build output (gitignored contents)
│   ├── assets/                     # Bundled JS/CSS with content hashes
│   ├── sw.js                       # Service worker (Workbox-generated)
│   ├── workbox-*.js                # Workbox runtime
│   ├── manifest.webmanifest        # PWA manifest (generated)
│   └── index.html                  # Built HTML
├── public/                         # Static assets (copied to dist as-is)
│   ├── android-chrome-192x192.png  # PWA icon (192px)
│   ├── android-chrome-512x512.png  # PWA icon (512px)
│   ├── apple-touch-icon.png        # iOS home screen icon
│   ├── favicon.ico                 # Browser favicon
│   ├── favicon-16x16.png           # Favicon (16px)
│   ├── favicon-32x32.png           # Favicon (32px)
│   ├── icon.png                    # Generic icon
│   └── site.webmanifest            # PWA manifest (source)
├── slides/                         # Pitch deck slides
├── src/                            # Application source code
│   ├── components/                 # React components (by domain)
│   │   ├── alerts/                 # Inventory alert system (not in nav)
│   │   │   ├── AlertManager.tsx
│   │   │   ├── ConfigurationCard.tsx
│   │   │   ├── RecipientModal.tsx
│   │   │   ├── ServiceModal.tsx
│   │   │   └── TemplateModal.tsx
│   │   ├── auth/                   # Authentication
│   │   │   └── LoginPage.tsx
│   │   ├── customers/              # Customer management
│   │   │   ├── CustomerDetailModal.tsx
│   │   │   ├── CustomerManager.tsx
│   │   │   └── CustomerModal.tsx
│   │   ├── discounts/              # Discount management
│   │   │   ├── DiscountManager.tsx
│   │   │   └── DiscountModal.tsx
│   │   ├── examples/               # Development examples
│   │   │   └── CurrencyExample.tsx
│   │   ├── inventory/              # Product/inventory management
│   │   │   ├── InventoryManager.tsx
│   │   │   └── ProductModal.tsx
│   │   ├── layout/                 # App shell
│   │   │   └── Header.tsx
│   │   ├── pos/                    # Point of sale terminal
│   │   │   ├── Cart.tsx
│   │   │   ├── CheckoutModal.tsx
│   │   │   ├── POSTerminal.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ReceiptPrint.tsx
│   │   │   └── SalesTabManager.tsx
│   │   ├── reports/                # Reporting and analytics
│   │   │   └── ReportsManager.tsx
│   │   ├── settings/               # App settings
│   │   │   ├── ExchangeRateManager.tsx
│   │   │   ├── LogoUpload.tsx
│   │   │   └── Settings.tsx
│   │   ├── transactions/           # Sales history
│   │   │   └── TransactionsManager.tsx
│   │   ├── ui/                     # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── CurrencyDisplay.tsx
│   │   │   ├── Input.tsx
│   │   │   └── LoadingComponents.tsx
│   │   └── users/                  # User management (admin only)
│   │       ├── UserModal.tsx
│   │       └── UserManager.tsx
│   ├── context/                    # React context providers
│   │   ├── AppContext.tsx           # DEPRECATED (localStorage mock data)
│   │   ├── AuthContext.tsx          # Supabase auth wrapper
│   │   ├── CurrencyContext.tsx      # Multi-currency state + exchange rates
│   │   ├── SupabaseAppContext.tsx   # ACTIVE: main app state (useReducer)
│   │   └── ThemeContext.tsx         # Light/dark/system theme
│   ├── lib/                        # Utilities and services
│   │   ├── alertScheduler.tsx      # Alert scheduling logic
│   │   ├── alertService.ts         # Email/SMS alert delivery (SendGrid/Twilio)
│   │   ├── currencyUtils.ts        # CurrencyUtils class, rate caching
│   │   ├── database.types.ts       # Auto-generated Supabase types (653 lines)
│   │   ├── exchangeRateService.ts  # Exchange rate API integration
│   │   ├── modalUtils.ts           # Modal utility (empty)
│   │   ├── services.ts             # All DB service objects (1237 lines)
│   │   ├── supabase.ts             # Supabase client initialization
│   │   └── sweetAlert.ts           # SweetAlert2 toast/confirm configs
│   ├── types/                      # TypeScript type definitions
│   │   └── index.ts                # All interfaces and types (345 lines)
│   ├── App.tsx                     # Root component, provider tree, routing
│   ├── index.css                   # Global styles, design system, animations (642 lines)
│   ├── main.tsx                    # Entry point (renders <App />)
│   └── vite-env.d.ts               # Vite type declarations
├── supabase/                       # Supabase project config
│   ├── config.toml                 # Supabase local dev config
│   └── migrations/                 # SQL migrations (15 files)
│       ├── 20250804000001_init.sql                     # Initial schema (18 tables)
│       ├── 20250804000002_currency.sql                 # Currency system (6 tables)
│       ├── 20250804000003_payments.sql                 # Split payments support
│       ├── 20260612000001_add_mmk_currency.sql         # Myanmar Kyat currency
│       ├── 20260614000001_update_payment_method_constraint.sql
│       ├── 20260618000001_role_aware_rls_security.sql  # Role-based RLS policies
│       ├── 20260618000002_security_fixes.sql           # Security hardening
│       ├── 20260619000001_deactivate_expired_discounts.sql
│       ├── 20260619000002_auto_create_user_profile.sql # Trigger on auth signup
│       ├── 20260619000003_fix_user_creation_flow.sql
│       ├── 20260620000001_shop_id_placeholder.sql      # Multi-tenancy: shop_id columns
│       ├── 20260620000002_rls_shop_id_scoping.sql      # Multi-tenancy: RLS policies
│       ├── 20260620000003_fix_shop_memberships_recursion.sql
│       └── 20260620000004_fix_login_self_profile.sql
├── SupaBase/                       # Legacy SQL files (pre-migration era)
│   ├── inventory_alerts_schema.sql
│   ├── migration_add_payments_column.sql
│   ├── supabase_currency_schema.sql
│   └── supabase_init.sql
├── .env                            # Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── .mcp.json                       # MCP server config (supabase-platform, supabase-db)
├── CLAUDE.md                       # Project instructions for Claude Code
├── eslint.config.js                # ESLint flat config (TS + React hooks + React Refresh)
├── index.html                      # HTML entry point (fonts, meta, OG tags)
├── package.json                    # Dependencies and scripts
├── postcss.config.js               # PostCSS (Tailwind + Autoprefixer)
├── tailwind.config.js              # Tailwind config (Espresso & Copper theme)
├── tsconfig.json                   # TypeScript project references
├── tsconfig.app.json               # App TS config (strict, ES2020, bundler mode)
└── tsconfig.node.json              # Node TS config (for Vite config files)
```

## Key Entry Points

### HTML Entry
`index.html` -- Loads Google Fonts (DM Sans + Fraunces), sets meta tags, OG tags, and mounts `<div id="root">`. Script tag loads `/src/main.tsx`.

### JavaScript Entry
`src/main.tsx` -- Renders `<App />` inside `<StrictMode>` into the root DOM element.

### Application Root
`src/App.tsx` -- Defines the provider tree and the `AppContent` component which:
1. Checks auth loading state
2. Shows `LoginPage` if unauthenticated
3. Renders `Header` + lazy-loaded route component based on `currentView` state
4. Enforces role-based view restrictions

### Provider Tree (in order)
1. `ThemeProvider` -- `src/context/ThemeContext.tsx`
2. `AuthProvider` -- `src/context/AuthContext.tsx`
3. `AppProvider` -- `src/context/SupabaseAppContext.tsx`
4. `CurrencyProvider` -- `src/context/CurrencyContext.tsx`

## Module Organization

### Grouping Strategy: By Domain

Components are organized by business domain, not by technical layer:

```
components/
  pos/           -- POS terminal (the primary daily-use view)
  inventory/     -- Product CRUD + stock management
  customers/     -- Customer profiles + purchase history
  transactions/  -- Sales history + refunds
  discounts/     -- Discount rules engine
  reports/       -- Analytics dashboards + export
  settings/      -- Store config, exchange rates, logo
  users/         -- User/role management
  alerts/        -- Inventory alert configuration
  auth/          -- Login page
  layout/        -- App shell (Header)
  ui/            -- Shared primitives (Button, Card, Input, etc.)
```

Each domain follows a consistent pattern:
- `*Manager.tsx` -- Table/list view with search, filtering, CRUD actions
- `*Modal.tsx` -- Create/edit form in a modal dialog
- Some have `*DetailModal.tsx` for read-only detail views

### Import Patterns

- Components import from `../../context/SupabaseAppContext` (never `AppContext`)
- Components import from `../../lib/services` for DB operations
- Components import from `../../types` for type definitions
- Components import from `../../lib/sweetAlert` for toast notifications
- UI components import from `lucide-react` for icons
- No barrel exports (`index.ts`) -- each file is imported by its direct path
- `src/lib/services.ts` exports all service objects as named exports from a single file

### Context Access Pattern

```typescript
// In any component:
const { state, dispatch } = useApp();       // App state
const { user, signOut } = useAuth();        // Auth
const { isDark, toggleTheme } = useTheme(); // Theme
const { convertAmount } = useCurrency();    // Currency
```

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config: React plugin, PWA plugin (Workbox caching for fonts + Supabase API), lucide-react excluded from optimizeDeps |
| `tailwind.config.js` | Tailwind theme: Espresso & Copper color palette (primary/secondary/accent), DM Sans + Fraunces fonts, custom shadows, animations, spacing |
| `postcss.config.js` | PostCSS pipeline: Tailwind CSS + Autoprefixer |
| `tsconfig.json` | TypeScript project references (points to app + node configs) |
| `tsconfig.app.json` | App TypeScript config: ES2020 target, strict mode, bundler module resolution, noUnusedLocals/Parameters |
| `tsconfig.node.json` | Node TypeScript config for Vite config files |
| `eslint.config.js` | ESLint flat config: TypeScript-ESLint recommended + React Hooks + React Refresh |
| `package.json` | Dependencies, scripts (dev/build/lint/preview) |
| `.env` | Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) |
| `.mcp.json` | MCP server definitions for Claude Code: supabase-platform (management API) and supabase-db (PostgREST) |
| `supabase/config.toml` | Supabase local dev configuration |
| `public/site.webmanifest` | PWA manifest (name, icons, display mode, theme) |

## Asset Organization

### Static Assets (`public/`)
All favicon and PWA icon variants. Copied verbatim to `dist/` during build.

### Fonts
Loaded via Google Fonts CDN (not self-hosted). Two families:
- **DM Sans** -- Body text (weights 300-700)
- **Fraunces** -- Headings (weights 400-700, italic)

Preconnected in `index.html` with `<link rel="preconnect">`.

### Styles
Single CSS file: `src/index.css` (642 lines). Organized in Tailwind layers:
- `@layer base` -- Reset, typography, dark mode colors
- `@layer components` -- Design system classes (.card, .btn, .input, .modal, .table, .badge, .stat-card, .nav-item)
- `@layer utilities` -- Custom utilities (.touch-target, .glass, .gradient-text, .scrollbar-hide)
- Outside layers -- Custom scrollbar styles, SweetAlert2 theme overrides, keyframe animations, print styles, responsive utilities

### Icons
All icons come from `lucide-react` (tree-shakeable SVG icon library). No custom SVG files.

## Build Output

### Build Command
`npm run build` executes `vite build`.

### Output Directory
`dist/` contains:

```
dist/
├── assets/
│   ├── index-[hash].js       # Main application bundle
│   ├── index-[hash].css      # Compiled Tailwind CSS
│   └── [name]-[hash].js      # Lazy-loaded chunks (one per lazy component)
├── index.html                 # Built HTML with injected asset references
├── sw.js                      # Service worker (Workbox)
├── workbox-[hash].js          # Workbox runtime
├── manifest.webmanifest       # Generated PWA manifest
├── registerSW.js              # Service worker registration
├── site.webmanifest           # Source manifest (copied)
└── [favicon/icon PNGs]        # Static assets (copied from public/)
```

### Chunking Strategy
- **Manual chunks:** None explicitly configured. Vite's default code-splitting applies.
- **Lazy chunks:** 8 route-level components produce separate chunks via `React.lazy()`: POSTerminal, TransactionsManager, InventoryManager, CustomerManager, ReportsManager, Settings, DiscountManager, UserManager.
- **Vendor chunks:** Vite automatically splits `node_modules` into vendor chunks. `lucide-react` is excluded from `optimizeDeps` to allow proper tree-shaking.

### PWA Caching
Workbox is configured in `vite.config.ts`:
- **Pre-cached:** All built assets matching `**/*.{js,css,html,ico,png,svg,woff2}`
- **Runtime caching:**
  - Google Fonts CSS: CacheFirst, 1-year expiry
  - Google Fonts static files: CacheFirst, 1-year expiry
  - Supabase API: NetworkFirst, 5-second timeout, 5-minute max-age, 100 entry limit
