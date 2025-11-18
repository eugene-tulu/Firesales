import { authClient } from '~/features/auth/auth-client';

/**
 * Claim refresh helper - refreshes Better Auth claims when the window regains focus
 * so role changes on the server propagate quickly without forcing a full reload.
 *
 * @param maxAgeMs - Maximum age of claims before refresh (default: 20 minutes)
 */
let isRefreshing = false;

export function setupClaimRefresh(maxAgeMs = 20 * 60_000) {
  if (typeof window === 'undefined') return () => {};

  // Check if we're on an authentication flow page
  const isAuthPage = () => {
    const currentPath = window.location.pathname;
    return ['/login', '/register', '/forgot-password', '/reset-password'].some((authPath) =>
      currentPath.startsWith(authPath),
    );
  };

  // Track if we have a stable session
  let hasStableSession = false;

  const maybeRefresh = async () => {
    // Skip if already refreshing or on auth pages
    if (isRefreshing || isAuthPage()) {
      hasStableSession = false;
      return;
    }

    if (!authClient.getSession) return;

    isRefreshing = true;
    try {
      const snapshot = await authClient.getSession();

      // Safe property access with type guards
      if (!snapshot || typeof snapshot !== 'object') {
        // No session means we don't have a stable session
        hasStableSession = false;
        return;
      }

      const user = (snapshot as Record<string, unknown>).user;
      if (!user || typeof user !== 'object') {
        // No user means we don't have a stable session
        hasStableSession = false;
        return;
      }

      // We have a valid session, mark as stable
      hasStableSession = true;

      const userObj = user as Record<string, unknown>;
      const lastRefreshedAt =
        typeof userObj._accessTokenIssuedAt === 'number'
          ? userObj._accessTokenIssuedAt
          : typeof userObj.lastRefreshedAt === 'number'
            ? userObj.lastRefreshedAt
            : 0;

      if (Date.now() - lastRefreshedAt * 1000 > maxAgeMs) {
        // Only refresh if we have a stable session
        if (hasStableSession) {
          await authClient.getSession();
        }
      }
    } catch (error) {
      console.warn('[claim-refresh] Failed to refresh claims', error);
      // On error, assume session is unstable until we can verify again
      hasStableSession = false;
    } finally {
      isRefreshing = false;
    }
  };

  // Initial check after a short delay to allow session establishment
  const initialCheck = setTimeout(() => {
    if (!isAuthPage()) {
      void maybeRefresh();
    }
  }, 1000); // Wait 1 second to allow session to establish

  // Only set up focus listener if not on auth pages
  const focusHandler = () => {
    if (!isAuthPage()) {
      void maybeRefresh();
    }
  };

  window.addEventListener('focus', focusHandler);

  // Listen for route changes to detect when we move to/from auth pages
  const handlePopState = () => {
    if (!isAuthPage()) {
      void maybeRefresh();
    }
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    clearTimeout(initialCheck);
    window.removeEventListener('focus', focusHandler);
    window.removeEventListener('popstate', handlePopState);
  };
}
