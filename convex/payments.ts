import { v } from 'convex/values';
import { confirmReservation as cloudflareConfirmReservation } from '../src/lib/server/cloudflareInventory';
import { components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, httpAction, internalMutation, internalQuery, mutation } from './_generated/server';

const PAYSTACK_API_URL = 'https://api.paystack.co';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    reference?: string;
  };
};

type PaystackTransaction = {
  id?: string | number;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: unknown;
  customer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
};

type PaystackWebhookEvent = {
  event?: string;
  data?: PaystackTransaction;
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: PaystackTransaction;
};

function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error('Payments are not configured yet. Please try again shortly.');

  const currency = (process.env.PAYSTACK_CURRENCY || 'KES').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('PAYSTACK_CURRENCY must be a three-letter ISO currency code.');
  }

  return { secretKey, currency };
}

function getAppUrl() {
  return (process.env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyPaystackWebhookSignature(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return constantTimeEqual(toHex(digest), signature.trim().toLowerCase());
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function makePaymentReference(reservationId: string) {
  const normalizedId = reservationId.replace(/[^a-zA-Z0-9.-]/g, '');
  return `fs-${normalizedId}`;
}

function sanitizeGuestDetails(args: {
  customerEmail: string;
  customerName?: string;
  dietaryNotes?: string;
}) {
  const customerEmail = args.customerEmail.trim().toLowerCase();
  if (!emailPattern.test(customerEmail)) {
    throw new Error('Enter a valid email address for your receipt and pickup details.');
  }

  const customerName = args.customerName?.trim() || undefined;
  const dietaryNotes = args.dietaryNotes?.trim() || undefined;
  if (customerName && customerName.length > 120) {
    throw new Error('Pickup name must be 120 characters or fewer.');
  }
  if (dietaryNotes && dietaryNotes.length > 300) {
    throw new Error('Dietary notes must be 300 characters or fewer.');
  }

  return { customerEmail, customerName, dietaryNotes };
}

async function verifyPaystackTransaction(reference: string, secretKey: string) {
  const response = await fetch(
    `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );
  const result = (await response.json().catch(() => ({}))) as PaystackVerifyResponse;
  if (!response.ok || !result.status || !result.data || result.data.status !== 'success') {
    throw new Error(result.message || 'Paystack could not verify a successful payment.');
  }
  return result.data;
}

// HTTP actions deliberately do not receive a database handle. Keep webhook
// idempotency behind internal functions so the endpoint can use the same
// durable ledger as all other Convex code.
export const getPaymentSaga = internalQuery({
  args: { paymentId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query('paymentSagaLog')
      .withIndex('by_paymentId', (q) => q.eq('paymentId', args.paymentId))
      .first(),
});

export const recordPaymentSaga = internalMutation({
  args: {
    paymentId: v.string(),
    event: v.string(),
    payload: v.any(),
    outcome: v.object({
      success: v.boolean(),
      userId: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('paymentSagaLog')
      .withIndex('by_paymentId', (q) => q.eq('paymentId', args.paymentId))
      .first();
    if (existing) return { alreadyRecorded: true };

    await ctx.db.insert('paymentSagaLog', {
      ...args,
      processedAt: Date.now(),
      createdAt: Date.now(),
    });
    return { alreadyRecorded: false };
  },
});

/**
 * Creates a Paystack hosted checkout for an already-held batch of plates.
 * Paystack charges the exact reservation total in the menu item's currency.
 * A verified chef subaccount is included when one has been configured, so
 * Paystack can apply its preconfigured marketplace split.
 */
export const createCheckoutSession = action({
  args: {
    flashSaleId: v.id('flashSales'),
    reservationId: v.id('reservations'),
    sessionId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    dietaryNotes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; reference: string }> => {
    const rateLimitResult = await ctx.runMutation(components.rateLimiter.lib.rateLimit, {
      name: 'createPaystackCheckout',
      key: `checkout:${args.sessionId}`,
      config: {
        kind: 'token bucket',
        rate: 10,
        period: 60 * 60 * 1000,
        capacity: 10,
      },
    });
    if (!rateLimitResult.ok) {
      const retryMinutes = Math.max(1, Math.ceil((rateLimitResult.retryAfter ?? 0) / 60_000));
      throw new Error(`Too many checkout attempts. Try again in ${retryMinutes} minutes.`);
    }

    const guest = sanitizeGuestDetails(args);
    const checkoutContext = await ctx.runQuery(internal.inventory.getReservationForCheckout, {
      reservationId: args.reservationId,
      sessionId: args.sessionId,
    });
    if (!checkoutContext || checkoutContext.flashSale._id !== args.flashSaleId) {
      throw new Error('Your plate hold is no longer available. Please try again.');
    }

    const { reservation, flashSale, product, paystackSubaccountCode } = checkoutContext;
    if (
      reservation.paymentProvider === 'paystack' &&
      reservation.paymentCheckoutUrl &&
      reservation.paymentReference
    ) {
      return {
        checkoutUrl: reservation.paymentCheckoutUrl,
        reference: reservation.paymentReference,
      };
    }

    const config = getPaystackConfig();
    const currency = (product.currency || config.currency).toUpperCase();
    if (currency !== config.currency) {
      throw new Error(`This drop is priced in ${currency}, not ${config.currency}.`);
    }

    const amount = product.price * reservation.quantity;
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new Error('This drop has an invalid checkout total.');
    }

    const reference = makePaymentReference(reservation._id);
    const checkoutPayload: Record<string, unknown> = {
      email: guest.customerEmail,
      amount: String(amount),
      currency,
      reference,
      callback_url: `${getAppUrl()}/live/${flashSale.saleUrl}?checkout=complete`,
      metadata: JSON.stringify({
        reservationId: reservation._id,
        sessionId: reservation.sessionId,
        flashSaleId: flashSale._id,
        productId: product._id,
      }),
    };
    if (paystackSubaccountCode) checkoutPayload.subaccount = paystackSubaccountCode;

    const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify(checkoutPayload),
    });
    const result = (await response.json().catch(() => ({}))) as PaystackInitializeResponse;
    if (
      !response.ok ||
      !result.status ||
      !result.data?.authorization_url ||
      !result.data.reference
    ) {
      console.error('Paystack checkout initialization failed:', response.status, result.message);
      throw new Error('Secure checkout is temporarily unavailable. Please try again.');
    }
    if (result.data.reference !== reference) {
      console.error('Paystack returned an unexpected transaction reference.');
      throw new Error('Secure checkout is temporarily unavailable. Please try again.');
    }

    await ctx.runMutation(internal.inventory.attachPaymentCheckout, {
      reservationId: args.reservationId,
      sessionId: args.sessionId,
      provider: 'paystack',
      reference: result.data.reference,
      checkoutUrl: result.data.authorization_url,
      ...guest,
    });

    return { checkoutUrl: result.data.authorization_url, reference: result.data.reference };
  },
});

/**
 * Paystack signs every webhook with an HMAC-SHA512 of its raw request body.
 * We then independently verify the transaction with Paystack before the
 * Durable Object turns a held plate into a paid order.
 */
export const handlePaystackWebhook = httpAction(async (ctx, request: Request) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error('Missing PAYSTACK_SECRET_KEY');
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';
  if (!signature) return Response.json({ error: 'Missing signature' }, { status: 400 });
  if (!(await verifyPaystackWebhookSignature(payload, signature, secretKey))) {
    console.error('Invalid Paystack webhook signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(payload) as PaystackWebhookEvent;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Paystack sends successful-payment events for fulfillment. Other signed
  // events are acknowledged here without changing inventory or orders.
  if (event.event !== 'charge.success') {
    return Response.json({ received: true, ignored: event.event || 'unknown' });
  }

  const reference = event.data?.reference;
  if (!reference) return Response.json({ error: 'Missing payment reference' }, { status: 400 });

  const paymentId = `paystack:${reference}`;
  const existingSaga = await ctx.runQuery(internal.payments.getPaymentSaga, { paymentId });
  if (existingSaga) return Response.json({ received: true, idempotent: true });

  try {
    const config = getPaystackConfig();
    const transaction = await verifyPaystackTransaction(reference, config.secretKey);
    if (transaction.reference !== reference) {
      throw new Error('Paystack verification returned a different payment reference.');
    }

    const metadata = parseMetadata(transaction.metadata);
    const rawReservationId =
      typeof metadata.reservationId === 'string' ? metadata.reservationId : '';
    const sessionId = typeof metadata.sessionId === 'string' ? metadata.sessionId : '';
    const flashSaleId = typeof metadata.flashSaleId === 'string' ? metadata.flashSaleId : '';
    if (!rawReservationId || !sessionId || !flashSaleId) {
      throw new Error('Paystack payment is missing its Firesales reservation metadata.');
    }
    const reservationId = rawReservationId as Id<'reservations'>;

    const paymentContext = await ctx.runQuery(internal.inventory.getReservationForPayment, {
      reservationId,
      sessionId,
    });
    if (!paymentContext || paymentContext.flashSale._id !== flashSaleId) {
      throw new Error('Payment metadata does not match an active drop.');
    }
    if (
      paymentContext.reservation.paymentProvider !== 'paystack' ||
      paymentContext.reservation.paymentReference !== reference
    ) {
      throw new Error('Payment reference does not match its Firesales reservation.');
    }

    const expectedAmount = paymentContext.product.price * paymentContext.reservation.quantity;
    const expectedCurrency = (paymentContext.product.currency || config.currency).toUpperCase();
    if (
      transaction.amount !== expectedAmount ||
      transaction.currency?.toUpperCase() !== expectedCurrency
    ) {
      throw new Error('Paystack payment total does not match the held plates.');
    }

    const cloudflareReservationId = paymentContext.reservation.cloudflareReservationId;
    if (!cloudflareReservationId) {
      throw new Error('Reservation is missing its inventory hold.');
    }

    const confirmed = await cloudflareConfirmReservation({
      saleId: paymentContext.flashSale._id,
      reservationId: cloudflareReservationId,
      sessionId,
    });
    if (!confirmed.success) {
      throw new Error(confirmed.error || 'Unable to confirm the inventory hold.');
    }

    const result = await ctx.runMutation(internal.orders.recordPaidPaystackOrder, {
      reservationId,
      paymentReference: reference,
      paymentTransactionId:
        transaction.id === undefined || transaction.id === null
          ? undefined
          : String(transaction.id),
      currency: expectedCurrency,
    });

    await ctx.runMutation(internal.payments.recordPaymentSaga, {
      paymentId,
      event: event.event,
      payload: event,
      outcome: { success: true, userId: paymentContext.reservation.userId },
    });
    console.info('Paystack payment recorded:', result.orderId);
    return Response.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing error:', error);
    // A non-200 response tells Paystack to retry; do not write an idempotency
    // row for a failed attempt.
    return Response.json({ error: 'Payment processing failed' }, { status: 500 });
  }
});

export const auditPaymentAction = mutation({
  args: {
    orderId: v.optional(v.id('orders')),
    action: v.string(),
    details: v.string(),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await ctx.auth.getUserIdentity();
    if (!authUser) throw new Error('Authentication required');

    await ctx.db.insert('auditLogs', {
      userId: authUser.subject,
      action: args.action,
      entityType: args.entityType || 'order',
      entityId: args.orderId?.toString(),
      metadata: args.details,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});
