import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { NotFound } from '~/components/NotFound';
import { DashboardErrorBoundary } from '~/components/RouteErrorBoundaries';

export const Route = createFileRoute('/app')({
  pendingMs: 150,
  pendingMinMs: 250,
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
    </div>
  ),
  component: () => <Outlet />,
  errorComponent: DashboardErrorBoundary,
  notFoundComponent: () => <NotFound />,
  beforeLoad: ({ context }) => {
    if (typeof window !== 'undefined') return;
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
