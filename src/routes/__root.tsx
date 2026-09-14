import { api } from '@convex/_generated/api';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useAction, useConvexAuth } from 'convex/react';
import * as React from 'react';
import { AppShell } from '~/components/AppShell';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { Providers } from '~/components/Providers';
import { authClient, useSession } from '~/features/auth/auth-client';
import { getToken } from '~/lib/auth-server';
import { setupClaimRefresh } from '~/lib/roleRefresh';
import appCss from '~/styles/app.css?url';

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken();
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  token?: string | null;
  isAuthenticated: boolean;
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
          <ProfileBootstrapper />
          <Providers>
            <AppShell />
          </Providers>
        </ConvexBetterAuthProvider>
      </RootDocument>
    </ErrorBoundaryWrapper>
  );
}

function ProfileBootstrapper() {
  const { data: session } = useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreateProfile = useAction(api.users.getOrCreateProfile);
  const bootstrappedUserId = React.useRef<string | null>(null);
  const userId = session?.user?.id ?? null;

  React.useEffect(() => {
    if (isLoading || !isAuthenticated || !userId || bootstrappedUserId.current === userId) {
      return;
    }

    bootstrappedUserId.current = userId;
    void getOrCreateProfile({}).catch((error) => {
      console.error('Unable to prepare the signed-in user profile:', error);
    });
  }, [getOrCreateProfile, isAuthenticated, isLoading, userId]);

  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme:dark)').matches,theme=t||(d?'dark':'light');document.documentElement.classList.toggle('dark',theme==='dark')}catch(e){}})()`,
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
