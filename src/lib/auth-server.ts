import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start';

// Get Convex URLs with fallbacks for development
const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210';
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL || 'http://localhost:3000';

if (!import.meta.env.VITE_CONVEX_URL || !import.meta.env.VITE_CONVEX_SITE_URL) {
  console.warn(
    '[auth-server] VITE_CONVEX_URL or VITE_CONVEX_SITE_URL not set. Using fallback URLs. Set these in .env.local for proper functionality.',
  );
}

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl,
    convexSiteUrl,
  });
