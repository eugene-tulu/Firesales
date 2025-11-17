import { createFileRoute } from '@tanstack/react-router';
import { FlashSaleCreation } from '~/features/flashSales/components/FlashSaleCreation';

export const Route = createFileRoute('/dashboard/flash-sales/')({
  component: FlashSalesIndex,
});

function FlashSalesIndex() {
  return <FlashSaleCreation />;
}
