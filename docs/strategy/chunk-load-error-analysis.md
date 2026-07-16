# Chunk Load Error Analysis Report

## 1. Root Cause

The root cause is a **Service Worker race condition** combined with **Vite's content-hashed chunk naming** and **lack of retry logic** in the React error boundary.

**Detailed Sequence:**
1.  **Deployment:** A new version of the app is deployed to Vercel. The build process generates new `index.html` (referencing new chunk hashes like `POSTerminal-NEWHASH.js`) and a new `sw.js` with an updated precache manifest. Old chunks are deleted from the server.
2.  **Stale Tab:** A user has the app open in a tab. The browser has the *old* service worker active.
3.  **Navigation:** The user refreshes or navigates to a route. The browser fetches `index.html`. If the browser cache or service worker serves the *old* `index.html`, it will reference `POSTerminal-OLDHASH.js`.
4.  **Chunk Request:** The browser (or service worker) tries to fetch `POSTerminal-OLDHASH.js`.
5.  **404 / Failure:** Since the deployment deleted the old chunk, the request fails (404 Not Found).
6.  **React Error:** `React.lazy` receives the error. The `ErrorBoundary` catches it.
7.  **Retry Loop:** The current `ErrorBoundary` simply resets its state (`hasError: false`). However, `React.lazy` caches the rejected promise for the failed import. The retry immediately fails again, trapping the user on the error screen.

## 2. Affected Components

All lazy-loaded components are at risk, but **POSTerminal** is critical because it's the default view for the POS interface.

| Component | File | Risk Level |
|-----------|------|------------|
| `POSTerminal` | `src/components/pos/POSTerminal.tsx` | **Critical** (Default View) |
| `TransactionsManager` | `src/components/transactions/TransactionsManager.tsx` | High |
| `InventoryManager` | `src/components/inventory/InventoryManager.tsx` | High |
| `CustomerManager` | `src/components/customers/CustomerManager.tsx` | High |
| `ReportsManager` | `src/components/reports/ReportsManager.tsx` | Medium |
| `Settings` | `src/components/settings/Settings.tsx` | Medium |
| `DiscountManager` | `src/components/discounts/DiscountManager.tsx` | Medium |
| `UserManager` | `src/components/users/UserManager.tsx` | Medium |
| `AlertManager` | `src/components/alerts/AlertManager.tsx` | Low |
| `PurchaseLogManager` | `src/components/inventory/PurchaseLogManager.tsx` | Low |
| `StockOverviewManager` | `src/components/inventory/StockOverviewManager.tsx` | Low |

*Note: `ReportsManager` has a duplicate lazy import in `POSTerminal.tsx` (line 12).*

## 3. Current Mitigation

-   **Service Worker Auto-Update:** `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`. This means the new service worker activates immediately (`skipWaiting`) and claims clients (`clientsClaim`). This minimizes the window of vulnerability but does not eliminate it entirely, especially if the user is on a slow connection or the browser caches `index.html` aggressively.
-   **React Error Boundary:** Catches the error and shows a UI, but the "Try Again" button is ineffective because it doesn't invalidate the module cache.

## 4. Recommended Fix Options

### Option A: Auto-Reload on ChunkLoadError (Recommended)
Modify the `ErrorBoundary` to detect `ChunkLoadError` (or network errors related to chunk loading) and automatically trigger `window.location.reload()`. This forces the browser to fetch the latest `index.html` and chunks.

**Pros:**
-   **User Experience:** Seamless recovery. The user might see a brief flash, but the app will load correctly without manual intervention.
-   **Simplicity:** Very easy to implement.

**Cons:**
-   **Reload Fatigue:** If the error is due to a permanent issue (e.g., broken build), the user might get stuck in a reload loop. (Mitigation: Limit retries or check error message).

### Option B: Service Worker Update Strategy
Modify the service worker lifecycle to ensure users always get the latest version. This is already largely handled by `autoUpdate`, but we could add a "Update Available" toast that forces a refresh when a new SW is detected.

**Pros:**
-   **Proactive:** Prevents the user from ever seeing the stale version.

**Cons:**
-   **Complexity:** Requires more custom SW logic.
-   **Intrusiveness:** Asking users to refresh manually is often ignored.

### Option C: Vercel Cache Headers
Adjust `vercel.json` to ensure `index.html` is *never* cached (`Cache-Control: no-cache`). This ensures the browser always gets the latest entry point, which points to the correct chunks.

**Pros:**
-   **Preventative:** Stops the mismatch from happening at the source.

**Cons:**
-   **Performance:** `index.html` will be fetched on every navigation, slightly increasing latency.
-   **Reliance on Platform:** Depends on Vercel's caching behavior.

### Option D: Custom Error Boundary with Retry UI
Similar to Option A, but instead of auto-reloading, show a clear message: "A new version is available. Please refresh." with a "Refresh Now" button.

**Pros:**
-   **Transparency:** User knows *why* it happened.
-   **Control:** User decides when to refresh.

**Cons:**
-   **Friction:** Requires user action.

## 5. Recommendation

**Option A (Auto-Reload) + Option C (No-Cache for index.html)** is the best approach.

1.  **Fix the ErrorBoundary:** Detect `ChunkLoadError` and auto-reload (max 1 retry). This handles cases where the user already has a stale tab open.
2.  **Set `Cache-Control: no-cache` for `index.html`:** Prevent the browser from serving a stale entry point. Hashed assets (JS/CSS) should remain immutable/cached.

This combination ensures:
-   New deployments are picked up immediately (Option C).
-   Stale tabs recover automatically (Option A).
-   Performance remains high (assets are still cached).
