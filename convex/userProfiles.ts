import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';

export const createUserProfileIfNotExists = mutation({
  args: {
    userId: v.string(),
    role: v.optional(v.union(v.literal('user'), v.literal('admin'))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (existing) return existing._id;

    const id = await ctx.db.insert('userProfiles', {
      userId: args.userId,
      role: args.role || 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.dashboardStats.adjustUserCounts, {
      totalDelta: 1,
    });

    return id;
  },
});
