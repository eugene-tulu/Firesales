import { api } from '@convex/_generated/api';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Flame,
  Heart,
  Loader2,
  LockKeyhole,
  type LucideIcon,
  MapPin,
  Minus,
  Plus,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { FiresalesMark } from '~/components/FiresalesMark';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { formatMoney } from '~/lib/money';

export const Route = createFileRoute('/live/$saleUrl')({
  loader: async ({ context, params }) => {
    const saleUrl = params.saleUrl as string;
    const result = await context.convexQueryClient.convexClient.query(api.flashSales.getBySaleUrl, {
      saleUrl,
    });
    if (!result) throw new Error('Drop not found');
    return { saleUrl, dropTitle: result.dropTitle || result.product?.name || 'Chef drop' };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.dropTitle
      ? `${loaderData.dropTitle} — Firesales`
      : 'Chef drop — Firesales';
    return {
      meta: [
        { title },
        {
          name: 'description',
          content: 'A limited chef drop. Claim your plate before the batch is gone.',
        },
        { property: 'og:title', content: title },
        {
          property: 'og:description',
          content: 'A limited chef drop. Claim your plate before the batch is gone.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Firesales' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    };
  },
  component: PublicDropPage,
});

function getCheckoutSessionId() {
  const key = 'firesales_drop_session_id';
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function PublicDropPage() {
  const { saleUrl } = Route.useParams();
  const router = useRouter();
  const flashSale = useQuery(api.flashSales.getBySaleUrl, { saleUrl });
  const reserveInventory = useAction(api.inventory.reserve);
  const createCheckoutSession = useAction(api.payments.createCheckoutSession);
  const joinWaitlist = useMutation(api.flashSales.joinWaitlist);

  const [quantity, setQuantity] = useState(1);
  const [isReserving, setIsReserving] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');

  if (flashSale === undefined) {
    return (
      <div className="page-atmosphere flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (flashSale === null || !flashSale.product) {
    return (
      <div className="page-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md ember-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" /> This invitation is unavailable
            </CardTitle>
            <CardDescription>It may have ended, moved, or never gone live.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.navigate({ to: '/' })} className="w-full rounded-xl">
              Return home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { product } = flashSale;
  const isLive = flashSale.status === 'live';
  const isSoldOut = flashSale.remainingInventory <= 0 || flashSale.status === 'completed';
  const canBuy = isLive && !isSoldOut;
  const maxQuantity = Math.max(1, Math.min(4, flashSale.remainingInventory));
  const currency = product.currency || 'KES';
  const totalPrice = product.price * quantity;
  const reserved = flashSale.reservedInventory ?? 0;
  const committed = flashSale.allocatedInventory - flashSale.remainingInventory;
  const commitmentPercent = Math.min(
    100,
    Math.round((committed / flashSale.allocatedInventory) * 100),
  );
  const checkoutJustCompleted =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('checkout') === 'complete';

  const handleReserveAndCheckout = async () => {
    if (!canBuy) return;
    if (!/^\S+@\S+\.\S+$/.test(customerEmail.trim())) {
      setCheckoutError('Add a valid email so we can send your receipt and collection details.');
      return;
    }
    setIsReserving(true);
    setCheckoutError(null);

    try {
      const sessionId = getCheckoutSessionId();
      const hold = await reserveInventory({
        flashSaleId: flashSale._id,
        quantity,
        sessionId,
      });
      const checkout = await createCheckoutSession({
        flashSaleId: flashSale._id,
        reservationId: hold.reservationId,
        sessionId,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || undefined,
        dietaryNotes: dietaryNotes.trim() || undefined,
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Unable to start secure checkout. Please try again.',
      );
      setIsReserving(false);
    }
  };

  const handleWaitlist = async (event: FormEvent) => {
    event.preventDefault();
    setIsJoiningWaitlist(true);
    setWaitlistMessage(null);
    try {
      const result = await joinWaitlist({
        saleUrl,
        email: waitlistEmail,
        name: waitlistName || undefined,
      });
      setWaitlistMessage(
        result.alreadyJoined
          ? 'You are already on the list for the next drop.'
          : 'You are on the list. The chef now knows you want the next one.',
      );
    } catch (error) {
      setWaitlistMessage(error instanceof Error ? error.message : 'Could not join the waitlist.');
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const statusCopy = isSoldOut
    ? 'This batch is full'
    : isLive
      ? 'The guest list is open'
      : 'A chef drop is taking shape';

  return (
    <main className="page-atmosphere min-h-screen px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between gap-4 sm:mb-14">
          <Link to="/" className="rounded-lg focus:outline-none focus:ring-2 focus:ring-ring">
            <FiresalesMark subtitle="Guest invitation" />
          </Link>
          <p className="hidden text-right text-xs leading-5 text-muted-foreground sm:block">
            A limited chef drop
            <br />
            with a real guest list
          </p>
        </header>

        <header className="mx-auto max-w-3xl text-center">
          <Badge
            variant={isLive && !isSoldOut ? 'default' : 'secondary'}
            className="rounded-full px-3 py-1 text-[0.68rem] font-bold text-kicker"
          >
            {isLive && !isSoldOut ? (
              <Flame className="size-3.5" />
            ) : (
              <UtensilsCrossed className="size-3.5" />
            )}
            {statusCopy}
          </Badge>
          <h1 className="font-editorial mt-5 text-5xl font-bold leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {flashSale.dropTitle || product.name}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {flashSale.chefNote ||
              product.description ||
              'A limited batch, prepared only for the people who claim a plate.'}
          </p>
        </header>

        {checkoutJustCompleted && (
          <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              Your payment is being confirmed. Keep this page open for a moment while the chef’s
              guest list updates.
            </p>
          </div>
        )}

        <div className="mt-9 grid gap-6 lg:mt-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <section className="overflow-hidden rounded-[1.8rem] border border-border/80 bg-card/70 shadow-2xl shadow-primary/5">
            <div className="relative min-h-[19rem] overflow-hidden sm:min-h-[28rem]">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="quiet-grid absolute inset-0 flex items-center justify-center bg-muted text-primary">
                  <UtensilsCrossed className="size-16" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 pt-24 text-white sm:p-7">
                <p className="text-kicker text-[0.62rem] font-bold text-primary">The plate</p>
                <p className="font-editorial mt-2 text-3xl font-bold tracking-[-0.035em]">
                  {product.name}
                </p>
                <p className="mt-2 max-w-lg text-sm leading-6 text-white/75">
                  One claim now means one dish on the chef’s prep list.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border-t bg-card/90 text-center">
              <div className="p-4">
                <p className="text-2xl font-bold">{Math.max(0, flashSale.remainingInventory)}</p>
                <p className="mt-1 text-[0.65rem] font-semibold text-muted-foreground text-kicker">
                  Places left
                </p>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold">{flashSale.totalSales}</p>
                <p className="mt-1 text-[0.65rem] font-semibold text-muted-foreground text-kicker">
                  Paid plates
                </p>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold">{flashSale.allocatedInventory}</p>
                <p className="mt-1 text-[0.65rem] font-semibold text-muted-foreground text-kicker">
                  This batch
                </p>
              </div>
            </div>
          </section>

          <Card className="ember-panel overflow-hidden rounded-[1.8rem] border-primary/25 bg-card/95 py-0">
            <CardHeader className="border-b border-border/80 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardDescription className="text-kicker text-[0.62rem] font-bold text-primary">
                    Your place at the table
                  </CardDescription>
                  <CardTitle className="font-editorial mt-2 text-4xl font-bold tracking-[-0.045em]">
                    {formatMoney(product.price, currency)}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">per plate</p>
                </div>
                <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
                  <p className="text-kicker text-[0.58rem] font-bold text-primary">Availability</p>
                  <p className="mt-1 text-2xl font-bold">
                    {Math.max(0, flashSale.remainingInventory)}
                  </p>
                  <p className="text-xs text-muted-foreground">places left</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {committed} of {flashSale.allocatedInventory} places committed
                  </span>
                  <span>{commitmentPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${commitmentPercent}%` }}
                  />
                </div>
                {reserved > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {reserved} {reserved === 1 ? 'plate is' : 'plates are'} currently being checked
                    out.
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-5 py-6">
              {flashSale.pickupDetails && (
                <div className="flex gap-3 rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">Collection details</p>
                    <p className="mt-1 leading-5 text-muted-foreground">
                      {flashSale.pickupDetails}
                    </p>
                  </div>
                </div>
              )}

              {canBuy && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="plate-count" className="font-semibold">
                        How many places?
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Up to {maxQuantity} per guest
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 p-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                        disabled={quantity <= 1 || isReserving}
                        aria-label="Remove a plate"
                      >
                        <Minus className="size-4" />
                      </Button>
                      <output
                        id="plate-count"
                        className="w-10 text-center text-lg font-bold"
                        aria-live="polite"
                      >
                        {quantity}
                      </output>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                        disabled={quantity >= maxQuantity || isReserving}
                        aria-label="Add a plate"
                      >
                        <Plus className="size-4" />
                      </Button>
                      <span className="ml-auto pr-2 text-right text-sm">
                        <span className="block text-xs text-muted-foreground">Your total</span>
                        <strong>{formatMoney(totalPrice, currency)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-border/80 pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="guest-email">Where should we send your receipt?</Label>
                      <Input
                        id="guest-email"
                        type="email"
                        autoComplete="email"
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="guest-name">
                          Name for pickup <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="guest-name"
                          autoComplete="name"
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          placeholder="Your name"
                          maxLength={120}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dietary-notes">
                          Dietary note <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                          id="dietary-notes"
                          value={dietaryNotes}
                          onChange={(event) => setDietaryNotes(event.target.value)}
                          placeholder="Allergies or a note for the chef"
                          maxLength={300}
                          rows={1}
                          className="min-h-11 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {checkoutError && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {checkoutError}
                </p>
              )}

              {canBuy ? (
                <>
                  <Button
                    className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20"
                    size="lg"
                    onClick={handleReserveAndCheckout}
                    disabled={isReserving}
                  >
                    {isReserving ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Holding your place…
                      </>
                    ) : (
                      `Join this drop — ${formatMoney(totalPrice, currency)}`
                    )}
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-muted-foreground">
                    <LockKeyhole className="size-3.5" /> Your plates are held for 15 minutes while
                    you complete secure Paystack checkout.
                  </p>
                </>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-muted/45 p-4 text-center">
                  <p className="font-semibold">
                    {isSoldOut
                      ? 'This batch has been fully claimed.'
                      : 'The guest list is not open yet.'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isSoldOut
                      ? 'The chef has a clear prep list—add your name for the next invitation.'
                      : 'Check back when the chef opens this drop.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <ValuePoint
            icon={CheckCircle2}
            title="A real place"
            description="Paid plates go directly onto the chef’s prep list."
          />
          <ValuePoint
            icon={Clock3}
            title="A calmer rush"
            description="Inventory holds prevent a checkout crowd from overselling the batch."
          />
          <ValuePoint
            icon={Heart}
            title="An encore, not spam"
            description="If you miss it, the next-drop list keeps the signal useful."
          />
        </section>

        {isSoldOut && flashSale.waitlistOpen && (
          <section className="mx-auto mt-10 max-w-2xl rounded-[1.75rem] border border-primary/20 bg-card/85 p-6 text-center shadow-xl shadow-primary/5 sm:p-8">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </span>
            <h2 className="font-editorial mt-4 text-3xl font-bold tracking-[-0.04em]">
              Join the encore list
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              You missed this batch, not the chef. Raise your hand for the next one—no fake timer,
              just a useful signal.
            </p>
            <form
              onSubmit={handleWaitlist}
              className="mt-5 grid gap-3 sm:grid-cols-[0.9fr_1.25fr_auto]"
            >
              <Input
                value={waitlistName}
                onChange={(event) => setWaitlistName(event.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                className="h-11 rounded-xl"
              />
              <Input
                type="email"
                required
                value={waitlistEmail}
                onChange={(event) => setWaitlistEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="h-11 rounded-xl"
              />
              <Button type="submit" disabled={isJoiningWaitlist} className="h-11 rounded-xl">
                {isJoiningWaitlist ? 'Joining…' : 'I’m in'}
              </Button>
            </form>
            {waitlistMessage && (
              <p className="mt-4 rounded-xl bg-primary/10 p-3 text-sm text-primary">
                {waitlistMessage}
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function ValuePoint({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/65 p-4 text-center">
      <Icon className="mx-auto size-4 text-primary" />
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
