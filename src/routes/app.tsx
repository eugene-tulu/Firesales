import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { NotFound } from '~/components/NotFound';
import { DashboardErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Spinner } from '~/components/ui/spinner';
import { useAuth } from '~/features/auth/hooks/useAuth';
import { routeAuthGuard } from '~/features/auth/server/route-guards';

export const Route = createFileRoute('/app')({
  pendingMs: 150,
  pendingMinMs: 250,
  pendingComponent: () => <AppLayoutSkeleton />,
  component: AppLayout,
  errorComponent: DashboardErrorBoundary,
  notFoundComponent: () => <NotFound />,
  beforeLoad: routeAuthGuard,
});

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isPending, error } = useAuth();
  const redirectRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  // Use the current pathname as redirect target, but avoid redirect loops
  const currentPath = location.pathname + location.search;
  const redirectTarget =
    currentPath.startsWith('/login') || currentPath.startsWith('/register') || currentPath === '/'
      ? '/app'
      : currentPath;

  useEffect(() => {
    // Only perform redirect logic when auth state is no longer pending
    if (isPending) {
      // Clear any existing redirect timer when pending
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      return;
    }

    // Auth state is initialized, now check authentication
    if (!isAuthenticated) {
      // Only set redirect timer if not already set
      if (redirectTimerRef.current === null) {
        redirectTimerRef.current = window.setTimeout(() => {
          redirectTimerRef.current = null;

          if (redirectRef.current) {
            return;
          }

          redirectRef.current = true;
          void navigate({
            to: '/login',
            search: { redirect: redirectTarget },
            replace: true,
          }).catch(() => {
            redirectRef.current = false;
          });
        }, 400);
      }
    } else {
      // User is authenticated, clear any redirect timer and reset flag
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }

      redirectRef.current = false;
    }
  }, [isAuthenticated, isPending, navigate, redirectTarget]);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  // Show skeleton while auth state is initializing
  if (isPending || !isAuthenticated) {
    return <AppLayoutSkeleton />;
  }

  return <Outlet />;
}

function AppLayoutSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}
