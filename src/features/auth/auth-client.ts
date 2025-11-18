import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Function to get the correct site URL for client-side usage
function getClientSiteUrl(): string {
  // If we're in a browser environment, use the current window location
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Fallback to server-side environment variables for SSR
  const candidates: Array<string | undefined> = [
    process.env.BETTER_AUTH_SITE_URL,
    process.env.BETTER_AUTH_BASE_URL,
    process.env.SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
    process.env.URL,
    process.env.DEPLOY_URL,
    process.env.DEPLOY_PRIME_URL,
  ];

  for (const value of candidates) {
    if (value) {
      const trimmed = value.trim();
      if (trimmed && /^https?:\/\//i.test(trimmed)) {
        try {
          const url = new URL(trimmed);
          return url.origin;
        } catch {}
      }
    }
  }

  // Local development fallback
  return 'http://localhost:3000';
}

export const authClient = createAuthClient({
  plugins: [convexClient()],
  baseURL: getClientSiteUrl(),
});

export const { signIn, signOut, useSession } = authClient;
