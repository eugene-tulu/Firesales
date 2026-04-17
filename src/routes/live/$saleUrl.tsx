import { api } from '@convex/_generated/api';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useQuery, useMutation } from 'convex/react';
import { useState } from 'react';
import { useToast } from '~/components/ui/toast';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { ShoppingCart, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export const Route = createFileRoute('/live/$saleUrl')({
  component: PublicFlashSalePage,
});

function PublicFlashSalePage() {
  const { saleUrl } = Route.useParams();
  const router = useRouter();
  const toast = useToast();

  const flashSaleQuery = useQuery(api.flashSales.getBySaleUrl, { saleUrl });
  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);
  const reserveInventory = useMutation(api.inventory.reserve);

  const [quantity, setQuantity] = useState(1);
  const [isReserving, setIsReserving] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flashSale = flashSaleQuery;

  if (flashSale === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (flashSale === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Flash Sale Not Found
            </CardTitle>
            <CardDescription>
              This flash sale doesn't exist, has ended, or is no longer active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.navigate({ to: '/' })} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { product, remainingInventory, totalRevenue, totalSales, status, allocatedInventory } =
    flashSale;
  const isLive = status === 'live';
  const isSoldOut = remainingInventory <= 0;

  const maxQuantity = Math.min(10, remainingInventory);
  const totalPrice = (product.price / 100) * quantity;

  const handleReserveAndCheckout = async () => {
    if (quantity < 1) {
      setError('Please select at least 1 item');
      return;
    }

    if (quantity > remainingInventory) {
      setError(`Only ${remainingInventory} items available`);
      return;
    }

    setIsReserving(true);
    setError(null);

    try {
      // Generate a session ID for this user (anonymous or authenticated)
      const sessionId = sessionStorage.getItem('firesale_session_id') || crypto.randomUUID();
      sessionStorage.setItem('firesale_session_id', sessionId);

      // Reserve inventory first
      const reservationResult = await reserveInventory({
        productId: product._id,
        quantity,
        sessionId,
      });

      if (!reservationResult.success) {
        throw new Error(reservationResult.error || 'Failed to reserve inventory');
      }

      // Create checkout session
      const checkoutResult = await createCheckoutSession({
        productId: product._id,
        quantity,
        reservationId: reservationResult.reservationId!,
        sessionId,
      });

      // Redirect to Dodo Payments checkout
      window.location.href = checkoutResult.checkoutUrl;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      setIsReserving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Flash Sale Header */}
        <div className="text-center space-y-2">
          <Badge variant={isLive ? 'default' : 'secondary'} className="text-sm">
            {isLive ? '🔥 LIVE' : status.toUpperCase()}
          </Badge>
          <h1 className="text-4xl font-bold">{product.name}</h1>
          {isSoldOut ? (
            <p className="text-destructive font-semibold">SOLD OUT</p>
          ) : (
            <p className="text-2xl font-bold text-green-600">${(product.price / 100).toFixed(2)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Image */}
          <Card>
            <CardContent className="p-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-auto object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground">No image available</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Flash Sale Details</CardTitle>
              <CardDescription>
                Limited time offer - {remainingInventory} items remaining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {product.description && (
                <p className="text-sm text-muted-foreground">{product.description}</p>
              )}

              <Separator />

              {/* Inventory Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Allocated</div>
                  <div className="text-xl font-semibold">{allocatedInventory}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Sold</div>
                  <div className="text-xl font-semibold">{totalSales}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div
                    className={`text-xl font-semibold ${remainingInventory < 10 ? 'text-orange-600' : ''}`}
                  >
                    {remainingInventory}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Revenue</div>
                  <div className="text-xl font-semibold">${(totalRevenue / 100).toFixed(2)}</div>
                </div>
              </div>

              <Separator />

              {/* Quantity Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quantity</span>
                  <span className="text-sm text-muted-foreground">Max: {maxQuantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold" aria-live="polite">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                  >
                    +
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold">${totalPrice.toFixed(2)}</span>
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Purchase Button */}
              <Button
                onClick={handleReserveAndCheckout}
                disabled={
                  !isLive ||
                  isSoldOut ||
                  isReserving ||
                  isRedirecting ||
                  quantity > remainingInventory
                }
                className="w-full"
                size="lg"
              >
                {isReserving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reserving...
                  </>
                ) : isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to Payment...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {isSoldOut ? 'Sold Out' : `Buy Now - $${totalPrice.toFixed(2)}`}
                  </>
                )}
              </Button>

              {!isLive && (
                <p className="text-sm text-muted-foreground text-center">
                  This flash sale is not yet live. Check back later!
                </p>
              )}

              {isSoldOut && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  All items have been sold
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Details */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Price per unit</div>
              <div className="text-lg font-semibold">${(product.price / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Product URL</div>
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {product.url}
              </a>
            </div>
            {product.createdAt && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Listed</div>
                <div className="text-sm">{new Date(product.createdAt).toLocaleDateString()}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
