import { v } from 'convex/values';
import { assertUserId } from '../src/lib/shared/user-id';
import { api, internal } from './_generated/api';
import { action, mutation, query } from './_generated/server';
import { authComponent } from './auth';

// Create a new flash sale
export const create = mutation({
  args: {
    productId: v.id('products'),
    allocatedInventory: v.number(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');

    // Verify the product belongs to the user
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== userId) {
      throw new Error('Product not found or unauthorized');
    }

    // Generate a unique sale URL
    const saleUrl = Math.random().toString(36).substring(2, 10); // Random 8-character string

    // Create the flash sale
    const flashSaleId = await ctx.db.insert('flashSales', {
      productId: args.productId,
      allocatedInventory: args.allocatedInventory,
      saleUrl,
      status: 'draft',
      userId,
      totalSales: 0,
      totalRevenue: 0,
      remainingInventory: args.allocatedInventory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update the product status to active if it's not already
    if (product.status !== 'active') {
      await ctx.db.patch(args.productId, {
        status: 'active',
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { flashSaleId, saleUrl };
  },
});

// Get all flash sales for a user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');

    const flashSales = await ctx.db
      .query('flashSales')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();

    // Get product information for each flash sale
    const flashSalesWithProducts = await Promise.all(
      flashSales.map(async (flashSale) => {
        const product = await ctx.db.get(flashSale.productId);
        return {
          ...flashSale,
          product,
        };
      }),
    );

    return flashSalesWithProducts;
  },
});

// Get flash sale by ID
export const get = query({
  args: {
    flashSaleId: v.id('flashSales'),
  },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale) {
      return null;
    }

    const product = await ctx.db.get(flashSale.productId);

    return {
      ...flashSale,
      product,
    };
  },
});

// Get flash sale by sale URL (for public viewing)
export const getBySaleUrl = query({
  args: {
    saleUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db
      .query('flashSales')
      .withIndex('by_saleUrl', (q) => q.eq('saleUrl', args.saleUrl))
      .first();

    if (!flashSale) {
      return null;
    }

    // Only return flash sale if it's live
    if (flashSale.status !== 'live') {
      return null;
    }

    const product = await ctx.db.get(flashSale.productId);

    return {
      ...flashSale,
      product,
    };
  },
});

// Go live with a flash sale
export const goLive = mutation({
  args: {
    flashSaleId: v.id('flashSales'),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');

    // Verify the flash sale belongs to the user
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.userId !== userId) {
      throw new Error('Flash sale not found or unauthorized');
    }

    // Update the flash sale status to live
    await ctx.db.patch(args.flashSaleId, {
      status: 'live',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.flashSaleId;
  },
});

// Update flash sale stats when a purchase is made
export const updateStats = mutation({
  args: {
    flashSaleId: v.id('flashSales'),
    quantity: v.number(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale) {
      throw new Error('Flash sale not found');
    }

    // Update stats
    await ctx.db.patch(args.flashSaleId, {
      totalSales: flashSale.totalSales + args.quantity,
      totalRevenue: flashSale.totalRevenue + args.amount,
      remainingInventory: flashSale.remainingInventory - args.quantity,
      updatedAt: Date.now(),
    });

    // Check if the sale is completed
    const updatedFlashSale = await ctx.db.get(args.flashSaleId);
    if (updatedFlashSale && updatedFlashSale.remainingInventory <= 0) {
      await ctx.db.patch(args.flashSaleId, {
        status: 'completed',
        endedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
