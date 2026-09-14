import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { createFileRoute } from '@tanstack/react-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Check, ChefHat, Copy, ExternalLink, Flame, Loader2, MapPin, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { formatMoney } from '~/lib/money';

export const Route = createFileRoute('/dashboard/flash-sales/$saleId')({
  component: DropDetail,
});

function DropDetail() {
  const { saleId } = Route.useParams();
  const flashSaleId = saleId as Id<'flashSales'>;
  const { isAuthenticated } = useConvexAuth();
  const queryArgs = isAuthenticated ? { flashSaleId } : 'skip';
  const sale = useQuery(api.flashSales.get, queryArgs);
  const orders = useQuery(api.orders.listByFlashSale, queryArgs);
  const waitlist = useQuery(api.flashSales.getWaitlist, queryArgs);
  const goLive = useMutation(api.flashSales.goLive);
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  if (sale === undefined || orders === undefined || waitlist === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }
  if (sale === null || !sale.product) return <div className="p-8">This drop is unavailable.</div>;

  const publicPath = `/live/${sale.saleUrl}`;
  const publicUrl =
    typeof window === 'undefined' ? publicPath : `${window.location.origin}${publicPath}`;
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const platesToPrepare = paidOrders.reduce((total, order) => total + order.quantity, 0);
  const statusLabel =
    sale.status === 'live' ? 'OPEN NOW' : sale.status === 'completed' ? 'SOLD OUT' : 'DRAFT';
  const statusVariant =
    sale.status === 'live' ? 'default' : sale.status === 'completed' ? 'secondary' : 'outline';

  const publish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    try {
      await goLive({ flashSaleId: sale._id });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not open this drop.');
    } finally {
      setIsPublishing(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-3 sm:py-8">
      <header className="page-atmosphere flex flex-wrap items-start justify-between gap-5 rounded-[1.8rem] border border-primary/15 px-6 py-7 sm:px-8 sm:py-8">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant={statusVariant}
              className="rounded-full px-2.5 font-bold text-kicker text-[0.62rem]"
            >
              {statusLabel}
            </Badge>
            {sale.status === 'live' && (
              <span className="flex items-center gap-1 text-sm text-primary">
                <Flame className="h-4 w-4" /> Guests can claim plates now
              </span>
            )}
          </div>
          <p className="text-kicker flex items-center gap-2 text-[0.65rem] font-bold text-primary">
            <ChefHat className="size-3.5" /> Your chef invitation
          </p>
          <h1 className="font-editorial mt-3 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
            {sale.dropTitle || sale.product.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {sale.product.name} · {formatMoney(sale.product.price, sale.product.currency)} per plate
          </p>
          {sale.status === 'draft' && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" /> Still private. Review it at your own pace
              before opening the guest list.
            </p>
          )}
        </div>
        {sale.status === 'draft' && (
          <Button
            size="lg"
            className="h-11 rounded-xl shadow-lg shadow-primary/20"
            onClick={publish}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <Flame className="mr-2 h-4 w-4" />
                Open the guest list
              </>
            )}
          </Button>
        )}
      </header>

      {publishError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {publishError}
        </p>
      )}

      <Card className="rounded-[1.55rem] py-0">
        <CardHeader>
          <p className="text-kicker text-[0.62rem] font-bold text-primary">The shareable part</p>
          <CardTitle className="font-editorial mt-2 text-3xl font-bold tracking-[-0.04em]">
            Share the invitation
          </CardTitle>
          <CardDescription>
            Send this to Instagram, WhatsApp, TikTok, or your regulars once the guest list is open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={publicUrl} readOnly className="flex-1" aria-label="Public drop link" />
            <Button onClick={copyLink} variant="outline" className="rounded-xl">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Open public drop page"
            >
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Plates left"
          value={sale.remainingInventory}
          detail={`of ${sale.allocatedInventory} total`}
        />
        <Metric
          label="Paid plates"
          value={sale.totalSales}
          detail={`${formatMoney(sale.totalRevenue, sale.product.currency)} collected`}
        />
        <Metric
          label="Being checked out"
          value={sale.reservedInventory ?? 0}
          detail="15-minute holds"
        />
        <Metric
          label="Next-drop list"
          value={waitlist.length}
          detail="guests who missed this one"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Card className="rounded-[1.55rem] py-0">
          <CardHeader>
            <p className="text-kicker text-[0.62rem] font-bold text-primary">What guests see</p>
            <CardTitle className="mt-2 text-xl">Drop details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sale.product.imageUrl && (
              <img
                src={sale.product.imageUrl}
                alt={sale.product.name}
                className="h-56 w-full rounded-2xl object-cover"
              />
            )}
            {sale.chefNote && <p>{sale.chefNote}</p>}
            {sale.product.description && (
              <p className="text-sm text-muted-foreground">{sale.product.description}</p>
            )}
            {sale.pickupDetails && (
              <div className="flex gap-2 rounded-2xl bg-muted p-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{sale.pickupDetails}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.55rem] py-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Prep list
            </CardTitle>
            <CardDescription>
              {platesToPrepare} paid {platesToPrepare === 1 ? 'plate' : 'plates'} to prepare for
              this drop.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paidOrders.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                Paid guests will appear here as checkout confirmations arrive.
              </p>
            ) : (
              <div className="space-y-3">
                {paidOrders.map((order) => (
                  <div
                    key={order._id}
                    className="flex items-start justify-between gap-4 rounded-2xl border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {order.guestName || order.guestEmail || 'Guest'}
                      </p>
                      {order.guestEmail && (
                        <p className="text-xs text-muted-foreground">{order.guestEmail}</p>
                      )}
                      {order.dietaryNotes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Dietary note: {order.dietaryNotes}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {order.quantity} {order.quantity === 1 ? 'plate' : 'plates'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="rounded-2xl py-0">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
