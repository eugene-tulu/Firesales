import { sha256 } from 'js-sha256';
import { v, ConvexError } from 'convex/values';
import { api, components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction, mutation, action } from './_generated/server';
import { dodoPayments } from './auth';

/**
 * Verify Dodo Payments webhook signature using HMAC-SHA256
 */
function verifyDodoWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const h = sha256.hmac.create(secret);
    h.update(payload);
    const expected = 'sha256=' + h.digest();
    const actual = signature.toLowerCase();
    const expectedLower = expected.toLowerCase();
    if (actual.length !== expectedLower.length) return false;
    // Constant-time comparison
    let result = 0;
    for (let i = 0; i < actual.length; i++) {
      result |= actual.charCodeAt(i) ^ expectedLower.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Creates a Dodo Payments checkout session for a flash sale purchase
 */
export const createCheckoutSession = mutation({
  args: {
    productId: v.id('products'),
    quantity: v.number(),
    reservationId: v.id('reservations'),
    sessionId: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; cartId: string }> => {
    // Apply rate limiting based on session ID (prevents spam)
    const rateLimitKey = `checkout:${args.sessionId}`;
    const rateLimitResult = await ctx.runMutation(components.rateLimiter.lib.rateLimit, {
      name: 'createCheckoutSession',
      key: rateLimitKey,
      config: {
        kind: 'token bucket',
        rate: 10, // 10 attempts
        period: 60 * 60 * 1000, // per hour
        capacity: 10,
      },
    });

    if (!rateLimitResult.ok) {
      const retryMinutes = Math.ceil((rateLimitResult.retryAfter ?? 0) / (60 * 1000));
      throw new Error(
        `Rate limit exceeded. Too many checkout attempts. Please try again in ${retryMinutes} minutes.`,
      );
    }

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || (reservation as any).sessionId !== args.sessionId) {
      throw new Error('Invalid reservation');
    }
    if ((reservation as any).status !== 'reserved') {
      throw new Error('Reservation is not in reserved state');
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const dodoProductId = product._id.toString();

    const checkoutParams: any = {
      product_cart: [{ product_id: dodoProductId, quantity: args.quantity }],
      return_url:
        process.env.DODO_PAYMENTS_RETURN_URL ||
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/dashboard/flash-sales`,
      metadata: {
        reservationId: args.reservationId,
        sessionId: args.sessionId,
        productId: args.productId,
      },
    };

    if (args.customerEmail) {
      checkoutParams.customer = {
        email: args.customerEmail,
        ...(args.customerName && { name: args.customerName }),
      };
    }

    try {
      const session = await dodoPayments.checkoutSessions.create(checkoutParams);
      if (!session?.checkout_url) {
        throw new Error('Failed to create checkout session');
      }

      return {
        checkoutUrl: session.checkout_url,
        cartId: session.session_id || '',
      };
    } catch (error) {
      console.error('Dodo checkout session creation failed:', error);
      throw new Error('Payment service unavailable. Please try again later.');
    }
  },
});

/**
 * Dodo Payments webhook HTTP endpoint
 * Receives signed POST requests from Dodo and processes payment events
 */
/**
 * Dodo Payments webhook HTTP endpoint with saga pattern and idempotency
 */
export const handleDodoWebhook = httpAction(
  async (ctx: any, request: Request): Promise<Response> => {
    const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing Dodo Payments webhook secret');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
      });
    }

    try {
      const payload = await request.text();
      const signature =
        request.headers.get('x-dodo-signature') || request.headers.get('X-Dodo-Signature') || '';

      if (!signature) {
        console.error('Missing Dodo webhook signature header');
        return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 });
      }

      const isValid = verifyDodoWebhookSignature(payload, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid Dodo webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
      }

      let event: any;
      try {
        event = JSON.parse(payload);
      } catch (err) {
        console.error('Invalid webhook payload JSON:', err);
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      const metadata = event?.data?.metadata || {};
      const { reservationId, sessionId, flashSaleId } = metadata;

      console.log(`Received Dodo webhook: ${event.type}`, metadata);

      // Generate stable paymentId for idempotency
      const paymentId =
        event.data?.cart_id || event.data?.payment_id || event.id || `${event.type}-${Date.now()}`;

      // Idempotency check: if already processed, short-circuit
      const existingSaga = await ctx.db
        .query('paymentSagaLog')
        .withIndex('by_paymentId', (q: any) => q.eq('paymentId', paymentId))
        .first();

      if (existingSaga) {
        return new Response(JSON.stringify({ received: true, idempotent: true }), { status: 200 });
      }

      // Track outcome for saga log
      let outcome: { success: boolean; userId?: string; error?: string } = { success: false };

      switch (event.type) {
        case 'payment.succeeded':
          console.log(`Payment succeeded for reservation ${reservationId}`);
          if (reservationId && sessionId) {
            try {
              await ctx.runMutation(api.inventory.confirmReservation, { reservationId, sessionId });

              const reservation = await ctx.db.get(reservationId);
              if (!reservation) {
                console.error(`Reservation not found: ${reservationId}`);
                outcome.error = 'Reservation not found';
                break;
              }

              const product = await ctx.db.get((reservation as any).productId);
              if (!product) {
                console.error(`Product not found: ${(reservation as any).productId}`);
                outcome.error = 'Product not found';
                break;
              }

              const amount = (product as any).price * (reservation as any).quantity;

              const orderResult = await ctx.runMutation(api.orders.create, {
                productId: (reservation as any).productId,
                reservationId,
                quantity: (reservation as any).quantity,
                amount,
                currency: 'usd',
                sessionId,
                dodoPaymentId: paymentId,
              });

              if (flashSaleId) {
                await ctx.runMutation(api.flashSales.updateStats, {
                  flashSaleId,
                  quantity: (reservation as any).quantity,
                  amount,
                });
              }

              console.log(`Order created successfully: ${orderResult.orderId}`);
              outcome.success = true;
              outcome.userId = (reservation as any).userId;
            } catch (error: any) {
              console.error('Error processing successful payment:', error);
              outcome.error = error.message;
              // Record failure to prevent retry storms for permanent errors
              await ctx.db.insert('paymentSagaLog', {
                paymentId,
                event: event.type,
                payload: event,
                outcome,
                processedAt: Date.now(),
                createdAt: Date.now(),
              });
              return new Response(JSON.stringify({ error: 'Processing failed' }), { status: 500 });
            }
          } else {
            outcome.error = 'Missing reservationId or sessionId';
          }
          break;

        case 'payment.failed':
        case 'payment.cancelled':
          console.log(`Payment ${event.type} for reservation ${reservationId}`);
          if (reservationId && sessionId) {
            try {
              await ctx.runMutation(api.inventory.releaseReservation, { reservationId, sessionId });
              console.log(`Reservation released due to ${event.type}: ${reservationId}`);
              outcome.success = true;
            } catch (error: any) {
              console.error(`Error releasing reservation after ${event.type}:`, error);
              outcome.error = error.message;
            }
          }
          break;

        case 'refund.succeeded':
          console.log(`Refund processed: ${event.id}`);
          outcome.success = true;
          break;

        default:
          console.log(`Unhandled Dodo webhook event type: ${event.type}`);
          // Mark as handled to prevent retry for unknown events
          outcome.success = true;
          break;
      }

      // Record saga outcome (success or handled outcome)
      await ctx.db.insert('paymentSagaLog', {
        paymentId,
        event: event.type,
        payload: event,
        outcome,
        processedAt: Date.now(),
        createdAt: Date.now(),
      });

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
  },
);

/**
 * Audits a payment-related action for security tracking
 */
export const auditPaymentAction = mutation({
  args: {
    orderId: v.optional(v.id('orders')),
    action: v.string(),
    details: v.string(),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await ctx.auth.getUserIdentity();
    if (!authUser) {
      throw new Error('Authentication required');
    }

    // Write audit entry directly
    await ctx.db.insert('auditLogs', {
      userId: authUser.subject,
      action: args.action,
      entityType: args.entityType || 'order',
      entityId: args.orderId?.toString(),
      metadata: args.details,
      createdAt: Date.now(),
      ipAddress: (ctx as any).request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: (ctx as any).request?.headers.get('user-agent') || undefined,
    });

    return { success: true };
  },
});
