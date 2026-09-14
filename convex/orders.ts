import { v } from 'convex/values';
import { assertUserId } from '../src/lib/shared/user-id';
import { internalMutation, query } from './_generated/server';
import { authComponent } from './auth';

// Called only after a verified Paystack transaction has been confirmed by the
// Durable Object. Provider + reference is the idempotency key for retries.
export const recordPaidPaystackOrder = internalMutation({
  args: {
    reservationId: v.id('reservations'),
    paymentReference: v.string(),
    paymentTransactionId: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('orders')
      .withIndex('by_paymentProvider_reference', (q) =>
        q.eq('paymentProvider', 'paystack').eq('paymentReference', args.paymentReference),
      )
      .first();
    if (existing) return { orderId: existing._id, alreadyRecorded: true };

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || !reservation.flashSaleId) {
      throw new Error('Reservation not found for this payment.');
    }
    if (reservation.status !== 'reserved' && reservation.status !== 'confirmed') {
      throw new Error('This reservation is no longer payable.');
    }
    if (
      reservation.paymentProvider !== 'paystack' ||
      reservation.paymentReference !== args.paymentReference
    ) {
      throw new Error('This payment does not belong to the held reservation.');
    }

    const [flashSale, product] = await Promise.all([
      ctx.db.get(reservation.flashSaleId),
      ctx.db.get(reservation.productId),
    ]);
    if (!flashSale || !product) throw new Error('Drop or menu item not found.');

    const now = Date.now();
    const amount = product.price * reservation.quantity;
    const orderId = await ctx.db.insert('orders', {
      productId: reservation.productId,
      flashSaleId: reservation.flashSaleId,
      reservationId: reservation._id,
      sessionId: reservation.sessionId,
      paymentProvider: 'paystack',
      paymentReference: args.paymentReference,
      paymentTransactionId: args.paymentTransactionId,
      guestEmail: reservation.guestEmail?.trim().toLowerCase() || undefined,
      guestName: reservation.guestName?.trim() || undefined,
      dietaryNotes: reservation.dietaryNotes?.trim() || undefined,
      status: 'paid',
      amount,
      currency: args.currency.toUpperCase(),
      quantity: reservation.quantity,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(reservation._id, { status: 'confirmed', updatedAt: now });

    const totalSales = flashSale.totalSales + reservation.quantity;
    const totalRevenue = flashSale.totalRevenue + amount;
    const isSoldOut = totalSales >= flashSale.allocatedInventory;
    await ctx.db.patch(flashSale._id, {
      totalSales,
      totalRevenue,
      reservedInventory: Math.max(0, (flashSale.reservedInventory ?? 0) - reservation.quantity),
      status: isSoldOut ? 'completed' : flashSale.status,
      endedAt: isSoldOut ? now : flashSale.endedAt,
      updatedAt: now,
    });

    if (isSoldOut) {
      await ctx.db.patch(product._id, { status: 'sold_out', updatedAt: now });
    }

    return { orderId, alreadyRecorded: false };
  },
});

export const get = query({
  args: { id: v.id('orders') },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const listByProduct = query({
  args: { productId: v.id('products') },
  handler: async (ctx, args) =>
    ctx.db
      .query('orders')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .order('desc')
      .collect(),
});

// Chef-only prep list: the information required to cook and hand over a paid
// batch, without exposing guest details publicly.
export const listByFlashSale = query({
  args: { flashSaleId: v.id('flashSales') },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.userId !== userId) {
      throw new Error('Drop not found or unauthorized.');
    }

    return ctx.db
      .query('orders')
      .withIndex('by_flashSaleId', (q) => q.eq('flashSaleId', args.flashSaleId))
      .order('desc')
      .collect();
  },
});

export const listBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query('orders')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .collect(),
});

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return [];

    return ctx.db
      .query('orders')
      .filter((q) => q.eq(q.field('userId'), authUser._id.toString()))
      .order('desc')
      .collect();
  },
});
