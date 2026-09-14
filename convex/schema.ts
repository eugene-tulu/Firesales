import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Note: Better Auth manages its own tables via the betterAuth component
  // Those tables are in the 'betterAuth' namespace (user, session, account, verification, etc.)
  // We should NOT duplicate them here. Access Better Auth users via Better Auth APIs.

  // Application-specific tables only
  // User profiles table - stores app-specific user data that references Better Auth user IDs
  userProfiles: defineTable({
    userId: v.string(),
    role: v.union(
      v.literal('seller'),
      v.literal('platform_admin'),
      v.literal('user'),
      v.literal('admin'),
    ),
    freeScrapesUsed: v.optional(v.number()),
    // Created and verified in Paystack before it is used for a chef's split.
    // The platform remains the merchant account; this is never a secret key.
    paystackSubaccountCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_role_createdAt', ['role', 'createdAt']),

  auditLogs: defineTable({
    userId: v.string(),
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

  // Chef-drop tables. "products" remains the persisted name for backwards
  // compatibility; in the product experience these are menu items.
  products: defineTable({
    sellerId: v.optional(v.string()),
    userId: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    currency: v.optional(v.string()),
    imageUrl: v.string(),
    url: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('sold_out'),
      v.literal('ended'),
    ),
    scrapeCreditsUsed: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index('by_sellerId', ['sellerId'])
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
    saleUrl: v.string(),
    status: v.union(v.literal('draft'), v.literal('live'), v.literal('completed')),
    userId: v.string(),
    dropTitle: v.optional(v.string()),
    chefNote: v.optional(v.string()),
    pickupDetails: v.optional(v.string()),
    waitlistOpen: v.optional(v.boolean()),
    totalSales: v.number(),
    totalRevenue: v.number(),
    // A realtime projection. It decreases when a plate is held, then stays
    // unchanged when that hold becomes a paid order.
    remainingInventory: v.number(),
    reservedInventory: v.optional(v.number()),
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
    flashSaleId: v.optional(v.id('flashSales')),
    userId: v.optional(v.string()), // Buyer ID (optional for anonymous reservations)
    sessionId: v.string(), // Session identifier for anonymous users
    // Durable Object reservation ID. This is intentionally separate from the
    // Convex document ID so Cloudflare owns the hot counter state.
    cloudflareReservationId: v.optional(v.string()),
    // Payment-provider neutral checkout state. A reservation is the source of
    // truth that links an external payment to a held batch of plates.
    paymentProvider: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    paymentCheckoutUrl: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    guestName: v.optional(v.string()),
    dietaryNotes: v.optional(v.string()),
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
    .index('by_flashSaleId', ['flashSaleId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status'])
    .index('by_expiresAt', ['expiresAt']),

  orders: defineTable({
    productId: v.id('products'),
    flashSaleId: v.optional(v.id('flashSales')),
    reservationId: v.optional(v.id('reservations')),
    userId: v.optional(v.string()), // Buyer ID (optional for anonymous purchases)
    sessionId: v.string(), // Session identifier for anonymous users
    paymentProvider: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    // Store provider transaction IDs as text: some providers exceed safe JS
    // integer precision for their numeric IDs.
    paymentTransactionId: v.optional(v.string()),
    guestEmail: v.optional(v.string()),
    guestName: v.optional(v.string()),
    dietaryNotes: v.optional(v.string()),
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
    .index('by_flashSaleId', ['flashSaleId'])
    .index('by_reservationId', ['reservationId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_paymentProvider_reference', ['paymentProvider', 'paymentReference'])
    .index('by_status', ['status'])
    .index('by_createdAt', ['createdAt']),

  // System status table for circuit breakers and health monitoring
  systemStatus: defineTable({
    key: v.string(),
    state: v.object({
      consecutiveFailures: v.number(),
      lastFailure: v.optional(v.number()),
      circuitOpen: v.boolean(),
    }),
    updatedAt: v.number(),
    createdAt: v.number(),
  }).index('by_key', ['key']),

  waitlist: defineTable({
    flashSaleId: v.id('flashSales'),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_flashSaleId', ['flashSaleId'])
    .index('by_flashSaleId_email', ['flashSaleId', 'email']),

  // Payment saga log for cross-system consistency and webhook idempotency.
  paymentSagaLog: defineTable({
    paymentId: v.string(), // External payment/event ID
    event: v.string(),
    payload: v.any(), // Raw event payload
    outcome: v.object({
      success: v.boolean(),
      userId: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
    processedAt: v.number(),
    createdAt: v.number(),
  }).index('by_paymentId', ['paymentId']),
});
