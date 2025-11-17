import Stripe from 'stripe';

let stripe: Stripe;

if (typeof window === 'undefined') {
  // Server-side initialization
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error('Missing Stripe Secret Key in environment variables');
  }

  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16', // Latest stable API version
    typescript: true,
  });
} else {
  // Client-side, we won't initialize Stripe directly for security
  // Instead, we'll use the Stripe.js script loaded in the HTML
  stripe = {} as Stripe; // Placeholder for client-side
}

export { stripe };

// Type definitions for our payment flow
export interface PaymentIntentParams {
  amount: number; // Amount in cents
  currency: string;
  productId: string;
  quantity: number;
  customerEmail?: string;
  metadata?: Record<string, string>; // Additional data to store with the payment
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  success: boolean;
  error?: string;
}
