import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { getSiteUrl } from '~/lib/server/env.server';

export const authClient = createAuthClient({
  plugins: [convexClient()],
  baseURL: getSiteUrl(),
});

export const { signIn, signOut, useSession } = authClient;
