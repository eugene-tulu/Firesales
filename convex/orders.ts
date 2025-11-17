import { v } from 'convex/values';
import {
  confirmReservation as cloudflareConfirmReservation,
  releaseReservation as cloudflareReleaseReservation,
} from '../src/lib/server/cloudflareInventory';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

// Create a new order
export const create = mutation({
  args: {
    productId: v.id('products'),
    reservationId: v.optional(v.id('reservations')), // Optional if bypassing reservation system
    quantity: v.number(),
    amount: v.number(),
    currency: v.string(),
    sessionId: v.string(), // Session ID for anonymous users, or user ID for authenticated users
    stripeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the product exists
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // If a reservation ID is provided, confirm it atomically with Cloudflare
    if (args.reservationId) {
      // Use Cloudflare to confirm the reservation atomically
      const cfResult = await cloudflareConfirmReservation({
        reservationId: args.reservationId,
        sessionId: args.sessionId,
      });

      if (!cfResult.success) {
        throw new Error(cfResult.error || 'Failed to confirm reservation');
      }

      // Update reservation status in Convex
      await ctx.db.patch(args.reservationId, {
        status: 'confirmed',
        updatedAt: Date.now(),
      });
    }

    // Create the order
    const orderId = await ctx.db.insert('orders', {
      productId: args.productId,
      userId: args.reservationId ? undefined : args.sessionId, // Store session ID if no reservation
      sessionId: args.sessionId,
      stripeSessionId: args.stripeSessionId,
      status: 'pending',
      amount: args.amount,
      currency: args.currency,
      quantity: args.quantity,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update inventory
    const inventory = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();

    if (inventory) {
      await ctx.db.patch(inventory._id, {
        reservedUnits: args.reservationId
          ? Math.max(0, inventory.reservedUnits - args.quantity)
          : inventory.reservedUnits,
        soldUnits: inventory.soldUnits + args.quantity,
        updatedAt: Date.now(),
      });
    }

    // Update flash sale stats if applicable
    const flashSales = await ctx.db
      .query('flashSales')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .collect();

    for (const flashSale of flashSales) {
      // Update the flash sale with the sale information
      await ctx.db.patch(flashSale._id, {
        totalSales: flashSale.totalSales + args.quantity,
        totalRevenue: flashSale.totalRevenue + args.amount,
        remainingInventory: flashSale.remainingInventory - args.quantity,
        updatedAt: Date.now(),
      });

      // Check if the flash sale is completed
      if (flashSale.remainingInventory - args.quantity <= 0) {
        await ctx.db.patch(flashSale._id, {
          status: 'completed',
          endedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return { orderId };
  },
});

// Get order by ID
export const get = query({
  args: {
    id: v.id('orders'),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    return order;
  },
});

// Update order status (e.g., when payment is confirmed)
export const updateStatus = mutation({
  args: {
    orderId: v.id('orders'),
    status: v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('cancelled'),
      v.literal('refunded'),
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    await ctx.db.patch(args.orderId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// List orders for a product
export const listByProduct = query({
  args: {
    productId: v.id('products'),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .order('desc')
      .collect();

    return orders;
  },
});

// List orders by session
export const listBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .collect();

    return orders;
  },
});

// List orders by user (for authenticated users)
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error('Authentication required');
    }

    const orders = await ctx.db
      .query('orders')
      .filter((q) => q.eq('userId', authUser._id.toString()))
      .order('desc')
      .collect();

    return orders;
  },
});
