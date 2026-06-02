import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';

export const createUserProfileIfNotExists = mutation({
  args: {
    userId: v.string(),
    role: v.optional(v.union(v.literal('seller'), v.literal('platform_admin'))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (existing) return existing._id;

    const id = await ctx.db.insert('userProfiles', {
      userId: args.userId,
      role: args.role || 'seller',
      dodoConnected: false,
      freeScrapesUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.dashboardStats.adjustUserCounts, {
      totalDelta: 1,
    });

    return id;
  },
});

export const bumpFreeScrapes = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (!profile) return null;

    await ctx.db.patch(profile._id, {
      freeScrapesUsed: (profile.freeScrapesUsed ?? 0) + 1,
      updatedAt: Date.now(),
    });

    return { freeScrapesUsed: (profile.freeScrapesUsed ?? 0) + 1 };
  },
});
