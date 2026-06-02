import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const create = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const productId = await ctx.db.insert('products', {
      userId: identity.subject,
      sellerId: identity.subject,
      name: args.name,
      price: args.price,
      description: args.description || '',
      imageUrl: args.imageUrl || '',
      url: args.sourceUrl || '',
      status: 'draft' as const,
      scrapeCreditsUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return productId;
  },
});

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sellerId = identity.subject;

    const bySeller = await ctx.db
      .query('products')
      .withIndex('by_sellerId', (q) => q.eq('sellerId', sellerId))
      .collect();

    if (bySeller.length > 0) return bySeller;

    return await ctx.db
      .query('products')
      .withIndex('by_userId', (q) => q.eq('userId', sellerId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('products') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const product = await ctx.db.get(args.id);
    if (!product) return null;

    if (product.sellerId && product.sellerId !== identity.subject) return null;
    if (!product.sellerId && product.userId !== identity.subject) return null;

    return product;
  },
});
