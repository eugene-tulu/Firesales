import { createFileRoute, redirect } from '@tanstack/react-router';

// Preserve old bookmarks while keeping the working experience in the chef
// dashboard rather than maintaining a second, legacy sales console.
export const Route = createFileRoute('/app/flashSales/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard/flash-sales' });
  },
  component: () => null,
});
