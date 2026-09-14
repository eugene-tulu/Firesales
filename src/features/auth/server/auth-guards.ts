import { api } from '@convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { getToken } from '~/lib/auth-server';
import type { UserId } from '~/lib/shared/user-id';
import { normalizeUserId } from '~/lib/shared/user-id';
import type { UserRole } from '../types';
import { USER_ROLES } from '../types';

export interface AuthenticatedUser {
  id: UserId;
  email: string;
  role: UserRole;
  name?: string;
}

/**
 * Get the current user on the server by using Better Auth token.
 */
async function getCurrentUserServer(): Promise<AuthenticatedUser | null> {
  if (!import.meta.env.SSR) {
    throw new Error('getCurrentUserServer must be called on the server');
  }

  const token = await getToken();
  if (!token) {
    return null;
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set');
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  try {
    const profile = await convex.query(api.users.getCurrentUserProfile, {});
    if (!profile) return null;

    const userId = normalizeUserId(profile);
    if (!userId) return null;

    const userEmail =
      typeof profile.email === 'string' && profile.email.length > 0 ? profile.email : null;
    if (!userEmail) return null;

    return {
      id: userId,
      email: userEmail,
      role: profile.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER,
      name: typeof profile.name === 'string' ? profile.name : undefined,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[getCurrentUserServer] Failed to fetch user profile:', error);
    }
    return null;
  }
}

/**
 * Get the current user on the client using Better Auth client.
 */
async function getCurrentUserClient(): Promise<AuthenticatedUser | null> {
  try {
    const { authClient } = await import('~/features/auth/auth-client');
    const sessionResult = await authClient.getSession();
    if (!('data' in sessionResult) || !sessionResult.data?.user) return null;

    const user = sessionResult.data.user;
    const userId = normalizeUserId(user);
    if (!userId) return null;

    const userEmail = typeof user.email === 'string' && user.email.length > 0 ? user.email : null;
    if (!userEmail) return null;

    return {
      id: userId,
      email: userEmail,
      // Better Auth's browser session does not include our app-specific role.
      // Server callers needing authorization query the profile through Convex.
      role: USER_ROLES.USER,
      name: typeof user.name === 'string' ? user.name : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current session and user information.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (import.meta.env.SSR) {
    return getCurrentUserServer();
  }
  return getCurrentUserClient();
}
