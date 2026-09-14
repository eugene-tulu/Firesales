import { createFileRoute } from '@tanstack/react-router';
import { MarketingHome } from '~/features/marketing/components/MarketingHome';

export const Route = createFileRoute('/')({
  staticData: true,
  head: () => ({
    meta: [
      {
        title: 'Firesales — The sold-out drop engine for food creators',
      },
      {
        name: 'description',
        content:
          'Turn a chef menu into a limited drop with real capacity, secure checkout, and a next-drop waitlist.',
      },
    ],
  }),
  component: MarketingHomeRoute,
});

function MarketingHomeRoute() {
  return <MarketingHome />;
}
