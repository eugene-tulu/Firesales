import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/app/flashSales/analytics')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/flash-sales' });
  },
  component: () => null,
});
