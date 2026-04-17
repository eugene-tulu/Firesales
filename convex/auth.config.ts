import type { AuthConfig } from 'convex/server';

// Use CONVEX_SITE_URL (the standard Convex env var)
// VITE_CONVEX_SITE_URL is a client-side variable and not available in server modules
const domain =
  process.env.CONVEX_SITE_URL || process.env.VITE_CONVEX_SITE_URL || 'http://localhost:3000';

export default {
  providers: [
    {
      domain,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
