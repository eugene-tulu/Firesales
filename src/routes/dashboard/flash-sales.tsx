import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/flash-sales')({
  component: () => <Outlet />,
});
