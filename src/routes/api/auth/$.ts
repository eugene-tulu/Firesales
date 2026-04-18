import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start';
import { createFileRoute } from '@tanstack/react-router';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
if (!convexUrl || !convexSiteUrl) {
  throw new Error('VITE_CONVEX_URL and VITE_CONVEX_SITE_URL must be set for auth route');
}

const { handler } = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
});

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return handler(request);
      },
      POST: ({ request }) => {
        return handler(request);
      },
    },
  },
});
