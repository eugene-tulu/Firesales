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

    // Generate a unique sale URL using cryptographically secure random
    // Using 8 random bytes encoded in base36 gives ~12 chars of randomness
    const randomBytes = new Uint8Array(6);
    crypto.getRandomValues(randomBytes);
    const saleUrl = Buffer.from(randomBytes).toString('base64url').substring(0, 8);

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

    // Initialize inventory for the product with the allocated amount (if not exists)
    const existingInventory = await ctx.db
      .query('inventory')
      .withIndex('by_productId', (q) => q.eq('productId', args.productId))
      .first();

    if (!existingInventory) {
      await ctx.db.insert('inventory', {
        productId: args.productId,
        totalUnits: args.allocatedInventory,
        availableUnits: args.allocatedInventory,
        reservedUnits: 0,
        soldUnits: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Optionally update total units if increased (ensure availableUnits stays consistent)
      const newTotal = Math.max(existingInventory.totalUnits, args.allocatedInventory);
      const delta = newTotal - existingInventory.totalUnits;
      await ctx.db.patch(existingInventory._id, {
        totalUnits: newTotal,
        availableUnits: existingInventory.availableUnits + delta,
        updatedAt: Date.now(),
      });
    }

    return { flashSaleId, saleUrl };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const sellerId = assertUserId(authUser, 'Authentication required');

    const flashSales = await ctx.db
      .query('flashSales')
      .withIndex('by_userId', (q) => q.eq('userId', sellerId))
      .order('desc')
      .collect();

    const flashSalesWithProducts = await Promise.all(
      flashSales.map(async (flashSale) => {
        const product = await ctx.db.get(flashSale.productId);
        return { ...flashSale, product };
      }),
    );

    return flashSalesWithProducts;
  },
});

// Get a single flash sale by ID — verifies ownership
export const get = query({
  args: {
    flashSaleId: v.id('flashSales'),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;

    const sellerId = assertUserId(authUser, 'Authentication required');

    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale) return null;

    if (flashSale.userId !== sellerId) {
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
    viewerUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db
      .query('flashSales')
      .withIndex('by_saleUrl', (q) => q.eq('saleUrl', args.saleUrl))
      .first();

    if (!flashSale) {
      return null;
    }

    const product = await ctx.db.get(flashSale.productId);

    const isPreviewing = args.viewerUserId === flashSale.userId;
    const showPreview = flashSale.status === 'draft' || flashSale.status === 'live';
    if (!showPreview && !isPreviewing) {
      return null;
    }

    return {
      ...flashSale,
      product,
      isPreview: flashSale.status === 'draft',
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
