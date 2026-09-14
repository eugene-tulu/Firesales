import { api } from '@convex/_generated/api';
import { Link } from '@tanstack/react-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { ArrowRight, Flame, Loader2, Plus } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

export function FlashSaleCreation() {
  const { isAuthenticated } = useConvexAuth();
  const drops = useQuery(api.flashSales.list, isAuthenticated ? {} : 'skip');

  if (drops === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-3 sm:py-8">
      <header className="page-atmosphere mb-7 flex flex-wrap items-end justify-between gap-5 rounded-[1.8rem] border border-primary/15 px-6 py-7 sm:mb-8 sm:px-8 sm:py-8">
        <div>
          <p className="text-kicker mb-3 flex items-center gap-2 text-xs font-bold text-primary">
            <Flame className="h-4 w-4" /> Your invitation library
          </p>
          <h1 className="font-editorial text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
            Your drops
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
            Every one is a small promise: a particular plate, a real capacity, and a reason to show
            up.
          </p>
        </div>
        <Button asChild size="lg" className="h-11 rounded-xl shadow-lg shadow-primary/20">
          <Link to="/dashboard/flash-sales/create">
            <Plus className="mr-2 h-4 w-4" />
            Start a new drop
          </Link>
        </Button>
      </header>

      {drops.length === 0 ? (
        <Card className="rounded-[1.7rem] border-dashed py-10 text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Flame className="size-5" />
            </div>
            <CardTitle className="font-editorial mt-4 text-3xl font-bold tracking-[-0.04em]">
              Your first drop starts with one great plate
            </CardTitle>
            <CardDescription>
              Give guests a clear plate, a considered batch, and a reason to join before prep
              begins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-xl">
              <Link to="/dashboard/flash-sales/create">
                Create your first drop <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drops.map((drop) => {
            const status =
              drop.status === 'live' ? 'OPEN' : drop.status === 'completed' ? 'SOLD OUT' : 'DRAFT';
            return (
              <Card
                key={drop._id}
                className="group flex flex-col overflow-hidden rounded-[1.45rem] py-0 transition-transform duration-300 hover:-translate-y-1"
              >
                {drop.product?.imageUrl && (
                  <img src={drop.product.imageUrl} alt="" className="h-40 w-full object-cover" />
                )}
                <CardHeader className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="line-clamp-2">
                        {drop.dropTitle || drop.product?.name || 'Untitled drop'}
                      </CardTitle>
                      <CardDescription className="mt-1">{drop.product?.name}</CardDescription>
                    </div>
                    <Badge
                      variant={drop.status === 'live' ? 'default' : 'secondary'}
                      className="rounded-full px-2.5 text-kicker text-[0.6rem]"
                    >
                      {status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-lg font-bold">{drop.remainingInventory}</p>
                      <p className="text-xs text-muted-foreground">left</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{drop.totalSales}</p>
                      <p className="text-xs text-muted-foreground">paid</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{drop.waitlistCount}</p>
                      <p className="text-xs text-muted-foreground">waiting</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="w-full rounded-xl">
                    <Link to="/dashboard/flash-sales/$saleId" params={{ saleId: drop._id }}>
                      Manage drop <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
