import { createFileRoute, Outlet } from '@tanstack/react-router';
import { routeAuthGuard } from '~/features/auth/server/route-guards';

export const Route = createFileRoute('/dashboard/flash-sales')({
  component: () => <Outlet />,
  beforeLoad: routeAuthGuard,
});
