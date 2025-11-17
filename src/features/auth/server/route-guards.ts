import { type ParsedLocation, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '~/features/auth/server/auth-guards';
import type { RouterAuthContext } from '~/router';
import type { Capability } from '../../../../convex/authz/policy.map';
import { Caps } from '../../../../convex/authz/policy.map';

export async function routeAdminGuard({
  location,
}: {
  location: ParsedLocation;
}): Promise<RouterAuthContext> {
  try {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timeout')), 10000),
    );

    const authPromise = getCurrentUserServerFn();
    const result = await Promise.race([authPromise, timeoutPromise]);

    // Use capability-based checking for consistency with the RBAC system
    const adminCapability: Capability = 'route:/app/admin';
    const allowedRoles = Caps[adminCapability] ?? [];

    if (!result.user?.role || !(allowedRoles as readonly string[]).includes(result.user.role)) {
      if (import.meta.env.DEV) {
        console.warn('[routeAdminGuard] Access denied:', {
          userRole: result.user?.role,
          requiredRoles: allowedRoles,
          path: location.pathname,
        });
      }
      throw redirect({ to: '/login', search: { reset: '', redirect: location.href } });
    }

    return { authenticated: true as const, user: result.user };
  } catch (error) {
    // Enhanced error logging in development
    if (import.meta.env.DEV) {
      console.error('[routeAdminGuard] Auth check failed:', {
        error: error instanceof Error ? error.message : String(error),
        path: location.pathname,
        href: location.href,
      });
    }

    // Check if this is a timeout error
    if (error instanceof Error && error.message === 'Auth check timeout') {
      if (import.meta.env.DEV) {
        console.error('[routeAdminGuard] Auth check timed out:', location.pathname);
      }
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }

    // Check if this is an authentication error (user not authenticated)
    if (error instanceof Error && error.message.includes('redirect')) {
      // This is likely a redirect from requireAuth, so re-throw it
      throw error;
    }

    // Re-throw redirects as-is, wrap other errors
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      throw error;
    }

    // For other errors, redirect to login
    throw redirect({ to: '/login', search: { redirect: location.href } });
  }
}

/**
 * Server function for auth validation - only called for admin routes
 * This is expensive (hits Convex) so we minimize its usage
 */
const getCurrentUserServerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Extract<RouterAuthContext, { authenticated: true }>> => {
    try {
      const { user } = await requireAuth();

      // Validate that we have all required user data
      if (!user.id || !user.email) {
        if (import.meta.env.DEV) {
          console.error('[getCurrentUserServerFn] Invalid user data:', { user });
        }
        throw new Error('Invalid user session data');
      }

      return {
        authenticated: true as const,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[getCurrentUserServerFn] Failed to get user:', error);
      }
      throw error; // Re-throw to let the route guard handle it
    }
  },
);
