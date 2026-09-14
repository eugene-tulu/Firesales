import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/app/flashSales/products')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/flash-sales' });
  },
  component: () => null,
});
