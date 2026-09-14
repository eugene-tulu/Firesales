import { api } from '@convex/_generated/api';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { ArrowRight, ChefHat, CircleCheck, Flame, Sparkles, UsersRound } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { useAuthRole } from '~/features/auth/hooks/useAuthState';
import { formatMoney } from '~/lib/money';

export const Route = createFileRoute('/app/seller/dashboard')({
  component: SellerDashboard,
});

export function SellerDashboard() {
  const role = useAuthRole();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getCurrentUserProfile, isAuthenticated ? {} : 'skip');
  const drops = useQuery(api.flashSales.list, isAuthenticated ? {} : 'skip');

  if (role === 'platform_admin') {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-primary/20 bg-primary/10 p-8">
          <p className="text-kicker text-xs font-bold text-primary">Platform workspace</p>
          <h1 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.045em]">
            Admin detected
          </h1>
          <p className="mt-3 text-muted-foreground">Your platform workspace is ready.</p>
          <Button asChild className="mt-6 rounded-xl">
            <Link to="/app/admin">Go to admin</Link>
          </Button>
        </div>
      </div>
    );
  }

  const allDrops = drops ?? [];
  const totalRevenue = allDrops.reduce((sum, drop) => sum + drop.totalRevenue, 0);
  const paidPlates = allDrops.reduce((sum, drop) => sum + drop.totalSales, 0);
  const openDrops = allDrops.filter((drop) => drop.status === 'live');
  const waitlistLeads = allDrops.reduce((sum, drop) => sum + drop.waitlistCount, 0);
  const freeImportsLeft = Math.max(0, 3 - (profile?.freeScrapesUsed ?? 0));
  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-7 pb-4">
      <section className="page-atmosphere relative overflow-hidden rounded-[2rem] border border-primary/15 px-6 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-kicker flex items-center gap-2 text-xs font-bold text-primary">
              <ChefHat className="size-4" /> Chef drop studio
            </p>
            <h1 className="font-editorial mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
              {firstName ? `${firstName}'s next good idea` : 'Your next good idea'}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Turn attention into a clear prep list—then make the kind of batch guests talk about
              afterwards.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link to="/dashboard/flash-sales">See all drops</Link>
            </Button>
            <Button asChild className="h-11 rounded-xl px-5 shadow-lg shadow-primary/20">
              <Link to="/dashboard/flash-sales/create">
                Start a new invitation <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StudioMetric
          label="Collected"
          value={formatMoney(totalRevenue)}
          detail={`${paidPlates} paid plates`}
        />
        <StudioMetric
          label="Open invitations"
          value={String(openDrops.length)}
          detail="drops guests can claim"
          tone="ember"
        />
        <StudioMetric
          label="Encore signal"
          value={String(waitlistLeads)}
          detail="guests who want another"
        />
        <StudioMetric
          label="Research imports"
          value={String(freeImportsLeft)}
          detail="complimentary imports left"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
        <Card className="ember-panel overflow-hidden rounded-[1.65rem] border-primary/20 py-0">
          <CardHeader className="border-b border-border/80 bg-primary/7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription className="text-kicker text-[0.62rem] font-bold text-primary">
                  Right now
                </CardDescription>
                <CardTitle className="font-editorial mt-2 text-3xl font-bold tracking-[-0.04em]">
                  {openDrops.length > 0 ? 'The room is open.' : 'Nothing needs your attention.'}
                </CardTitle>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {openDrops.length > 0 ? (
                  <Flame className="size-5" />
                ) : (
                  <CircleCheck className="size-5" />
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            {openDrops.length > 0 ? (
              <div className="space-y-3">
                {openDrops.slice(0, 3).map((drop) => (
                  <Link
                    key={drop._id}
                    to="/dashboard/flash-sales/$saleId"
                    params={{ saleId: drop._id }}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/65 p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <span>
                      <span className="block font-semibold">
                        {drop.dropTitle || drop.product?.name || 'Untitled drop'}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {drop.totalSales} paid · {drop.remainingInventory} places left
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                  </Link>
                ))}
                {openDrops.length > 3 && (
                  <Button asChild variant="ghost" className="w-full rounded-xl text-primary">
                    <Link to="/dashboard/flash-sales">View all open drops</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <p className="leading-7 text-muted-foreground">
                  Your next drop can begin as a private draft. Start with the menu you are already
                  excited to make; you decide exactly when it becomes an invitation.
                </p>
                <Button asChild className="mt-6 rounded-xl">
                  <Link to="/dashboard/flash-sales/create">
                    Make a private draft <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.65rem] py-0">
          <CardHeader className="border-b border-border/80 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardDescription className="text-kicker text-[0.62rem] font-bold text-primary">
                  Your last few moments
                </CardDescription>
                <CardTitle className="mt-2 text-xl">Recent drops</CardTitle>
              </div>
              <Sparkles className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="py-3">
            {allDrops.length === 0 ? (
              <div className="py-8 text-center">
                <UsersRound className="mx-auto size-6 text-primary" />
                <p className="mt-3 font-semibold">Your first guest list starts here.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Pick one hero plate, set the batch, and create a link worth sharing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/80">
                {allDrops.slice(0, 5).map((drop) => {
                  const label =
                    drop.status === 'live'
                      ? 'Open'
                      : drop.status === 'completed'
                        ? 'Sold out'
                        : 'Draft';
                  return (
                    <Link
                      key={drop._id}
                      to="/dashboard/flash-sales/$saleId"
                      params={{ saleId: drop._id }}
                      className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {drop.dropTitle || drop.product?.name || 'Untitled drop'}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {drop.totalSales} paid · {drop.waitlistCount} next-drop leads
                        </span>
                      </span>
                      <Badge
                        variant={drop.status === 'live' ? 'default' : 'secondary'}
                        className="shrink-0 rounded-full px-2.5"
                      >
                        {label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/55 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Sparkles className="mt-1 size-4 shrink-0 text-primary" /> A useful constraint is part of
          the charm: capacity stays truthful, checkout is secure, and your kitchen stays in control.
        </p>
        <Link
          to="/dashboard/flash-sales/create"
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          Start the next one →
        </Link>
      </aside>
    </div>
  );
}

function StudioMetric({
  label,
  value,
  detail,
  tone = 'quiet',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'quiet' | 'ember';
}) {
  return (
    <Card className={tone === 'ember' ? 'border-primary/25 bg-primary/8 py-0' : 'py-0'}>
      <CardContent className="p-5">
        <p className="text-kicker text-[0.6rem] font-bold text-muted-foreground">{label}</p>
        <p className="font-editorial mt-2 text-3xl font-bold tracking-[-0.04em]">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
