# Testing

## Test Framework

### Current State
**No test framework is configured.** There are zero test files in the project source. No test runner, assertion library, or testing utilities are installed.

### Recommended Framework (per CLAUDE.md)
- **Runner**: Vitest (compatible with Vite toolchain)
- **Component testing**: React Testing Library
- **Assertion**: Vitest built-in (`expect`)
- **Run command**: `npx vitest`

### Dependencies Not Yet Installed
The following would need to be added to `devDependencies`:
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `jsdom` (for Vitest browser environment)

## Test Organization

### Recommended Structure (per CLAUDE.md)
```
src/
  components/
    pos/
      __tests__/
        ProductGrid.test.tsx
        CheckoutModal.test.tsx
      ProductGrid.tsx
      CheckoutModal.tsx
    inventory/
      __tests__/
        InventoryManager.test.tsx
      InventoryManager.tsx
  lib/
    __tests__/
      services.test.ts
      currencyUtils.test.ts
  context/
    __tests__/
      SupabaseAppContext.test.tsx
```

### File Naming
- Component tests: `__tests__/ComponentName.test.tsx` co-located with the component
- Service tests: `__tests__/services/` under `src/lib/`
- Convention: `.test.ts` / `.test.tsx` suffix (not `.spec`)

## Test Patterns

### Unit Test Patterns
No existing tests to reference. Recommended patterns based on codebase structure:

**Service layer tests** -- mock Supabase client, test CRUD operations:
```ts
// src/lib/__tests__/services.test.ts
import { describe, it, expect, vi } from 'vitest';
import { productsService } from '../services';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    // ...
  }
}));
```

**Pure function tests** -- test currency formatting, discount eligibility:
```ts
// src/lib/__tests__/currencyUtils.test.ts
import { describe, it, expect } from 'vitest';
import { CurrencyUtils } from '../currencyUtils';
```

### Component Test Patterns
No existing tests. Components are tightly coupled to context providers, so tests need wrapper setup:

```tsx
// Would need a test utility wrapper
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <CurrencyProvider>
            {ui}
          </CurrencyProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### Mock/Stub Strategies
Key areas requiring mocks:
- **Supabase client** (`src/lib/supabase.ts`) -- mock `createClient` return value
- **Service objects** (`src/lib/services.ts`) -- mock individual service methods
- **Context providers** -- wrap components with test providers or mock `useApp()`/`useAuth()`
- **SweetAlert2** (`src/lib/sweetAlert.ts`) -- mock `Swal.fire()` to prevent DOM side effects
- **localStorage** -- for cart persistence tests
- **Framer Motion** -- may need mock for `motion.div` in snapshot tests

## Test Coverage

### Current Coverage
**0%** -- No tests exist. No coverage tooling configured.

### Coverage Commands
Once Vitest is configured:
```bash
npx vitest --coverage    # Run with coverage report
npx vitest --ui          # Visual test UI
```

Vitest coverage would need `@vitest/coverage-v8` or `@vitest/coverage-istanbul` installed.

## Test Commands

### Current
```bash
npm run lint       # ESLint only -- no test command exists
```

### Recommended (after setup)
```bash
npx vitest                    # Run all tests in watch mode
npx vitest run                # Run once (CI mode)
npx vitest run --reporter verbose  # Detailed output
npx vitest path/to/file.test.ts    # Run specific file
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest --coverage"
  }
}
```

## Testing Gaps

### What IS Tested
Nothing. Zero test files in `src/`.

### Critical Paths Without Tests

**High Priority -- Business Logic:**
- Checkout flow (`CheckoutModal.tsx`) -- payment processing, split payments, discount application, inventory deduction, sale creation
- Discount eligibility (`checkDiscountEligibility()` in SupabaseAppContext) -- complex condition matching with min_amount, specific_products, payment_method, customer_tier, card_type, bank_name
- Invoice generation (`useInvoiceGeneration()`) -- counter increment, prefix formatting
- Cart operations -- add/update/remove with weight-based products, batch tracking
- Currency conversion (`CurrencyUtils`) -- exchange rate caching, formatting, conversion math

**High Priority -- Data Layer:**
- All service CRUD operations (`productsService`, `salesService`, `customersService`, etc.) -- camelCase/snake_case mapping correctness
- SupabaseAppContext reducer -- all 25+ action types, state immutability
- Cart persistence to localStorage -- save/restore/clear
- Sales tab management -- user-scoped CRUD, active tab switching

**Medium Priority -- Auth:**
- Auth flow (`AuthContext.tsx`) -- signIn, signUp, signOut, profile loading
- Role-based access -- cashier POS-only restriction, admin/manager permissions
- Error message mapping (`getAuthErrorMessage()`)

**Medium Priority -- UI:**
- Modal open/close lifecycle with form state reset
- Search and filter logic in ProductGrid, InventoryManager, CustomerManager
- Touch mode vs traditional mode rendering
- Lazy-loaded route components with Suspense fallbacks

**Lower Priority:**
- ThemeContext -- localStorage persistence, system theme detection
- Alert system (not wired into main nav yet)
- Reports/Charts rendering (Recharts-dependent)

### Why Tests Are Missing
- No test infrastructure was set up during initial project scaffolding
- `package.json` has no test script or test dependencies
- `vite.config.ts` has no test configuration
- CLAUDE.md documents the intent but no tests have been written yet
- The project appears to be in active development with manual testing

### Recommended Testing Priority
1. Service layer unit tests (pure functions, easy to mock Supabase)
2. Reducer logic tests (pure function, no mocking needed)
3. Currency/discount utility tests (pure business logic)
4. Component integration tests (requires provider wrappers)
5. E2E tests for checkout flow (Playwright or Cypress, if desired)
