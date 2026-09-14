import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { Flame, Lock, Mail, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { z } from 'zod';
import { AuthSkeleton } from '~/components/AuthSkeleton';
import { FiresalesMark } from '~/components/FiresalesMark';
import { Button } from '~/components/ui/button';
import { Field, FieldLabel } from '~/components/ui/field';
import { InputGroup, InputGroupIcon, InputGroupInput } from '~/components/ui/input-group';
import { signIn } from '~/features/auth/auth-client';
import { useAuthState } from '~/features/auth/hooks/useAuthState';

const REDIRECT_TARGETS = [
  '/app',
  '/app/profile',
  '/app/orders',
  '/app/admin',
  '/app/admin/users',
  '/app/admin/stats',
  '/app/seller/dashboard',
  '/dashboard/flash-sales',
  '/dashboard/flash-sales/create',
] as const;

type RedirectTarget = (typeof REDIRECT_TARGETS)[number];

export const Route = createFileRoute('/login')({
  component: LoginPage,
  errorComponent: () => <div>Something went wrong</div>,
  pendingComponent: AuthSkeleton,
  validateSearch: z.object({
    email: z
      .string()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .optional(),
    redirect: z.string().optional(),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) {
      throw redirect({ to: resolveRedirectTarget(search.redirect) ?? '/app' });
    }
  },
});

function resolveRedirectTarget(value?: string | null): RedirectTarget | null {
  if (!value) return null;

  const [path] = value.split('?');
  return REDIRECT_TARGETS.find((route) => route === path) ?? null;
}

function LoginPage() {
  const { email: emailFromQuery, redirect: redirectParam } = Route.useSearch();
  const redirectTarget = resolveRedirectTarget(redirectParam);
  const uid = useId();
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const { isPending } = useAuthState();
  const navigate = useNavigate();

  const [error, setError] = useState('');

  const form = useForm({
    defaultValues: { email: emailFromQuery || '', password: '' },
    onSubmit: async ({ value }) => {
      setError('');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.email || !emailRegex.test(value.email)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!value.password) {
        setError('Password is required.');
        return;
      }

      try {
        const { data, error: signInError } = await signIn.email({
          email: value.email,
          password: value.password,
          rememberMe: true,
        });

        if (signInError) {
          if (signInError.status === 403) {
            setError('Please verify your email address before signing in.');
          } else if (signInError.status === 401) {
            setError('Invalid email or password. Please try again.');
          } else {
            setError(signInError.message || 'Sign-in failed. Please try again.');
          }
          return;
        }

        if (data) {
          const target = redirectTarget ?? '/app/seller/dashboard';
          void navigate({ to: target, replace: true });
        } else {
          setError('Login failed. Please try again.');
        }
      } catch {
        setError('Login failed. Please try again.');
      }
    },
  });

  if (isPending) return <AuthSkeleton />;

  return (
    <div className="page-atmosphere -mx-4 -my-6 flex min-h-screen items-center px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-primary/20 bg-card/90 shadow-2xl shadow-primary/10 md:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-foreground p-10 text-background md:block">
          <div className="quiet-grid absolute inset-0 opacity-20" />
          <div className="relative flex h-full flex-col">
            <Link
              to="/"
              className="w-fit rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <FiresalesMark subtitle="Chef drop studio" />
            </Link>
            <div className="my-auto">
              <p className="text-kicker flex items-center gap-2 text-[0.65rem] font-bold text-primary">
                <Flame className="size-3.5" /> Back to the kitchen
              </p>
              <h1 className="font-editorial mt-4 text-5xl font-bold leading-[0.95] tracking-[-0.055em]">
                The next invitation starts with a quiet idea.
              </h1>
              <p className="mt-6 max-w-sm leading-7 text-background/70">
                Open your studio, shape the menu, and let Firesales keep the guest list and prep
                count in sync.
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-background/65">
              <Sparkles className="size-4 text-primary" /> Small batch. Clear promise. Less
              guessing.
            </p>
          </div>
        </section>

        <section className="px-7 py-9 sm:px-10 sm:py-12">
          <div className="md:hidden">
            <Link
              to="/"
              className="inline-flex rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <FiresalesMark />
            </Link>
          </div>
          <p className="text-kicker mt-8 text-xs font-bold text-primary md:mt-0">Chef sign-in</p>
          <h2 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.045em]">
            Welcome back.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Pick up where you left off—or start a fresh little occasion.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}
            <form.Field name="email">
              {(field) => (
                <Field>
                  <FieldLabel className="sr-only">Email address</FieldLabel>
                  <InputGroup>
                    <InputGroupIcon>
                      <Mail />
                    </InputGroupIcon>
                    <InputGroupInput
                      id={emailId}
                      name={field.name}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </Field>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <Field>
                  <FieldLabel className="sr-only">Password</FieldLabel>
                  <InputGroup>
                    <InputGroupIcon>
                      <Lock />
                    </InputGroupIcon>
                    <InputGroupInput
                      id={passwordId}
                      name={field.name}
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </Field>
              )}
            </form.Field>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base shadow-lg shadow-primary/20"
            >
              Open my studio
            </Button>
            <div className="space-y-3 pt-1 text-center">
              <div>
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  Forgot your password?
                </Link>
              </div>
              <div>
                <Link to="/register" className="font-medium text-primary hover:text-primary/80">
                  New here? Start your first drop
                </Link>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
