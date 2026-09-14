import { api } from '@convex/_generated/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { useSession } from '~/features/auth/auth-client';

export interface AuthState {
  isAuthenticated: boolean;
  isPending: boolean;
  error: Error | null;
  userId: string | undefined;
}

export function useAuthState(): AuthState {
  const { data: session, isPending, error } = useSession();
  return {
    isAuthenticated: !!session?.user,
    isPending,
    error,
    userId: session?.user?.id,
  };
}

export function useAuthRole(): 'seller' | 'platform_admin' | null {
  const { userId } = useAuthState();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.users.getCurrentUserProfile,
    userId && isConvexAuthenticated ? {} : 'skip',
  );
  if (!profile) return null;
  const role = profile.role;
  if (role === 'platform_admin' || role === 'admin') return 'platform_admin';
  return 'seller';
}
