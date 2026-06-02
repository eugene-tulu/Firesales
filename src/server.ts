import { createStartHandler, defaultRenderHandler } from '@tanstack/react-start/server';
import { getCurrentUser } from '~/features/auth/server/auth-guards';
import { setSentryServerUser } from '~/lib/sentry';

// Database connection is now handled with lazy initialization via db proxy
// No need to initialize on server startup as the proxy handles this automatically

const handler = createStartHandler(async ({ request, router, responseHeaders }) => {
  // Set Sentry user context for server-side events
  try {
    const user = await getCurrentUser();
    if (user) {
      setSentryServerUser(user);
    } else {
      setSentryServerUser(null);
    }
  } catch {
    setSentryServerUser(null);
  }

  // Security headers (production-grade CSP tuned for Convex + Vite + TanStack)
  // Note: 'unsafe-eval' required for Vite dev server; 'unsafe-inline' for React hydration
  // In production builds (non-dev), these could be further tightened
  const isDev = import.meta.env.DEV;

  // Build script-src dynamically to avoid duplicate directives
  let scriptSrc = "'self' 'unsafe-inline'";
  if (isDev) {
    // Vite dev client uses eval() for HMR
    scriptSrc += " 'unsafe-eval'";
  }

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
  ];

  responseHeaders.set('Content-Security-Policy', csp.join('; '));

  // Prevent MIME type sniffing
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  responseHeaders.set('X-Frame-Options', 'DENY');
  // Referrer policy
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // XSS protection (legacy but harmless)
  responseHeaders.set('X-XSS-Protection', '1; mode=block');

  // Set Document-Policy header to enable browser profiling
  responseHeaders.set('Document-Policy', 'js-profiling');

  // Use the default render handler which should support Suspense properly
  return defaultRenderHandler({ request, router, responseHeaders });
});

export default {
  async fetch(req: Request): Promise<Response> {
    return await handler(req);
  },
};
