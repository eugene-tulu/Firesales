import { v } from 'convex/values';
import { releaseReservation as cloudflareReleaseReservation } from '../src/lib/server/cloudflareInventory';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

// Get reservation by ID
export const get = query({
  args: {
    id: v.id('reservations'),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.id);
    return reservation;
  },
});

// List reservations for a product
export const listByProduct = query({
  args: {
    productId: v.id('products'),
  },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .order('desc')
      .collect();

    return reservations;
  },
});

// List reservations by session
export const listBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query('reservations')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .collect();

    return reservations;
  },
});

// Check for expired reservations and release them
export const checkForExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredReservations = await ctx.db
      .query('reservations')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .collect();

    for (const reservation of expiredReservations) {
      if (reservation.status === 'reserved') {
        // Use Cloudflare to release the expired reservation atomically
        const cfResult = await cloudflareReleaseReservation({
          reservationId: reservation._id,
          sessionId: reservation.sessionId,
        });

        if (cfResult.success) {
          // Update reservation status in Convex
          await ctx.db.patch(reservation._id, {
            status: 'expired',
            updatedAt: Date.now(),
          });
        } else {
          console.error(
            `Failed to release expired reservation ${reservation._id}:`,
            cfResult.error,
          );
        }
      }
    }

    return { releasedCount: expiredReservations.length };
  },
});
