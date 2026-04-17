import { useParams } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../auth/hooks/useAuth';
import { PaymentForm } from './PaymentForm';

interface Product {
  _id: Id<'products'>;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  url: string;
  status: 'draft' | 'active' | 'paused' | 'sold_out' | 'ended';
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

interface FlashSale {
  _id: Id<'flashSales'>;
  productId: Id<'products'>;
  allocatedInventory: number;
  saleUrl: string;
  status: 'draft' | 'live' | 'completed';
  userId: string;
  totalSales: number;
  totalRevenue: number;
  remainingInventory: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  endedAt?: number;
  product: Product;
}

export function FlashSalePage({ saleId }: { saleId: string }) {
  const [quantity, setQuantity] = useState(1);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const { isAuthenticated, user } = useAuth();

  // Get flash sale by sale URL
  const flashSale = useQuery(api.flashSales.getBySaleUrl, { saleUrl: saleId });
  const product = flashSale?.product;

  // Mutations
  const reserveInventory = useMutation(api.inventory.reserve);
  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);

  // Generate a session ID for anonymous users
  const sessionId =
    isAuthenticated && user?.id
      ? user.id
      : `session_${typeof window !== 'undefined' ? sessionStorage.getItem('sessionId') : ''}_${Date.now()}`;

  // Handle quantity change
  const handleQuantityChange = (change: number) => {
    if (flashSale) {
      const newQuantity = quantity + change;
      if (newQuantity >= 1 && newQuantity <= flashSale.remainingInventory) {
        setQuantity(newQuantity);
      }
    }
  };

  // Reserve inventory and proceed to checkout
  const handleReserveAndCheckout = async () => {
    if (!flashSale || !product) return;

    try {
      // Reserve inventory atomically via Cloudflare
      const reservationResult = await reserveInventory({
        productId: product._id,
        quantity: quantity,
        sessionId: sessionId,
      });

      if (!reservationResult.reservationId) {
        throw new Error('Failed to reserve inventory. It may have just been sold out.');
      }

      setReservationId(reservationResult.reservationId);
    } catch (error) {
      console.error('Error reserving inventory:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to reserve inventory. Please try again.',
      );
    }
  };

  // Handle successful checkout return (user returns from Dodo)
  useEffect(() => {
    if (!checkoutUrl) return;

    // Check if we returned from Dodo with a success indicator
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const cartId = urlParams.get('cart_id');

    if (success === 'true' && cartId) {
      // Payment was successful - order created via webhook
      // Show success message or redirect to orders
      alert('Payment completed successfully! Your order is being processed.');
      // Could redirect to order confirmation page
      // navigate({ to: '/orders' });
    }
  }, [checkoutUrl]);

  // Render purchase flow
  if (flashSale && !reservationId) {
    return (
      <div className="container mx-auto py-10">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{product?.name}</CardTitle>
              <CardDescription>Flash Sale - Limited Time Offer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {product?.imageUrl && (
                  <div>
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-64 object-contain rounded-lg"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">${product?.price.toFixed(2)}</h2>
                    <p className="text-gray-500 line-through">
                      ${(product?.price * 1.5).toFixed(2)}
                    </p>
                  </div>

                  <p className="text-gray-700">{product?.description}</p>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                      >
                        -
                      </Button>
                      <span className="mx-2 w-8 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(1)}
                        disabled={flashSale.remainingInventory <= quantity}
                      >
                        +
                      </Button>
                    </div>

                    <div className="text-sm text-gray-500">{flashSale.remainingInventory} left</div>
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={handleReserveAndCheckout}
                      disabled={flashSale.remainingInventory === 0 || flashSale.status !== 'live'}
                      className="w-full"
                      size="lg"
                    >
                      {flashSale.remainingInventory === 0
                        ? 'Sold Out'
                        : flashSale.status !== 'live'
                          ? 'Sale Not Active'
                          : `Buy Now - $${(product?.price * quantity).toFixed(2)}`}
                    </Button>
                  </div>
                </div>
              </div>

              {flashSale.status !== 'live' && (
                <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded">
                  This flash sale is not currently active
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render payment form after reservation
  if (reservationId && flashSale && product) {
    return (
      <div className="container mx-auto py-10">
        <div className="max-w-2xl mx-auto">
          <PaymentForm
            product={product}
            quantity={quantity}
            reservationId={reservationId}
            sessionId={sessionId}
            onCancel={() => setReservationId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            {flashSale ? (
              <p>Flash sale is not active or product not found</p>
            ) : (
              <p>Loading flash sale...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
