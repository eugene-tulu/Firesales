# Firesales Architecture & Fix Log

This document records critical architectural decisions and fixes made during development.
**Do not revert these without understanding why they were put in place.**

---

## Auth Stack

- **Better Auth** via `@convex-dev/better-auth@0.11.x`
- **Convex** as the database and serverless backend
- **TanStack Start** for SSR and routing
- **TanStack Query** via `@convex-dev/react-query` for data fetching

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/lib/auth-server.ts` | Server-side auth utilities — exports `getToken`, `handler`, `fetchAuthQuery` etc. |
| `src/routes/api/auth/$.ts` | Proxies all Better Auth HTTP requests through TanStack Start so cookies are set correctly |
| `convex/auth.ts` | Better Auth config for Convex — uses `createClient(components.betterAuth)` |
| `convex/http.ts` | Registers Better Auth routes via `authComponent.registerRoutes(http, createAuth)` |
| `src/routes/__root.tsx` | Root route — fetches auth token server-side via `createServerFn` and passes to `ConvexBetterAuthProvider` |
| `src/routes/app.tsx` | Layout route for all `/app/*` routes — SSR-only auth guard |

---

## Fix 1: ReadableStream Lock (SSR Hydration)

**Error:** `ReadableStream.getReader: Cannot get a new reader for a readable stream already locked`

**Cause:** `setupRouterSsrQueryIntegration` was used alongside `routerWithQueryClient`. Both fight
over the same QueryClient stream during hydration, locking it.

**Fix:** Remove `setupRouterSsrQueryIntegration` entirely from `src/router.tsx`.
`routerWithQueryClient` alone handles dehydration/rehydration correctly.

**Do not re-add** `setupRouterSsrQueryIntegration` under any circumstances.

---

## Fix 2: ConvexBetterAuthProvider Stream Lock

**Error:** Same ReadableStream lock error, different cause.

**Cause:** `ConvexBetterAuthProvider` was wrapping `RootDocument` which contains `<Scripts />`.
TanStack Start's SSR stream lives inside `<Scripts />`. Having the provider as an ancestor
of `<Scripts />` caused a double-reader conflict.

**Fix:** `RootDocument` must be the outer wrapper. `ConvexBetterAuthProvider` must wrap only
app content inside the body, not `<Scripts />`.

**Correct structure:**
```tsx
<RootDocument>           // outer — contains <Scripts />
  <ConvexBetterAuthProvider>  // inner — wraps only app content
    <Providers>
      <AppShell />
    </Providers>
  </ConvexBetterAuthProvider>
</RootDocument>
```

---

## Fix 3: createClient Misconfiguration

**Error:** `[convex-better-auth] Write operation "create" skipped in query context`

**Cause:** `authComponent` was initialized as:
```ts
createClient<DataModel>({ adapter: components.betterAuth.adapter }) // WRONG
```

**Fix:**
```ts
export const authComponent = createClient<DataModel>(components.betterAuth); // CORRECT
```

Pass `components.betterAuth` directly, not a destructured adapter object.

---

## Fix 4: betterAuth `adapter` vs `database` key

**Error:** Sign-up silently succeeded but user was never written to DB.

**Cause:** `betterAuth({...})` was called with `adapter: authComponent.adapter(ctx)`.
Better Auth does not recognize `adapter` as a top-level key — it expects `database`.

**Fix:**
```ts
return betterAuth({
  // ...
  database: authComponent.adapter(ctx), // was "adapter:", must be "database:"
});
```

---

## Fix 5: Duplicate Auth Handler Instance

**Error:** Session cookie set by sign-in but `getToken()` always returned null.

**Cause:** `src/routes/api/auth/$.ts` was creating its own separate instance of
`convexBetterAuthReactStart` instead of using the shared `handler` from `src/lib/auth-server.ts`.
The two instances had different configurations and the cookie exchange failed.

**Fix:** `src/routes/api/auth/$.ts` must import `handler` from `~/lib/auth-server`:
```ts
import { handler } from '~/lib/auth-server';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
```

---

## Fix 6: Sign-in Loop After Authentication

**Error:** After successful sign-in, page loops back to `/login`.

**Root cause chain:**
1. `navigate({ to: '/app' })` triggers TanStack Router to run `beforeLoad` on all routes
2. Root `beforeLoad` calls `fetchAuthToken()` (a `createServerFn`) to get the token
3. On client-side navigation, `fetchAuthToken()` makes a server request but the
   fresh session cookie is not available in time
4. `token` returns null → `isAuthenticated: false`
5. `/app` route's `beforeLoad` sees `isAuthenticated: false` → redirects to `/login`

**Fix:** Skip the auth guard in `/app` `beforeLoad` during client-side navigation:
```ts
// src/routes/app.tsx
beforeLoad: ({ context }) => {
  if (typeof window !== 'undefined') return; // skip on client navigation
  if (!context.isAuthenticated) {
    throw redirect({ to: '/login' });
  }
},
```

The SSR guard still protects direct URL access. Client-side navigation after
sign-in is handled by `ConvexBetterAuthProvider`'s reactive auth state.

**Do not add** `router.invalidate()` or `setTimeout` delays to the login `onSubmit` handler.
**Do not add** `useEffect`-based redirect logic to `AppLayout`.
The `navigate({ to: redirectTarget })` call alone is sufficient after sign-in.

---

## Fix 7: AppLayout Redirect Loop

**Error:** After navigating to `/app`, brief spinner then redirect back to `/login`.

**Cause:** `AppLayout` component had a `useEffect` that watched `useAuthState()`.
During the `isPending` window (Better Auth confirming session), `isAuthenticated`
was temporarily `false`. A 400ms timer fired and navigated back to `/login`.

**Fix:** `AppLayout` must be a simple pass-through:
```tsx
function AppLayout() {
  return <Outlet />;
}
```

The `beforeLoad` guard is the only auth enforcement needed. Component-level
redirect logic is redundant and harmful.

---

## Fix 8: Better Auth Origin Mismatch

**Error:** `Invalid origin: http://localhost:3001` / `User not found` after registering.

**Cause:** App was running on port 3001 but `BETTER_AUTH_URL=http://localhost:3000`
in Convex env. Better Auth scopes sessions to the origin, so users registered on
3001 cannot sign in when auth validates against 3000.

**Fix:** Always run the dev server on port 3000. Kill any process occupying port 3000
before starting dev:
```bash
lsof -i :3000 | grep LISTEN
kill -9 <PID>
pnpm dev
```

`BETTER_AUTH_URL` in Convex env must always match the actual running port.

---

## Fix 9: tanstackStartCookies Plugin

**Do not add** `tanstackStartCookies()` from `better-auth/tanstack-start` to `convex/auth.ts`.

This plugin is for TanStack Start's server layer, not Convex. Adding it to Convex
causes the bundler to try to resolve `node:async_hooks` and `node:stream` which
are not available in the Convex runtime, breaking all Convex function compilation.

---

## Fix 10: setupRouterSsrQueryIntegration

**Do not add** `setupRouterSsrQueryIntegration` from `@tanstack/react-router-ssr-query` to `src/router.tsx`.

Using it alongside `routerWithQueryClient` causes the ReadableStream lock error (Fix 1).
`routerWithQueryClient` already handles SSR query dehydration/rehydration.

---

## Fix 11: No optimizeDeps Overrides for TanStack Packages

**Do not add** `optimizeDeps.exclude` arrays for TanStack server packages in `vite.config.ts`.
**Do not add** `optimizeDeps.esbuildOptions` with `platform: 'node'`.

These cause `module.createRequire` browser errors by confusing Vite's client/server
bundle boundaries. The only SSR config needed is:
```ts
ssr: {
  noExternal: ['@convex-dev/better-auth'],
},
```

---

## Rules — Never Violate These

1. **Never** use `router.invalidate()` in auth flows (sign-in, sign-up, sign-out)
2. **Never** add `requireAuth()`, `routeAuthGuard()`, or `routeAdminGuard()` in route `beforeLoad`
3. **Never** call `getToken()`, `ConvexHttpClient`, or any server function from child route `beforeLoad`
4. **Never** add `useEffect`-based redirect logic to layout components
5. **Never** wrap `<Scripts />` inside `ConvexBetterAuthProvider`
6. **Never** use `setupRouterSsrQueryIntegration` alongside `routerWithQueryClient`
7. **Never** add `tanstackStartCookies()` to `convex/auth.ts`
8. **Always** run dev server on port 3000 — keep `BETTER_AUTH_URL=http://localhost:3000`
9. **Always** import `handler` from `~/lib/auth-server` in the auth route — never create a new instance
10. **Always** use `database:` (not `adapter:`) when passing the adapter to `betterAuth({})`
