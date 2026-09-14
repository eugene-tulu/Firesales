import { v } from 'convex/values';
import { assertUserId, normalizeUserId } from '../src/lib/shared/user-id';
import type { Doc } from './_generated/dataModel';
import { mutation, type QueryCtx, query } from './_generated/server';
import { authComponent } from './auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeSaleUrl() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function cleanOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function getDropSummary(ctx: QueryCtx, flashSale: Doc<'flashSales'>) {
  const [product, waitlist, paidOrders] = await Promise.all([
    ctx.db.get(flashSale.productId),
    ctx.db
      .query('waitlist')
      .withIndex('by_flashSaleId', (q) => q.eq('flashSaleId', flashSale._id))
      .collect(),
    ctx.db
      .query('orders')
      .withIndex('by_flashSaleId', (q) => q.eq('flashSaleId', flashSale._id))
      .collect(),
  ]);

  return {
    ...flashSale,
    product,
    waitlistCount: waitlist.length,
    guestCount: paidOrders.filter((order) => order.status === 'paid').length,
    reservedInventory: flashSale.reservedInventory ?? 0,
  };
}

// "flashSales" is retained as the table name. In the product it is a chef drop:
// a fixed batch of plates released to a guest list at a specific moment.
export const create = mutation({
  args: {
    productId: v.id('products'),
    allocatedInventory: v.number(),
    dropTitle: v.optional(v.string()),
    chefNote: v.optional(v.string()),
    pickupDetails: v.optional(v.string()),
    waitlistOpen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');

    if (!Number.isInteger(args.allocatedInventory) || args.allocatedInventory < 1) {
      throw new Error('Drop capacity must be a whole number of at least one plate.');
    }

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== userId) {
      throw new Error('Menu item not found or unauthorized');
    }

    let saleUrl = makeSaleUrl();
    // Extremely unlikely, but protect the public route from a collision.
    while (
      await ctx.db
        .query('flashSales')
        .withIndex('by_saleUrl', (q) => q.eq('saleUrl', saleUrl))
        .first()
    ) {
      saleUrl = makeSaleUrl();
    }

    const now = Date.now();
    const flashSaleId = await ctx.db.insert('flashSales', {
      productId: args.productId,
      allocatedInventory: args.allocatedInventory,
      saleUrl,
      status: 'draft',
      userId,
      dropTitle: cleanOptionalText(args.dropTitle) ?? product.name,
      chefNote: cleanOptionalText(args.chefNote),
      pickupDetails: cleanOptionalText(args.pickupDetails),
      waitlistOpen: args.waitlistOpen ?? true,
      totalSales: 0,
      totalRevenue: 0,
      remainingInventory: args.allocatedInventory,
      reservedInventory: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (product.status !== 'active') {
      await ctx.db.patch(args.productId, {
        status: 'active',
        publishedAt: now,
        updatedAt: now,
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

    return Promise.all(flashSales.map((flashSale) => getDropSummary(ctx, flashSale)));
  },
});

// Get a single drop by ID, only for its chef.
export const get = query({
  args: { flashSaleId: v.id('flashSales') },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;

    const sellerId = assertUserId(authUser, 'Authentication required');
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.userId !== sellerId) return null;

    return getDropSummary(ctx, flashSale);
  },
});

// Public view for guests. Drafts are visible only to their authenticated owner
// as a preview; ownership is derived from the auth token, never caller input.
export const getBySaleUrl = query({
  args: { saleUrl: v.string() },
  handler: async (ctx, args) => {
    const flashSale = await ctx.db
      .query('flashSales')
      .withIndex('by_saleUrl', (q) => q.eq('saleUrl', args.saleUrl))
      .first();
    if (!flashSale) return null;

    let authUser: unknown = null;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      // A guest is allowed to see only live/completed drops.
    }
    const isOwner = normalizeUserId(authUser) === flashSale.userId;
    if (!isOwner && flashSale.status !== 'live' && flashSale.status !== 'completed') {
      return null;
    }

    return {
      ...(await getDropSummary(ctx, flashSale)),
      isPreview: isOwner && flashSale.status === 'draft',
    };
  },
});

export const goLive = mutation({
  args: { flashSaleId: v.id('flashSales') },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');
    const flashSale = await ctx.db.get(args.flashSaleId);

    if (!flashSale || flashSale.userId !== userId) {
      throw new Error('Drop not found or unauthorized');
    }
    if (flashSale.status === 'completed') {
      throw new Error('This drop is complete. Create a new drop for the next batch.');
    }
    if (flashSale.status === 'live') {
      return { flashSaleId: args.flashSaleId, alreadyLive: true };
    }

    const now = Date.now();
    await ctx.db.patch(args.flashSaleId, {
      status: 'live',
      startedAt: now,
      updatedAt: now,
    });

    return { flashSaleId: args.flashSaleId, alreadyLive: false };
  },
});

export const joinWaitlist = mutation({
  args: {
    saleUrl: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!emailPattern.test(email)) {
      throw new Error('Enter a valid email address.');
    }

    const flashSale = await ctx.db
      .query('flashSales')
      .withIndex('by_saleUrl', (q) => q.eq('saleUrl', args.saleUrl))
      .first();
    if (!flashSale || !flashSale.waitlistOpen) {
      throw new Error('The waitlist is not available for this drop.');
    }

    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_flashSaleId_email', (q) =>
        q.eq('flashSaleId', flashSale._id).eq('email', email),
      )
      .first();
    if (existing) {
      return { joined: false, alreadyJoined: true };
    }

    await ctx.db.insert('waitlist', {
      flashSaleId: flashSale._id,
      email,
      name: cleanOptionalText(args.name),
      createdAt: Date.now(),
    });

    return { joined: true, alreadyJoined: false };
  },
});

export const getWaitlist = query({
  args: { flashSaleId: v.id('flashSales') },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');
    const flashSale = await ctx.db.get(args.flashSaleId);
    if (!flashSale || flashSale.userId !== userId) {
      throw new Error('Drop not found or unauthorized');
    }

    return ctx.db
      .query('waitlist')
      .withIndex('by_flashSaleId', (q) => q.eq('flashSaleId', args.flashSaleId))
      .order('desc')
      .collect();
  },
});
