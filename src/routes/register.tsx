import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Check, Flame, Lock, Mail, User } from 'lucide-react';
import { useId, useState } from 'react';
import { z } from 'zod';
import { AuthSkeleton } from '~/components/AuthSkeleton';
import { FiresalesMark } from '~/components/FiresalesMark';
import { Button } from '~/components/ui/button';
import { Field, FieldLabel } from '~/components/ui/field';
import { InputGroup, InputGroupIcon, InputGroupInput } from '~/components/ui/input-group';
import { signIn } from '~/features/auth/auth-client';
import { useAuthState } from '~/features/auth/hooks/useAuthState';
import { signUpWithFirstAdminServerFn } from '~/features/auth/server/user-management';

const emailSchema = z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

export const Route = createFileRoute('/register')({
  component: RegisterPage,
  errorComponent: () => <div>Something went wrong</div>,
  pendingComponent: AuthSkeleton,
  validateSearch: z.object({
    email: emailSchema.optional(),
  }),
});

function RegisterPage() {
  const { email: emailFromQuery } = Route.useSearch();
  const uid = useId();
  const { isAuthenticated, isPending } = useAuthState();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const form = useForm({
    defaultValues: { email: emailFromQuery || '', password: '', name: '' },
    onSubmit: async ({ value }) => {
      setError('');
      setSuccessMessage('');

      const email = value.email.trim().toLowerCase();
      const name = value.name.trim();
      if (name.length < 2 || name.length > 50 || !/^[a-zA-Z\s'-]+$/.test(name)) {
        setError('Enter a display name using 2–50 letters, spaces, or hyphens.');
        return;
      }
      if (!emailSchema.safeParse(email).success) {
        setError('Enter a valid email address.');
        return;
      }
      if (value.password.length < 8) {
        setError('Use a password with at least 8 characters.');
        return;
      }

      try {
        await signUpWithFirstAdminServerFn({
          data: { email, password: value.password, name },
        });
        const { data, error: signInError } = await signIn.email({
          email,
          password: value.password,
          rememberMe: true,
        });

        if (signInError || !data) {
          setSuccessMessage('Account created. Sign in to start your first chef drop.');
          return;
        }

        void navigate({
          to: '/onboarding',
          replace: true,
        });
      } catch (registrationError) {
        const code = (registrationError as { code?: string })?.code;
        const message = registrationError instanceof Error ? registrationError.message : '';
        if (
          code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ||
          message.includes('already exists')
        ) {
          setError('An account with this email already exists. Try signing in instead.');
        } else if (message.includes('rate limit') || message.includes('Too many')) {
          setError('Too many registration attempts. Please wait a few minutes and try again.');
        } else {
          setError('Registration failed. Please try again.');
        }
      }
    },
  });

  if (isPending || isAuthenticated) return <AuthSkeleton />;

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
                <Flame className="size-3.5" /> Your first small occasion
              </p>
              <h1 className="font-editorial mt-4 text-5xl font-bold leading-[0.95] tracking-[-0.055em]">
                Make the meal feel like a place to be.
              </h1>
              <p className="mt-6 max-w-sm leading-7 text-background/70">
                Firesales gives your menu the useful kind of constraint: a real batch, a real guest
                list, and no hard-to-follow DMs.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-background/70">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" /> Your draft stays private
                until you open it.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" /> You choose the batch you
                can make beautifully.
              </li>
            </ul>
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
          <p className="text-kicker mt-8 text-xs font-bold text-primary md:mt-0">
            Create your studio
          </p>
          <h1 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.045em]">
            Start with a good idea.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account is the quiet place where you shape every future invitation.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            {error && (
              <div className="rounded border border-destructive bg-destructive/10 px-4 py-3 text-destructive">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="rounded border border-primary/20 bg-primary/10 px-4 py-3 text-primary">
                {successMessage}
              </div>
            )}

            <form.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel className="sr-only">Your name</FieldLabel>
                  <InputGroup>
                    <InputGroupIcon>
                      <User />
                    </InputGroupIcon>
                    <InputGroupInput
                      id={`${uid}-name`}
                      name={field.name}
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Your name"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </InputGroup>
                </Field>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <Field>
                  <FieldLabel className="sr-only">Email address</FieldLabel>
                  <InputGroup>
                    <InputGroupIcon>
                      <Mail />
                    </InputGroupIcon>
                    <InputGroupInput
                      id={`${uid}-email`}
                      name={field.name}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </InputGroup>
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
                      id={`${uid}-password`}
                      name={field.name}
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </InputGroup>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-11 w-full rounded-xl text-base shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? 'Preparing your studio…' : 'Create my studio'}
                </Button>
              )}
            </form.Subscribe>

            <p className="pt-1 text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                Already have a studio? Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
