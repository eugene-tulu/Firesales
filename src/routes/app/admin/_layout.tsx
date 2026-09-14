import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';
import { useAuthRole } from '~/features/auth/hooks/useAuthState';

export const Route = createFileRoute('/app/admin/_layout')({
  component: AdminLayout,
  errorComponent: AdminErrorBoundary,
  beforeLoad: ({ context }) => {
    if (typeof window !== 'undefined') return;
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});

function AdminLayout() {
  const role = useAuthRole();

  if (role === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  return role === 'platform_admin' ? <Outlet /> : <Navigate to="/app/seller/dashboard" replace />;
}
