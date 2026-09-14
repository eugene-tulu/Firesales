import { Outlet, useLocation } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useEffect, useRef } from 'react';
import { AppNavigation } from '~/components/AppNavigation';
import { ClientOnly } from '~/components/ClientOnly';

/**
 * Application shell component following TanStack Start best practices
 * Handles the main app layout with navigation and content area
 */
export function AppShell() {
  const location = useLocation();
  const prevLocationRef = useRef<string | undefined>(undefined);

  // Track navigation events with more detail
  useEffect(() => {
    const currentPath = location.pathname;
    prevLocationRef.current = currentPath;
  }, [location.pathname]);

  // Hide navigation on auth routes
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(
    location.pathname,
  );
  const isPublicDrop = location.pathname.startsWith('/live/');

  return (
    <>
      <div className="min-h-screen bg-background">
        {!isAuthRoute && !isPublicDrop && <AppNavigation />}
        <main
          className={
            isPublicDrop
              ? ''
              : `mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${isAuthRoute ? 'pt-12' : ''}`
          }
        >
          <Outlet />
        </main>
      </div>
      {import.meta.env.DEV && (
        <ClientOnly>
          <TanStackRouterDevtools position="bottom-right" />
        </ClientOnly>
      )}
    </>
  );
}
