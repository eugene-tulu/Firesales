import { createRouter } from '@tanstack/react-router';
import { QueryClient, notifyManager } from '@tanstack/react-query';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { ConvexProvider } from 'convex/react';
import { initializeSentry } from '~/lib/sentry';
import type { UserId } from '~/lib/shared/user-id';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { NotFound } from './components/NotFound';
import { routeTree } from './routeTree.gen';

// Auth context type for route-level caching - matches root loader return type
export type RouterAuthContext =
  | {
      authenticated: false;
      user: null;
    }
  | {
      authenticated: true;
      user: { id: UserId; email: string; name?: string; role: string } | null; // null for optimistic auth
    };

export function getRouter() {
  if (typeof document !== 'undefined') {
    // Set up requestAnimationFrame scheduler for React Query in the browser
    notifyManager.setScheduler(window.requestAnimationFrame);
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL!;
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set');
  }

  const convexQueryClient = new ConvexQueryClient(convexUrl, {
    expectAuth: true,
  });

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });

  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      context: {
        queryClient,
        convexQueryClient,
      } satisfies { queryClient: QueryClient; convexQueryClient: ConvexQueryClient },
      defaultPreload: 'intent',
      defaultPreloadStaleTime: 30_000,
      defaultPreloadGcTime: 5 * 60_000,
      defaultErrorComponent: DefaultCatchBoundary,
      defaultNotFoundComponent: () => <NotFound />,
      scrollRestoration: false,
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
      ),
    }),
    queryClient,
  );

  // Initialize Sentry for error tracking and performance monitoring
  initializeSentry(router);

  return router;
}
