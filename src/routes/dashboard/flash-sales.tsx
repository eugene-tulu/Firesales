import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/flash-sales')({
  component: () => <Outlet />,
  beforeLoad: ({ context }) => {
    if (typeof window !== 'undefined') return;
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
});
