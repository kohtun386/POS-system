# Technology Stack

## Core Runtime

- **Language:** TypeScript 5.5 (strict mode)
- **Runtime:** Browser (SPA), Node.js v24.16.0 for build tooling
- **Module system:** ESNext (`"type": "module"` in package.json)

## Frontend

- **Framework:** React 18.3.1 (with `react-dom`)
- **Routing:** react-router-dom 6.20.1
- **Styling:** Tailwind CSS 3.4.1 with PostCSS + Autoprefixer, custom "Espresso & Copper" design tokens
- **State management:** React Context + `useReducer` pattern (SupabaseAppContext), no Redux/Zustand
- **Animation:** Framer Motion 11.0.0
- **Charts:** Recharts 2.12.0
- **Icons:** Lucide React 0.400.0
- **Date handling:** date-fns 3.6.0
- **Notifications/alerts:** SweetAlert2 11.22.2
- **Fonts:** Google Fonts (DM Sans for body, Fraunces for headings) loaded via `<link>` in index.html

## Backend / Services

- **Database:** Supabase (hosted PostgreSQL) -- project ref `ejvvwnupiqytximrbmfw`
- **Auth:** Supabase Auth (email/password, JWT-based sessions)
- **API layer:** Supabase PostgREST (auto-generated REST from Postgres schema)
- **Hosting:** Not yet deployed (builds with `vite build`, PWA-ready via vite-plugin-pwa)
- **Edge Functions:** None deployed yet (planned for admin operations)

## Build & Dev Tools

- **Bundler:** Vite 5.4.2 (`@vitejs/plugin-react` 4.3.1)
- **PWA:** vite-plugin-pwa 1.3.0 (Workbox-based service worker, `autoUpdate` register type)
- **Linter:** ESLint 9.9.1 with `typescript-eslint` 8.3.0, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Formatter:** None configured (no Prettier)
- **Test framework:** None (Vitest recommended in CLAUDE.md but not installed)

## Package Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | DOM renderer |
| `react-router-dom` | ^6.20.1 | Client-side routing |
| `@supabase/supabase-js` | ^2.50.5 | Supabase client (DB, auth, realtime) |
| `@supabase/auth-ui-react` | ^0.4.7 | Pre-built auth UI components |
| `@supabase/auth-ui-shared` | ^0.1.8 | Shared auth UI utilities |
| `framer-motion` | ^11.0.0 | Declarative animations |
| `recharts` | ^2.12.0 | Chart components for reports |
| `lucide-react` | ^0.400.0 | Icon library |
| `date-fns` | ^3.6.0 | Date formatting and manipulation |
| `sweetalert2` | ^11.22.2 | Toast notifications and confirmations |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.4.2 | Build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.1 | React Fast Refresh for Vite |
| `vite-plugin-pwa` | ^1.3.0 | PWA/service worker generation |
| `typescript` | ^5.5.3 | Type checking |
| `typescript-eslint` | ^8.3.0 | TypeScript ESLint integration |
| `eslint` | ^9.9.1 | Linting |
| `@eslint/js` | ^9.9.1 | ESLint JS config |
| `eslint-plugin-react-hooks` | ^5.1.0-rc.0 | React hooks lint rules |
| `eslint-plugin-react-refresh` | ^0.4.11 | Fast Refresh lint rules |
| `globals` | ^15.9.0 | Global variable definitions for ESLint |
| `tailwindcss` | ^3.4.1 | Utility-first CSS framework |
| `postcss` | ^8.4.35 | CSS processing |
| `autoprefixer` | ^10.4.18 | Vendor prefix automation |
| `@types/react` | ^18.3.5 | React type definitions |
| `@types/react-dom` | ^18.3.0 | ReactDOM type definitions |

## Version Constraints

- **Node.js:** v24.16.0 (no `.nvmrc` or `engines` field; version unconstrained)
- **npm:** 11.13.0
- **Lock file:** `package-lock.json` (lockfileVersion 3), npm-managed
- **TypeScript target:** ES2020 (`tsconfig.app.json`)
- **Module resolution:** Bundler mode (`"moduleResolution": "bundler"`)
- **TypeScript strict mode:** Enabled (`"strict": true`) with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
