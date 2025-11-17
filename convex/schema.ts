import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Note: Better Auth manages its own tables via the betterAuth component
  // Those tables are in the 'betterAuth' namespace (user, session, account, verification, etc.)
  // We should NOT duplicate them here. Access Better Auth users via Better Auth APIs.

  // Application-specific tables only
  // User profiles table - stores app-specific user data that references Better Auth user IDs
  userProfiles: defineTable({
    userId: v.string(), // References Better Auth user.id
    role: v.union(v.literal('user'), v.literal('admin')), // Enforced enum for data integrity
    // Add other app-specific user fields here as needed
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_role_createdAt', ['role', 'createdAt']),

  auditLogs: defineTable({
    id: v.string(),
    userId: v.string(), // References Better Auth user.id
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_createdAt', ['createdAt']),

  dashboardStats: defineTable({
    key: v.string(),
    totalUsers: v.number(),
    activeUsers: v.number(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),

  // Rate limiting table - managed by @convex-dev/rate-limiter
  rateLimit: defineTable({
    identifier: v.string(),
    kind: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_identifier_kind', ['identifier', 'kind'])
    .index('by_createdAt', ['createdAt']),

  aiMessageUsage: defineTable({
    userId: v.string(),
    messagesUsed: v.number(),
    pendingMessages: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReservedAt: v.optional(v.number()),
    lastCompletedAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  aiResponses: defineTable({
    userId: v.string(),
    requestKey: v.string(),
    method: v.union(v.literal('direct'), v.literal('gateway'), v.literal('structured')),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    response: v.string(),
    rawText: v.optional(v.string()),
    structuredData: v.optional(
      v.object({
        title: v.string(),
        summary: v.string(),
        keyPoints: v.array(v.string()),
        category: v.string(),
        difficulty: v.string(),
      }),
    ),
    parseError: v.optional(v.string()),
    usage: v.optional(
      v.object({
        totalTokens: v.optional(v.number()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
      }),
    ),
    finishReason: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('complete'), v.literal('error')),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_requestKey', ['requestKey']),

  // FireSales tables
  products: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    imageUrl: v.string(),
    url: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('sold_out'),
      v.literal('ended'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_createdAt', ['createdAt'])
    .index('by_status', ['status']),

  inventory: defineTable({
    productId: v.id('products'),
    totalUnits: v.number(),
    availableUnits: v.number(),
    reservedUnits: v.number(),
    soldUnits: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_productId', ['productId'])
    .index('by_availableUnits', ['availableUnits']),

  flashSales: defineTable({
    productId: v.id('products'),
    allocatedInventory: v.number(),
    saleUrl: v.string(), // Unique URL for this flash sale
    status: v.union(v.literal('draft'), v.literal('live'), v.literal('completed')),
    userId: v.string(), // Seller ID
    totalSales: v.number(),
    totalRevenue: v.number(),
    remainingInventory: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  })
    .index('by_productId', ['productId'])
    .index('by_saleUrl', ['saleUrl'])
    .index('by_userId', ['userId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  reservations: defineTable({
    productId: v.id('products'),
    userId: v.optional(v.string()), // Buyer ID (optional for anonymous reservations)
    sessionId: v.string(), // Session identifier for anonymous users
    quantity: v.number(), // Quantity being reserved
    status: v.union(
      v.literal('reserved'),
      v.literal('confirmed'),
      v.literal('cancelled'),
      v.literal('expired'),
    ),
    expiresAt: v.number(), // Reservation expiration time
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_productId', ['productId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status'])
    .index('by_expiresAt', ['expiresAt']),

  orders: defineTable({
    productId: v.id('products'),
    userId: v.optional(v.string()), // Buyer ID (optional for anonymous purchases)
    sessionId: v.string(), // Session identifier for anonymous users
    stripeSessionId: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('cancelled'),
      v.literal('refunded'),
    ),
    amount: v.number(), // Total amount in cents
    currency: v.string(),
    quantity: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_productId', ['productId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_stripeSessionId', ['stripeSessionId'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),
});
