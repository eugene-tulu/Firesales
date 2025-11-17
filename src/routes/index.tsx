import { createFileRoute } from '@tanstack/react-router';
import { MarketingHome } from '~/features/marketing/components/MarketingHome';

export const Route = createFileRoute('/')({
  staticData: true,
  head: () => ({
    meta: [
      {
        title: 'Firesales - Launch High-Impact Flash Sales in Minutes',
      },
      {
        name: 'description',
        content:
          'Firesales is the all-in-one platform for creating, managing, and optimizing flash sales. Scrape product details, set inventory, and launch sales that drive urgency and boost revenue.',
      },
    ],
  }),
  component: MarketingHomeRoute,
});

function MarketingHomeRoute() {
  return <MarketingHome />;
}
