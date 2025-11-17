import { v } from 'convex/values';
import {
  checkInventory as cloudflareCheckInventory,
  confirmReservation as cloudflareConfirmReservation,
  releaseReservation as cloudflareReleaseReservation,
  reserveInventory as cloudflareReserveInventory,
} from '../src/lib/server/cloudflareInventory';
import { mutation, query } from './_generated/server';
import { authComponent } from './auth';

// Get inventory for a product
export const get = query({
  args: {
    productId: v.id('products'),
  },
  handler: async (ctx, args) => {
    const inventory = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();

    return inventory;
  },
});

// Initialize inventory for a product
export const initialize = mutation({
  args: {
    productId: v.id('products'),
    totalUnits: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error('Authentication required');
    }

    // Verify the product belongs to the user
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== authUser._id) {
      throw new Error('Product not found or unauthorized');
    }

    // Check if inventory already exists
    const existingInventory = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();

    if (existingInventory) {
      // Update existing inventory
      await ctx.db.patch(existingInventory._id, {
        totalUnits: args.totalUnits,
        availableUnits: args.totalUnits,
        reservedUnits: 0,
        soldUnits: 0,
        updatedAt: Date.now(),
      });
    } else {
      // Create new inventory
      await ctx.db.insert('inventory', {
        productId: args.productId,
        totalUnits: args.totalUnits,
        availableUnits: args.totalUnits,
        reservedUnits: 0,
        soldUnits: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Update inventory (for admin/merchant operations)
export const update = mutation({
  args: {
    productId: v.id('products'),
    totalUnits: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error('Authentication required');
    }

    // Verify the product belongs to the user
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== authUser._id) {
      throw new Error('Product not found or unauthorized');
    }

    const inventory = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Calculate the difference to adjust available units accordingly
    const difference = args.totalUnits - inventory.totalUnits;

    await ctx.db.patch(inventory._id, {
      totalUnits: args.totalUnits,
      availableUnits: Math.max(0, inventory.availableUnits + difference), // Ensure available units don't go negative
      updatedAt: Date.now(),
    });
  },
});

// Reserve inventory for a purchase using Cloudflare for atomic operations
export const reserve = mutation({
  args: {
    productId: v.id('products'),
    quantity: v.number(),
    sessionId: v.string(), // Session ID for anonymous users, or user ID for authenticated users
  },
  handler: async (ctx, args) => {
    // First, verify the product exists
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Use Cloudflare for the atomic inventory reservation
    const cfResult = await cloudflareReserveInventory({
      productId: args.productId,
      quantity: args.quantity,
      sessionId: args.sessionId,
    });

    if (!cfResult.success) {
      throw new Error(cfResult.error || 'Failed to reserve inventory');
    }

    // Create reservation record in Convex
    const reservationId = await ctx.db.insert('reservations', {
      productId: args.productId,
      sessionId: args.sessionId,
      quantity: args.quantity, // Store the quantity in the reservation
      status: 'reserved',
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes from now
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { reservationId };
  },
});

// Confirm reservation (convert to order) using Cloudflare for atomic operations
export const confirmReservation = mutation({
  args: {
    reservationId: v.id('reservations'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.sessionId !== args.sessionId) {
      throw new Error('Reservation not found or unauthorized');
    }

    if (reservation.status !== 'reserved') {
      throw new Error('Reservation is not in reserved state');
    }

    if (reservation.expiresAt < Date.now()) {
      throw new Error('Reservation has expired');
    }

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

    return { success: true };
  },
});

// Release reservation (when checkout is abandoned or fails) using Cloudflare for atomic operations
export const releaseReservation = mutation({
  args: {
    reservationId: v.id('reservations'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.sessionId !== args.sessionId) {
      throw new Error('Reservation not found or unauthorized');
    }

    if (reservation.status !== 'reserved') {
      throw new Error('Reservation is not in reserved state');
    }

    // Use Cloudflare to release the reservation atomically
    const cfResult = await cloudflareReleaseReservation({
      reservationId: args.reservationId,
      sessionId: args.sessionId,
    });

    if (!cfResult.success) {
      throw new Error(cfResult.error || 'Failed to release reservation');
    }

    // Update reservation status in Convex
    await ctx.db.patch(args.reservationId, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get reservation by ID
export const getReservation = query({
  args: {
    reservationId: v.id('reservations'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.sessionId !== args.sessionId) {
      return null;
    }

    return reservation;
  },
});
