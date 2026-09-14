import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  Clock3,
  Flame,
  LockKeyhole,
  type LucideIcon,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

const principles: Array<{ icon: LucideIcon; title: string; description: string; number: string }> =
  [
    {
      icon: Sparkles,
      number: '01',
      title: 'Make it a night, not a listing',
      description:
        'A focused drop lets you sell a specific feeling: this plate, this batch, this chance to be there.',
    },
    {
      icon: LockKeyhole,
      number: '02',
      title: 'Let the queue be honest',
      description:
        'Real inventory holds mean a viral post cannot promise more plates than your kitchen can make.',
    },
    {
      icon: UsersRound,
      number: '03',
      title: 'Turn “missed it” into momentum',
      description:
        'A sold-out page collects a meaningful signal for the next batch instead of a dead end.',
    },
  ];

export function MarketingHome() {
  return (
    <div className="space-y-20 pb-10 pt-3 sm:space-y-28 sm:pb-16 sm:pt-8">
      <section className="page-atmosphere relative isolate overflow-hidden rounded-[2rem] border border-primary/15 px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-[38%] size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-2xl">
            <p className="text-kicker inline-flex items-center gap-2 text-[0.68rem] font-bold text-primary">
              <Flame className="size-3.5" /> The invitation-first drop engine
            </p>
            <h1 className="font-editorial mt-5 max-w-xl text-5xl font-bold leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Make a meal people arrange their week around.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Firesales turns a menu into a small, irresistible occasion. Guests join a real guest
              list, pay up front, and you cook the exact batch you chose.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl px-6 text-base shadow-lg shadow-primary/20"
              >
                <Link to="/register">
                  Create your first drop <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-xl px-6">
                <Link to="/login">I already cook here</Link>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" /> No pre-cooking on a hunch. No trying to
              untangle DMs.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="ember-panel ticket-scallop relative overflow-hidden rounded-[1.75rem] border bg-foreground p-1 text-background">
              <div className="absolute inset-0 quiet-grid opacity-20" />
              <div className="relative rounded-[1.5rem] border border-background/10 bg-foreground p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-kicker text-[0.62rem] font-bold text-primary">
                      Tonight’s invitation
                    </p>
                    <p className="mt-3 text-sm text-background/65">A chef drop by you</p>
                  </div>
                  <span className="rounded-full border border-background/20 px-3 py-1 text-[0.64rem] font-bold text-primary text-kicker">
                    Limited batch
                  </span>
                </div>
                <h2 className="font-editorial mt-10 max-w-xs text-4xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
                  Your signature dish, before it becomes a memory.
                </h2>
                <div className="mt-10 grid grid-cols-3 gap-2 border-t border-background/15 pt-5 text-center">
                  <div>
                    <ChefHat className="mx-auto size-4 text-primary" />
                    <p className="mt-2 text-xs font-medium">One clear plate</p>
                  </div>
                  <div className="border-x border-background/15 px-2">
                    <UsersRound className="mx-auto size-4 text-primary" />
                    <p className="mt-2 text-xs font-medium">A real guest list</p>
                  </div>
                  <div>
                    <CalendarDays className="mx-auto size-4 text-primary" />
                    <p className="mt-2 text-xs font-medium">A moment to share</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-5 text-muted-foreground">
              Your voice makes the invitation. Firesales quietly makes the rush safe.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-kicker text-xs font-bold text-primary">Why it feels different</p>
          <h2 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
            People do not want more choices. They want a good reason to choose.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The best drops use a constraint as the story—not a trick. A fixed batch says: this is
            what the chef can make beautifully.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {principles.map(({ icon: Icon, number, title, description }) => (
            <Card
              key={number}
              className="group border-border/80 bg-card/80 py-0 transition-transform duration-300 hover:-translate-y-1"
            >
              <CardHeader className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-kicker text-[0.62rem] font-bold text-primary">
                    {number}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                </div>
                <CardTitle className="mt-5 text-xl">{title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <CardDescription className="leading-6">{description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="quiet-grid overflow-hidden rounded-[2rem] border bg-card/65 p-6 sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <p className="text-kicker text-xs font-bold text-primary">The calmer way to sell out</p>
            <h2 className="font-editorial mt-4 text-4xl font-bold leading-[1] tracking-[-0.045em]">
              Create a little theatre for the guest. Keep the logistics boring for yourself.
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-muted-foreground">
              A beautiful public page creates anticipation. Behind it, capacity, payment, and
              abandoned checkouts are handled with rules you can trust.
            </p>
            <Button asChild variant="outline" className="mt-7 rounded-xl">
              <Link to="/register">
                Start with a menu you already have <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>

          <ol className="space-y-3">
            {[
              [
                'Set the scene',
                'Choose one plate, the batch you want to cook, and clear pickup details.',
              ],
              [
                'Open the guest list',
                'Share one link when you are ready. Every paid plate is counted for you.',
              ],
              ['Cook to the list', 'Use the prep list to make exactly what guests committed to.'],
              ['Keep the glow', 'If it sells out, invite the interested guests to the next drop.'],
            ].map(([title, description], index) => (
              <li
                key={title}
                className="flex gap-4 rounded-2xl border border-border/80 bg-background/80 p-4 sm:p-5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        <div className="rounded-3xl border border-primary/20 bg-primary/10 p-6 sm:p-7">
          <Clock3 className="size-5 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Built for the “my post took off” moment.</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Short-lived inventory holds prevent the checkout scramble from turning into an oversold
            kitchen.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card/80 p-6 sm:p-7">
          <UsersRound className="size-5 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Your regulars become an audience.</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Each drop is a small promise kept—and the waitlist tells you what deserves an encore.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl rounded-[2rem] border border-primary/20 bg-primary px-6 py-10 text-center text-primary-foreground shadow-2xl shadow-primary/20 sm:px-10 sm:py-14">
        <p className="text-kicker text-xs font-bold text-primary-foreground/70">
          Your next menu is already a story
        </p>
        <h2 className="font-editorial mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
          Give people a reason to be early.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          Build the invitation, choose your batch, and let the guest list do the rest.
        </p>
        <Button
          asChild
          size="lg"
          variant="secondary"
          className="mt-7 rounded-xl bg-background px-6 text-foreground hover:bg-background/90"
        >
          <Link to="/register">
            Create a chef drop <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
