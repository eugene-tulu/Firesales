import { createFileRoute } from '@tanstack/react-router';
import { SellerDashboard } from '~/routes/app/seller/dashboard';

export const Route = createFileRoute('/app/')({
  component: SellerDashboard,
});
