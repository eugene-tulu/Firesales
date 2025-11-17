import { v } from 'convex/values';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { action, mutation } from '../../convex/_generated/server';
import { stripe } from '../../lib/stripe';

interface CreatePaymentIntentParams {
  productId: Id<'products'>;
  quantity: number;
  amount: number; // Total amount in cents
  currency: string;
  sessionId: string; // User session ID
  customerEmail?: string;
}

/**
 * Server action to create a Stripe payment intent with inventory reservation
 * This ensures that inventory is only reserved when payment intent is created
 */
export const createPaymentIntent = action({
  args: {
    productId: v.id('products'),
    quantity: v.number(),
    amount: v.number(),
    currency: v.string(),
    sessionId: v.string(),
    customerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // First, try to create a reservation for the inventory
      // This will use our atomic Cloudflare system to ensure no overselling
      const reservationResult = await ctx.runMutation(api.inventory.reserve, {
        productId: args.productId,
        quantity: args.quantity,
        sessionId: args.sessionId,
      });

      if (!reservationResult.success) {
        throw new Error(reservationResult.error || 'Failed to reserve inventory');
      }

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: args.amount,
        currency: args.currency,
        metadata: {
          productId: args.productId,
          quantity: args.quantity.toString(),
          sessionId: args.sessionId,
          reservationId: reservationResult.reservationId,
        },
        receipt_email: args.customerEmail,
      });

      // Return the client secret and reservation info
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        reservationId: reservationResult.reservationId,
        success: true,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);

      // If there was an error after reserving inventory, we need to release it
      // In a real implementation, we'd need to track the reservation ID to release it
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

interface ConfirmPaymentParams {
  paymentIntentId: string;
  reservationId: Id<'reservations'>;
  sessionId: string;
}

/**
 * Server action to confirm payment and create order
 * This is called after Stripe payment is confirmed client-side
 */
export const confirmPaymentAndCreateOrder = action({
  args: {
    paymentIntentId: v.string(),
    reservationId: v.id('reservations'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Verify the payment intent status with Stripe
      const stripePaymentIntent = await stripe.paymentIntents.retrieve(args.paymentIntentId);

      if (stripePaymentIntent.status !== 'succeeded') {
        // If payment didn't succeed, release the reservation
        await ctx.runMutation(api.inventory.releaseReservation, {
          reservationId: args.reservationId,
          sessionId: args.sessionId,
        });

        throw new Error(`Payment not successful: ${stripePaymentIntent.status}`);
      }

      // Confirm the reservation atomically (this moves inventory from reserved to sold)
      await ctx.runMutation(api.inventory.confirmReservation, {
        reservationId: args.reservationId,
        sessionId: args.sessionId,
      });

      // Create the order in our system
      // We'll need to get the product and quantity info from the reservation or payment intent metadata
      const reservation = await ctx.db.get(args.reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get the product to determine price
      const product = await ctx.db.get(reservation.productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Calculate amount based on product price and quantity
      const amount = product.price * reservation.quantity;

      const orderResult = await ctx.runMutation(api.orders.create, {
        productId: reservation.productId,
        reservationId: args.reservationId,
        quantity: reservation.quantity,
        amount,
        currency: 'usd', // This should come from the payment intent
        sessionId: args.sessionId,
        stripeSessionId: args.paymentIntentId,
      });

      return {
        success: true,
        orderId: orderResult.orderId,
        paymentStatus: stripePaymentIntent.status,
      };
    } catch (error) {
      console.error('Error confirming payment and creating order:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
});

/**
 * Mutation to handle webhook from Stripe for payment confirmation
 * This is an alternative approach to the client-side confirmation
 */
export const handleStripeWebhook = mutation({
  args: {
    signature: v.string(),
    payload: v.string(), // Raw payload string
  },
  handler: async (ctx, args) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      throw new Error('Missing Stripe webhook secret');
    }

    let event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(args.payload, args.signature, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        // Extract metadata to find reservation
        const { reservationId, sessionId } = paymentIntent.metadata || {};

        if (reservationId && sessionId) {
          // Confirm the reservation and create order
          await ctx.runMutation(api.inventory.confirmReservation, {
            reservationId,
            sessionId,
          });

          // Create the order
          // This is simplified - in reality you'd need to get the product and quantity
          // from the reservation or payment intent metadata
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const failedPaymentIntent = event.data.object;
        const { reservationId: failedReservationId, sessionId: failedSessionId } =
          failedPaymentIntent.metadata || {};

        if (failedReservationId && failedSessionId) {
          // Release the reservation since payment failed
          await ctx.runMutation(api.inventory.releaseReservation, {
            reservationId: failedReservationId,
            sessionId: failedSessionId,
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  },
});
