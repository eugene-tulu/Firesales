import { useMutation } from 'convex/react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { api } from '~/convex/_generated/api';

interface PaymentFormProps {
  product: {
    _id: string;
    name: string;
    price: number;
  };
  quantity: number;
  reservationId: string;
  sessionId: string;
  onSuccess?: (orderId: string) => void;
  onCancel: () => void;
}

export function PaymentForm({
  product,
  quantity,
  reservationId,
  sessionId,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = product.price * quantity;

  // Mutation to create Dodo checkout session
  const createCheckoutSession = useMutation(api.payments.createCheckoutSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsProcessing(true);
    setError(null);

    try {
      // Create checkout session with Dodo Payments
      const result = await createCheckoutSession({
        productId: product._id,
        quantity: quantity,
        reservationId: reservationId,
        sessionId: sessionId,
        // Customer info would be populated from auth session if available
        customerEmail: undefined,
        customerName: undefined,
      });

      if (!result.checkoutUrl) {
        throw new Error('Failed to create checkout session');
      }

      // Redirect to Dodo Payments checkout
      // Dodo will handle the payment and redirect back to the return URL
      window.location.href = result.checkoutUrl;
    } catch (err) {
      console.error('Checkout error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to initiate checkout. Please try again.',
      );
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Complete Your Purchase</CardTitle>
          <CardDescription>
            You're purchasing {quantity} × {product.name} for ${totalAmount.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <div className="flex justify-between">
              <span>
                Subtotal ({quantity} item{quantity > 1 ? 's' : ''})
              </span>
              <span>${(product.price * quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>Total</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <p>• You'll be redirected to Dodo Payments to complete your secure payment</p>
            <p>• Your inventory is reserved for 15 minutes</p>
            <p>• After payment, you'll be redirected back to your dashboard</p>
          </div>

          {error && (
            <div className="text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="submit" disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to Checkout...
              </>
            ) : (
              <>
                Pay ${totalAmount.toFixed(2)}
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
