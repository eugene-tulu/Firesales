import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';

export const Route = createFileRoute('/app/admin/_layout')({
  component: AdminLayout,
  errorComponent: AdminErrorBoundary,
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
    if (context.user?.role !== 'admin') {
      throw redirect({ to: '/app' });
    }
  },
});

function AdminLayout() {
  return <Outlet />;
}
