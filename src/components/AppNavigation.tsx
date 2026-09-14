import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { LogOut, Shield, User } from 'lucide-react';
import { FiresalesMark } from '~/components/FiresalesMark';
import { MobileNavigation } from '~/components/MobileNavigation';
import { ThemeToggle } from '~/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { navigationMenuTriggerStyle } from '~/components/ui/navigation-menu';
import { signOut } from '~/features/auth/auth-client';
import { useAuth } from '~/features/auth/hooks/useAuth';
import { useAuthState } from '~/features/auth/hooks/useAuthState';
import { cn } from '~/lib/utils';

/**
 * Authentication Navigation - Sign in/out links
 */
function AuthNavigation({ currentPath }: { currentPath: string }) {
  const authState = useAuthState();
  const { user, isAuthenticated, isPending, isAdmin } = useAuth({
    fetchRole: authState.isAuthenticated,
  });
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      // Call signOut from Better Auth client
      await signOut({
        fetchOptions: {
          // Increase timeout and handle potential network issues
          signal: AbortSignal.timeout(1000), // 10 second timeout
        },
      });
      // Navigate to home page after sign out
      navigate({ to: '/' });
    } catch (error) {
      console.error('❌ NAVIGATION: Error signing out:', error);
      // Still navigate to home even if signOut fails to avoid stuck auth state
      navigate({ to: '/' });
    }
  };

  if (isPending) {
    return <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />;
  }

  if (isAuthenticated) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            title="User menu"
          >
            {user?.name ? (
              <span className="text-sm font-medium text-secondary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link
                to="/app/admin"
                className="flex items-center gap-2 w-full cursor-pointer text-destructive hover:text-destructive focus:text-destructive"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/app/profile" className="flex items-center gap-2 w-full cursor-pointer">
              <User className="w-4 h-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        to="/login"
        preload="intent"
        search={{ redirect: currentPath }}
        className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign in
      </Link>
      <Link
        to="/register"
        preload="intent"
        className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
      >
        Start a drop
      </Link>
    </div>
  );
}

/**
 * Main Application Navigation Component
 */
export function AppNavigation() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.5rem] justify-between overflow-visible">
          <div className="flex items-center md:hidden">
            <Link
              to="/"
              preload="intent"
              aria-label="Firesales home"
              className="rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <FiresalesMark compact />
            </Link>
          </div>

          <div className="hidden items-center gap-7 md:flex">
            <Link
              to="/"
              preload="intent"
              className="rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <FiresalesMark />
            </Link>

            {isAuthenticated && (
              <div className="flex items-center gap-1 rounded-full border border-border/80 bg-card/70 p-1">
                <Link
                  to="/app/seller/dashboard"
                  preload="intent"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'h-8 rounded-full bg-transparent px-3 text-xs font-semibold no-underline',
                  )}
                  activeOptions={{ exact: true }}
                >
                  Studio
                </Link>
                <Link
                  to="/dashboard/flash-sales"
                  preload="intent"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'h-8 rounded-full bg-transparent px-3 text-xs font-semibold no-underline',
                  )}
                >
                  Your drops
                </Link>
                <Link
                  to="/dashboard/flash-sales/create"
                  preload="intent"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'h-8 rounded-full bg-transparent px-3 text-xs font-semibold no-underline',
                  )}
                >
                  Create
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <div className="md:hidden">
              <MobileNavigation />
            </div>

            <div className="mr-2 hidden md:block">
              <ThemeToggle />
            </div>

            <div className="hidden md:block">
              <AuthNavigation currentPath={location.pathname} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
