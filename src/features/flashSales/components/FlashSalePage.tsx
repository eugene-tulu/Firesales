import { useParams } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../auth/hooks/useAuth';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);

  const { isAuthenticated, user } = useAuth();

  // Get flash sale by sale URL
  const flashSale = useQuery(api.flashSales.getBySaleUrl, { saleUrl: saleId });
  const product = flashSale?.product;

  // Mutations
  const [createPaymentIntent, createPaymentIntentStatus] = useMutation(
    api.payments.createPaymentIntent,
  );
  const [confirmPaymentAndCreateOrder, confirmPaymentStatus] = useMutation(
    api.payments.confirmPaymentAndCreateOrder,
  );

  // Handle quantity change
  const handleQuantityChange = (change: number) => {
    if (flashSale) {
      const newQuantity = quantity + change;
      // Ensure quantity doesn't exceed remaining inventory
      if (newQuantity >= 1 && newQuantity <= flashSale.remainingInventory) {
        setQuantity(newQuantity);
      }
    }
  };

  // Handle purchase
  const handlePurchase = async () => {
    if (!flashSale || !product) return;

    setIsProcessing(true);

    try {
      // Create a payment intent with inventory reservation
      const result = await createPaymentIntent({
        productId: product._id,
        quantity,
        amount: Math.round(product.price * quantity * 100), // Convert to cents
        currency: 'usd',
        sessionId: isAuthenticated ? user?.id || 'anonymous' : `session_${Date.now()}`,
        customerEmail: isAuthenticated ? user?.email : undefined,
      });

      if (result.success && result.reservationId) {
        setReservationId(result.reservationId);
      } else {
        throw new Error(result.error || 'Failed to create payment intent');
      }
    } catch (error) {
      console.error('Error initiating purchase:', error);
      alert(error instanceof Error ? error.message : 'An error occurred during purchase');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle payment confirmation
  const handleConfirmPayment = async (paymentIntentId: string) => {
    if (!reservationId || !flashSale) return;

    try {
      const result = await confirmPaymentAndCreateOrder({
        paymentIntentId,
        reservationId,
        sessionId: isAuthenticated ? user?.id || 'anonymous' : `session_${Date.now()}`,
      });

      if (result.success) {
        alert('Purchase completed successfully!');
        // Reset the state to show product again
        setReservationId(null);
        setQuantity(1);
      } else {
        throw new Error(result.error || 'Payment confirmation failed');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(error instanceof Error ? error.message : 'An error occurred confirming payment');
    }
  };

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
                      ${(product?.price * 1.5).toFixed(2)} {/* Original price example */}
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
                      onClick={handlePurchase}
                      disabled={
                        isProcessing ||
                        flashSale.remainingInventory === 0 ||
                        flashSale.status !== 'live'
                      }
                      className="w-full"
                      size="lg"
                    >
                      {isProcessing
                        ? 'Processing...'
                        : flashSale.remainingInventory === 0
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

  // Render payment form after reservation (this would be handled by a payment form component)
  if (reservationId && flashSale && product) {
    // For now, we'll show a placeholder - in a real implementation this would be a Stripe payment form
    return (
      <div className="container mx-auto py-10">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Purchase</CardTitle>
              <CardDescription>
                Flash sale for {product.name} - {quantity} unit(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${(product.price * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Total</span>
                    <span>${(product.price * quantity).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center py-8">
                  <p className="mb-4">Your items have been reserved. Please complete payment.</p>
                  <Button
                    onClick={() => {
                      // In a real implementation, this would trigger the Stripe payment flow
                      // For now, we'll just simulate a successful payment
                      handleConfirmPayment(`mock_payment_intent_${Date.now()}`);
                    }}
                    disabled={confirmPaymentStatus.isPending}
                  >
                    {confirmPaymentStatus.isPending ? 'Processing...' : 'Complete Payment'}
                  </Button>
                </div>

                <div className="text-center">
                  <Button variant="outline" onClick={() => setReservationId(null)}>
                    Cancel Order
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
