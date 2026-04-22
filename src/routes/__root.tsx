import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import * as React from 'react';
import { createServerFn } from '@tanstack/react-start';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';
import appCss from '~/styles/app.css?url';
import { authClient } from '~/features/auth/auth-client';
import { getToken } from '~/lib/auth-server';
import { setupClaimRefresh } from '~/lib/roleRefresh';
import { AppShell } from '~/components/AppShell';
import { Providers } from '~/components/Providers';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';

// Server function to fetch auth token for SSR hydration
const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken();
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const token = await fetchAuthToken();
    if (token && ctx.context.convexQueryClient?.serverHttpClient) {
      ctx.context.convexQueryClient.serverHttpClient.setAuth(token);
    }
    // Return only serializable data for route context
    return { token, isAuthenticated: !!token };
  },
  component: RootComponent,
});

function RootComponent() {
  const { token, convexQueryClient } = Route.useRouteContext();

  React.useEffect(() => {
    return setupClaimRefresh();
  }, []);

  return (
    <ErrorBoundaryWrapper
      title="Authentication Error"
      description="Failed to initialize authentication. Please refresh the page."
      showDetails={false}
    >
      <RootDocument>
        <ConvexBetterAuthProvider
          client={convexQueryClient.convexClient}
          authClient={authClient as any}
          initialToken={token}
        >
          <Providers>
            <AppShell />
          </Providers>
        </ConvexBetterAuthProvider>
      </RootDocument>
    </ErrorBoundaryWrapper>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = saved || (systemDark ? 'dark' : 'light');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
