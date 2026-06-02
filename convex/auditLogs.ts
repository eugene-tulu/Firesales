import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

export const create = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditLogs', {
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      createdAt: args.createdAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
  },
});
