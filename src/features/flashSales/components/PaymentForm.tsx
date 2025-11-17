import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
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

interface PaymentFormProps {
  product: {
    _id: string;
    name: string;
    price: number;
  };
  quantity: number;
  reservationId: string;
  onConfirmPayment: (paymentIntentId: string) => Promise<void>;
  onCancel: () => void;
}

export function PaymentForm({
  product,
  quantity,
  reservationId,
  onConfirmPayment,
  onCancel,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = product.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      setError('Stripe.js has not loaded yet.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // In a real implementation, you would use the Payment Element and confirm the payment
      // For now, we'll simulate the process

      // In a real implementation, you would do something like:
      /*
      const cardElement = elements.getElement(CardElement);
      
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement!,
      });
      
      if (error) {
        setError(error.message || 'Payment method creation failed');
        return;
      }
      
      // Then confirm the payment with the backend
      */

      // Simulate a successful payment confirmation
      // In the real implementation, this would be the actual payment intent ID
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;

      await onConfirmPayment(mockPaymentIntentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>
            Complete your purchase for {product.name} ({quantity} unit{quantity > 1 ? 's' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(product.price * quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>Total</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="border p-4 rounded">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>

          {error && <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!stripe || isProcessing}>
            {isProcessing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
