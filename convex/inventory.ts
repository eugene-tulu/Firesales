import { v } from 'convex/values';
import {
  releaseReservation as cloudflareReleaseReservation,
  reserveInventory as cloudflareReserveInventory,
} from '../src/lib/server/cloudflareInventory';
import { assertUserId } from '../src/lib/shared/user-id';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { authComponent } from './auth';

const HOLD_DURATION_MS = 15 * 60 * 1000;

// Legacy product-level projection. Public buying flows use the drop-specific
// Durable Object below, not this table, so one menu item can be reused safely.
export const get = query({
  args: { productId: v.id('products') },
  handler: async (ctx, args) =>
    ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first(),
});

export const initialize = mutation({
  args: { productId: v.id('products'), totalUnits: v.number() },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== userId)
      throw new Error('Menu item not found or unauthorized');
    if (!Number.isInteger(args.totalUnits) || args.totalUnits < 0) {
      throw new Error('Inventory must be a non-negative whole number.');
    }

    const current = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();
    const now = Date.now();
    if (current) {
      await ctx.db.patch(current._id, {
        totalUnits: args.totalUnits,
        availableUnits: args.totalUnits,
        reservedUnits: 0,
        soldUnits: 0,
        updatedAt: now,
      });
      return current._id;
    }

    return ctx.db.insert('inventory', {
      productId: args.productId,
      totalUnits: args.totalUnits,
      availableUnits: args.totalUnits,
      reservedUnits: 0,
      soldUnits: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getDropForReservation = internalQuery({
  args: { flashSaleId: v.id('flashSales') },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.status !== 'live') return null;
    const product = await ctx.db.get(flashSale.productId);
    if (!product) return null;
    return {
      flashSaleId: flashSale._id,
      productId: flashSale.productId,
      allocatedInventory: flashSale.allocatedInventory,
      remainingInventory: flashSale.remainingInventory,
      productName: product.name,
    };
  },
});

export const recordReservationHold = internalMutation({
  args: {
    flashSaleId: v.id('flashSales'),
    quantity: v.number(),
    sessionId: v.string(),
    cloudflareReservationId: v.string(),
  },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.status !== 'live') {
      throw new Error('This drop is not currently open.');
    }
    if (flashSale.remainingInventory < args.quantity) {
      throw new Error('This drop no longer has enough plates available.');
    }

    const now = Date.now();
    const reservationId = await ctx.db.insert('reservations', {
      productId: flashSale.productId,
      flashSaleId: args.flashSaleId,
      sessionId: args.sessionId,
      cloudflareReservationId: args.cloudflareReservationId,
      quantity: args.quantity,
      status: 'reserved',
      expiresAt: now + HOLD_DURATION_MS,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.flashSaleId, {
      remainingInventory: flashSale.remainingInventory - args.quantity,
      reservedInventory: (flashSale.reservedInventory ?? 0) + args.quantity,
      updatedAt: now,
    });

    return { reservationId, expiresAt: now + HOLD_DURATION_MS };
  },
});

// Public checkout path. The Durable Object reserves first; the Convex
// projection is updated only after that atomic hold succeeds.
export const reserve = action({
  args: {
    flashSaleId: v.id('flashSales'),
    quantity: v.number(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{ reservationId: Id<'reservations'>; expiresAt: number }> => {
    if (!Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > 4) {
      throw new Error('Choose between one and four plates.');
    }
    if (!args.sessionId.trim()) throw new Error('A checkout session is required.');

    const drop = await ctx.runQuery(internal.inventory.getDropForReservation, {
      flashSaleId: args.flashSaleId,
    });
    if (!drop) throw new Error('This drop is not currently open.');

    const cloudflareHold = await cloudflareReserveInventory({
      saleId: args.flashSaleId,
      totalUnits: drop.allocatedInventory,
      quantity: args.quantity,
      sessionId: args.sessionId,
    });
    if (!cloudflareHold.success || !cloudflareHold.reservationId) {
      throw new Error(cloudflareHold.error || 'Unable to hold plates right now.');
    }

    try {
      return await ctx.runMutation(internal.inventory.recordReservationHold, {
        flashSaleId: args.flashSaleId,
        quantity: args.quantity,
        sessionId: args.sessionId,
        cloudflareReservationId: cloudflareHold.reservationId,
      });
    } catch (error) {
      // Do not strand capacity if the durable hold succeeds but the Convex
      // projection cannot be recorded.
      await cloudflareReleaseReservation({
        saleId: args.flashSaleId,
        reservationId: cloudflareHold.reservationId,
        sessionId: args.sessionId,
      }).catch(() => undefined);
      throw error;
    }
  },
});

export const getReservationForCheckout = internalQuery({
  args: { reservationId: v.id('reservations'), sessionId: v.string() },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !reservation ||
      reservation.sessionId !== args.sessionId ||
      reservation.status !== 'reserved'
    ) {
      return null;
    }
    const flashSale = reservation.flashSaleId ? await ctx.db.get(reservation.flashSaleId) : null;
    const product = await ctx.db.get(reservation.productId);
    if (
      !flashSale ||
      !product ||
      flashSale.status !== 'live' ||
      reservation.expiresAt < Date.now()
    ) {
      return null;
    }
    const chefProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', flashSale.userId))
      .first();

    return {
      reservation,
      flashSale,
      product,
      paystackSubaccountCode: chefProfile?.paystackSubaccountCode,
    };
  },
});

export const getReservationForPayment = internalQuery({
  args: { reservationId: v.id('reservations'), sessionId: v.string() },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.sessionId !== args.sessionId || !reservation.flashSaleId) {
      return null;
    }
    const flashSale = await ctx.db.get(reservation.flashSaleId);
    const product = await ctx.db.get(reservation.productId);
    if (!flashSale || !product || !reservation.cloudflareReservationId) return null;
    return { reservation, flashSale, product };
  },
});

export const attachPaymentCheckout = internalMutation({
  args: {
    reservationId: v.id('reservations'),
    sessionId: v.string(),
    provider: v.string(),
    reference: v.string(),
    checkoutUrl: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    dietaryNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !reservation ||
      reservation.sessionId !== args.sessionId ||
      reservation.status !== 'reserved'
    ) {
      throw new Error('Reservation is no longer available.');
    }
    await ctx.db.patch(args.reservationId, {
      paymentProvider: args.provider,
      paymentReference: args.reference,
      paymentCheckoutUrl: args.checkoutUrl,
      guestEmail: args.customerEmail,
      guestName: args.customerName,
      dietaryNotes: args.dietaryNotes,
      updatedAt: Date.now(),
    });
  },
});

export const getReservation = query({
  args: { reservationId: v.id('reservations'), sessionId: v.string() },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.sessionId !== args.sessionId) return null;
    return reservation;
  },
});

export const listExpiredReservations = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('reservations')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', args.now))
      .filter((q) => q.eq(q.field('status'), 'reserved'))
      .take(100),
});

export const markReservationReleased = internalMutation({
  args: {
    reservationId: v.id('reservations'),
    status: v.union(v.literal('cancelled'), v.literal('expired')),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== 'reserved') return { released: false };

    const now = Date.now();
    await ctx.db.patch(args.reservationId, { status: args.status, updatedAt: now });
    if (reservation.flashSaleId) {
      const flashSale = await ctx.db.get(reservation.flashSaleId);
      if (flashSale) {
        await ctx.db.patch(flashSale._id, {
          remainingInventory: Math.min(
            flashSale.allocatedInventory - flashSale.totalSales,
            flashSale.remainingInventory + reservation.quantity,
          ),
          reservedInventory: Math.max(0, (flashSale.reservedInventory ?? 0) - reservation.quantity),
          updatedAt: now,
        });
      }
    }
    return { released: true };
  },
});

async function expireReservations(ctx: ActionCtx): Promise<{ releasedCount: number }> {
  const expiredReservations = await ctx.runQuery(internal.inventory.listExpiredReservations, {
    now: Date.now(),
  });
  let releasedCount = 0;

  for (const reservation of expiredReservations) {
    if (!reservation.flashSaleId || !reservation.cloudflareReservationId) continue;
    const remoteResult = await cloudflareReleaseReservation({
      saleId: reservation.flashSaleId,
      reservationId: reservation.cloudflareReservationId,
      sessionId: reservation.sessionId,
    }).catch(() => null);

    // The Durable Object may have already cleaned up an expired hold. In that
    // case its local capacity is safe and only the Convex projection remains.
    if (remoteResult?.success || remoteResult?.error?.includes('not found or expired')) {
      const result = await ctx.runMutation(internal.inventory.markReservationReleased, {
        reservationId: reservation._id,
        status: 'expired',
      });
      if (result.released) releasedCount += 1;
    }
  }

  return { releasedCount };
}

export const checkForExpired = action({
  args: {},
  handler: expireReservations,
});

export const expireReservationsOnSchedule = internalAction({
  args: {},
  handler: expireReservations,
});
