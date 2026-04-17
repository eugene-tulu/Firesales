import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { AppShell } from '~/components/AppShell';
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary';
import { NotFound } from '~/components/NotFound';
import { Providers } from '~/components/Providers';
import { seo } from '~/lib/seo';
import appCss from '~/styles/app.css?url';

const convexPreconnect =
  import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_CONVEX_SITE_URL || undefined;

// Extract origin from Cloudflare Worker URL for preconnect
const cloudflareWorkerUrl = import.meta.env.CLOUDFLARE_WORKER_URL;
const cloudflarePreconnect = cloudflareWorkerUrl
  ? (() => {
      try {
        const url = new URL(cloudflareWorkerUrl);
        return url.origin;
      } catch {
        return null;
      }
    })()
  : null;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'Firesales - Flash Sale Platform',
        description:
          'Firesales is the all-in-one platform for creating, managing, and optimizing flash sales. Scrape product details, set inventory, and launch sales that drive urgency and boost revenue.',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
      ...(convexPreconnect
        ? [{ rel: 'preconnect', href: convexPreconnect, crossOrigin: 'anonymous' as const }]
        : []),
      ...(cloudflarePreconnect
        ? [{ rel: 'preconnect', href: cloudflarePreconnect, crossOrigin: 'anonymous' as const }]
        : []),
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootDocument,
});

// Root document component that renders the full HTML structure
function RootDocument() {
  return (
    <html
      lang="en"
      // Suppress hydration warnings for theme-related attributes
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>
          <AppShell />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
