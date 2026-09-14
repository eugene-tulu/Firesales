import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowRight, Check, Flame, Sparkles, UtensilsCrossed } from 'lucide-react';
import { FiresalesMark } from '~/components/FiresalesMark';
import { Button } from '~/components/ui/button';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context }) => {
    if (typeof window !== 'undefined') return;
    if (!context.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: OnboardingPage,
});

const firstDropSteps = [
  {
    icon: UtensilsCrossed,
    title: 'Choose one plate worth talking about',
    description:
      'A focused offer is easier to share and easier for your kitchen to make beautifully.',
  },
  {
    icon: Flame,
    title: 'Set the batch you actually want to cook',
    description: 'Capacity is a promise to yourself, not a number you need to maximise.',
  },
  {
    icon: Sparkles,
    title: 'Open it when the story is ready',
    description: 'Your first draft stays private until you decide to send the invitation.',
  },
];

function OnboardingPage() {
  return (
    <div className="page-atmosphere -mx-4 -my-6 flex min-h-[calc(100vh-4.5rem)] items-center px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-primary/20 bg-card/90 shadow-2xl shadow-primary/10 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative overflow-hidden bg-foreground px-7 py-9 text-background sm:px-10 sm:py-12">
          <div className="quiet-grid absolute inset-0 opacity-20" />
          <div className="relative">
            <FiresalesMark subtitle="Your drop studio" />
            <p className="text-kicker mt-12 text-[0.65rem] font-bold text-primary">Welcome, chef</p>
            <h1 className="font-editorial mt-4 text-5xl font-bold leading-[0.95] tracking-[-0.055em]">
              You are not making a store. You are making a moment.
            </h1>
            <p className="mt-6 max-w-md leading-7 text-background/70">
              The aim of your first drop is not a perfect menu page. It is a very clear invitation
              you can be proud to share.
            </p>
            <div className="mt-10 border-t border-background/15 pt-5">
              <p className="flex gap-2 text-sm leading-6 text-background/75">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" /> Nothing becomes public
                until you explicitly open the drop.
              </p>
            </div>
          </div>
        </section>

        <section className="px-7 py-9 sm:px-10 sm:py-12">
          <p className="text-kicker text-xs font-bold text-primary">Your first small occasion</p>
          <h2 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.045em]">
            Three decisions. Then you have a private draft.
          </h2>
          <ol className="mt-8 space-y-5">
            {firstDropSteps.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-1 font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-9 space-y-3">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20"
            >
              <Link to="/dashboard/flash-sales/create">
                Begin a private draft <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-xl text-muted-foreground">
              <Link to="/app/seller/dashboard">I’ll look around first</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
