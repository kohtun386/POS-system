# Code Conventions

## Naming Conventions

### Files
- **Components**: `PascalCase.tsx` (e.g., `ProductGrid.tsx`, `CheckoutModal.tsx`, `InventoryManager.tsx`)
- **Context providers**: `PascalCaseContext.tsx` (e.g., `SupabaseAppContext.tsx`, `AuthContext.tsx`, `ThemeContext.tsx`)
- **Services/utilities**: `camelCase.ts` (e.g., `services.ts`, `sweetAlert.ts`, `currencyUtils.ts`, `supabase.ts`)
- **Types**: Single `index.ts` in `src/types/`
- **CSS**: Single `index.css` with Tailwind layers

### Components
- PascalCase for all React components: `ProductGrid`, `CheckoutModal`, `InventoryManager`, `LoadingSpinner`
- Manager components for main views: `InventoryManager`, `CustomerManager`, `DiscountManager`, `UserManager`, `TransactionsManager`, `ReportsManager`
- Modal components for forms: `ProductModal`, `CustomerModal`, `DiscountModal`, `UserModal`, `CheckoutModal`
- UI primitives: `Button`, `IconButton`, `Input`, `Textarea`, `Card`, `CurrencyDisplay`, `LoadingSpinner`

### Functions
- Event handlers prefixed with `handle`: `handleAddToCart`, `handleCheckout`, `handleDeleteProduct`, `handleWeightSubmit`
- Service methods: `getAll()`, `create()`, `update()`, `delete()`, `getById()`
- Context hooks: `useApp()`, `useAuth()`, `useTheme()`, `useCurrency()`
- Utility functions: camelCase (`loadPersistedCart`, `persistCart`, `getAuthErrorMessage`)

### Variables
- camelCase for all variables and function parameters: `searchTerm`, `selectedCategory`, `filteredProducts`, `isTouchMode`
- Boolean prefixes: `is`, `show`, `has` (`isLoading`, `showWeightModal`, `hasMore`)
- Constants: camelCase (no SCREAMING_CASE observed): `CART_STORAGE_KEY`, `CACHE_DURATION`

### Types/Interfaces
- PascalCase for all types and interfaces: `Product`, `CartItem`, `AppState`, `AppAction`
- Props interfaces: `{ComponentName}Props` pattern: `ButtonProps`, `CheckoutModalProps`, `ProductGridProps`, `InputProps`
- Action union types: `{Domain}Action` (e.g., `AppAction`, `CurrencyAction`)

## Component Patterns

### Props Definition Style
Props interfaces are defined directly above the component, using `interface` (not `type`):
```tsx
interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (sale: Sale) => void;
}

export function CheckoutModal({ isOpen, onClose, onComplete }: CheckoutModalProps) {
```

Props are destructured in the function signature. Default values assigned inline:
```tsx
export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
```

### Export Style
- **Named exports** for all components under `src/components/`: `export function ProductGrid(...)`, `export function CheckoutModal(...)`
- **Default export** only for the root `App` component: `export default App`
- **Named exports** for services: `export const productsService = { ... }`
- **Named exports** for context providers and hooks: `export function AppProvider(...)`, `export function useApp()`
- **Named + default** for sweetAlert: `export const swalConfig = { ... }` and `export default swalConfig`
- `forwardRef` components use named export + `.displayName`: `Input.displayName = 'Input'`

### Hook Patterns
- All state uses `useState` with typed initial values
- `useReducer` for complex state (AppContext, CurrencyContext)
- `useEffect` for data loading, subscriptions, side effects
- `useRef` for mutable refs that don't trigger re-renders (`cartRestored`)
- `useMemo` for derived computations: `const categories = useMemo(() => [...], [state.products])`
- Custom hooks return context: `useApp()`, `useAuth()`, `useTheme()`
- Lazy loading via `lazy()` with `.then(m => ({ default: m.ComponentName }))` for named exports

## Import Conventions

### Ordering
Observed pattern (no enforced lint rule):
1. React imports: `import { useState, useEffect } from 'react'`
2. Third-party libraries: `import { motion } from 'framer-motion'`, `import { Search, Plus } from 'lucide-react'`
3. Local types: `import { Product, Customer } from '../../types'`
4. Local context: `import { useApp } from '../../context/SupabaseAppContext'`
5. Local services: `import { productsService } from '../../lib/services'`
6. Local components: `import { ProductModal } from './ProductModal'`
7. Local utilities: `import { swalConfig } from '../../lib/sweetAlert'`

### Import Style
- Named imports preferred: `import { useState, useEffect } from 'react'`
- Relative paths for all local imports: `'../../types'`, `'./ProductModal'`
- No barrel/index re-exports observed -- direct file imports
- Supabase client imported from lib: `import { supabase } from './supabase'`
- Database types imported separately: `import { Database } from './database.types'`

## State Management Patterns

### Action Naming
Discriminated union pattern with `type` field and optional `payload`:
```tsx
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
```

Action types follow `VERB_NOUN` pattern in SCREAMING_CASE:
- `SET_*` for replacing collections: `SET_PRODUCTS`, `SET_CUSTOMERS`, `SET_SALES`
- `ADD_*` for appending: `ADD_PRODUCT`, `ADD_SALE`, `ADD_TO_CART`
- `UPDATE_*` for in-place updates: `UPDATE_PRODUCT`, `UPDATE_CART_ITEM`, `UPDATE_DISCOUNT`
- `DELETE_*` for removal: `DELETE_PRODUCT`, `DELETE_SALE`, `DELETE_DISCOUNT`
- `REMOVE_*` for cart/tab removal: `REMOVE_FROM_CART`, `REMOVE_SALES_TAB`

### Reducer Pattern
Standard switch-case reducer with immutable spread updates:
```tsx
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.payload] };
    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload.id ? action.payload : p),
      };
    // ...
    default:
      return state;
  }
}
```

### Dispatch Usage
- Always `dispatch({ type: 'ACTION_TYPE', payload: value })`
- Never direct state mutation
- `dispatch` passed to helper functions when needed: `resetInvoiceCounter(dispatch, newCounter)`
- Context accessed via `const { state, dispatch } = useApp()`

## Styling Patterns

### CSS Approach
- **Tailwind CSS** as primary styling system with custom Espresso & Copper theme
- **Component CSS classes** defined in `src/index.css` under `@layer components`
- Dark mode via `class` strategy (`darkMode: 'class'` in tailwind.config.js)

### Class Naming
Custom component classes in index.css:
- `.card`, `.card-glass`, `.card-hover` -- container styles
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.btn-ghost` -- button variants
- `.btn-sm`, `.btn-md`, `.btn-lg` -- button sizes
- `.input`, `.select`, `.textarea`, `.input-sm` -- form elements
- `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer` -- modal structure
- `.table`, `.table-header`, `.table-row`, `.table-cell`, `.table-header-cell` -- table styles
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-accent` -- badges
- `.stat-card`, `.stat-card-success`, `.stat-card-warning`, `.stat-card-danger` -- stat cards

### Responsive Patterns
- Touch mode check: `state.settings.interfaceMode === 'touch'` applies `.touch-friendly` class
- Tailwind responsive prefixes used sparingly (mostly `md:`, `lg:`)
- Dark mode variants: `dark:bg-[#2a1a10]`, `dark:text-secondary-300`

### Animations
- Framer Motion used consistently: `motion.div`, `motion.button`, `motion.input`
- Standard transitions: `transition={{ duration: 0.2 }}`
- Hover effects: `whileHover={{ scale: 1.02 }}`
- Tap effects: `whileTap={{ scale: 0.98 }}`
- Entry animations: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`

## Error Handling

### Try/Catch Pattern
Standard async error handling with user-facing toasts:
```tsx
try {
  swalConfig.loading('Deleting product...');
  await productsService.delete(productId);
  swalConfig.success('Product deleted successfully!');
} catch (error) {
  console.error('Error deleting product:', error);
  swalConfig.error('Failed to delete product. Please try again.');
}
```

### User-Facing Errors
- `swalConfig.error(message)` for error toasts
- `swalConfig.success(message)` for success toasts
- `swalConfig.warning(message)` for validation warnings
- `swalConfig.loading(message)` for loading states
- `swalConfig.deleteConfirm(itemName)` for destructive action confirmation
- `swalConfig.close()` to dismiss loading modals

### Console Logging
- `console.error('Error context:', error)` in catch blocks
- No structured logging or error reporting service
- Auth errors mapped to user-friendly messages via `getAuthErrorMessage()`

## TypeScript Usage

### Strict Mode
Strict mode enabled in tsconfig.app.json:
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

### Type vs Interface
- **`interface`** for all object shapes: `Product`, `AppState`, `ButtonProps`, `AuthContextType`
- **`type`** for union types and discriminated unions: `AppAction`, `CurrencyAction`, `AlertType`
- No `type` used for object shapes (consistent preference for `interface`)

### Generic Patterns
- Supabase client typed with generated Database types: `createClient<Database>(...)`
- Service methods return typed promises: `Promise<Product[]>`, `Promise<Sale>`
- `Omit` utility for create inputs: `Omit<Product, 'id' | 'createdAt' | 'updatedAt'>`
- `Partial` for update inputs: `Partial<Product>`, `Partial<AppSettings>`

### Any Types / Type Safety Issues
Significant `any` usage found:
- **JSONB columns**: `sale.items as any[]`, `sale.payments as any`, `discount.conditions as any` -- Supabase returns `Json` type, cast to `any` instead of proper types
- **Enum casts**: `data.role as any`, `data.status as any`, `data.type as any` -- string from DB cast to union types
- **Error catches**: `catch (error: any)` -- common pattern in async functions
- **Recharts formatters**: `(value: any, name: string)` -- library callback types
- **Dispatch typing**: `dispatch: any` in helper functions `resetInvoiceCounter`, `setInvoicePrefix`
- **DiscountCondition.value**: `value: any` -- intentionally loose for polymorphic conditions

## Documentation Patterns

### Comment Density
- Minimal inline comments -- code is mostly self-documenting
- Occasional section markers: `// Products Service`, `// Customers Service`
- Feature-related comments: `// New fields for advanced features`, `// For weight-based products`
- TODO/NOTE patterns: `// NOTE: supabaseAdmin has been removed...`
- No JSDoc annotations found anywhere in the codebase

### Architecture Documentation
- Comprehensive docs in `docs/` directory (architecture, specs, patterns)
- `CLAUDE.md` serves as the primary developer reference
- Type interfaces have occasional inline comments explaining fields
