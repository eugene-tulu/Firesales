import { v, ConvexError } from 'convex/values';
import {
  type BetterAuthAdapterUserDoc,
  normalizeAdapterFindManyResult,
} from '../src/lib/server/better-auth/adapter-utils';
import { assertUserId } from '../src/lib/shared/user-id';
import { api, components, internal } from './_generated/api';
import { action, internalQuery, mutation, query } from './_generated/server';
import { authComponent } from './auth';
import { guarded } from './authz/guardFactory';

/**
 * Check if there are any users in the system (for determining first admin)
 * Queries Better Auth's user table directly for accurate count.
 *
 * Intentionally left unguarded so bootstrap flows and health checks can run
 * before an authenticated session exists.
 */
export const getUserCount = query({
  args: {},
  handler: async (ctx) => {
    // Use Better Auth component's findMany query to get all users
    let allUsers: BetterAuthAdapterUserDoc[] = [];
    try {
      // Query all users using component's findMany query
      const rawResult: unknown = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'user',
        paginationOpts: {
          cursor: null,
          numItems: 1000, // Get all users (assuming less than 1000 for user count)
          id: 0,
        },
      });

      const normalized = normalizeAdapterFindManyResult<BetterAuthAdapterUserDoc>(rawResult);
      allUsers = normalized.page;
    } catch (error) {
      console.error('Failed to query Better Auth users:', error);
      allUsers = [];
    }

    const totalUsers = allUsers.length;
    const isFirstUser = totalUsers === 0;

    return {
      totalUsers,
      isFirstUser,
    };
  },
});

/**
 * Create or update a user profile with role
 * This stores app-specific user data separate from Better Auth's user table
 */
export const setUserRole = guarded.mutation(
  'user.bootstrap', // Public capability but with strict bootstrap logic
  {
    userId: v.string(), // Better Auth user ID
    role: v.union(v.literal('seller'), v.literal('platform_admin')), // Enforced enum
    allowBootstrap: v.optional(v.boolean()), // Special flag for first user signup
  },
  async (ctx, args, role) => {
    // Role validation is now handled by the Convex schema enum

    // Check if this is a bootstrap operation (first user creation)
    // Allow bootstrap without admin authentication for initial setup
    if (!args.allowBootstrap) {
      // For non-bootstrap operations, ensure caller has admin role
      if (role !== 'admin') {
        throw new Error('Admin privileges required for role management');
      }
    } else {
      // BOOTSTRAP: Allow only when no other user profiles exist (idempotent for the same user)
      const existingProfiles = await ctx.db.query('userProfiles').collect();
      const nonBootstrapProfile = existingProfiles.find(
        (profile) => profile.userId !== args.userId,
      );

      if (nonBootstrapProfile) {
        throw new Error('Bootstrap not allowed - another user profile already exists');
      }
    }

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    const now = Date.now();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        role: args.role,
        updatedAt: now,
      });
    } else {
      // Create new profile
      await ctx.db.insert('userProfiles', {
        userId: args.userId,
        role: args.role,
        dodoConnected: false,
        freeScrapesUsed: 0,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.runMutation(internal.dashboardStats.adjustUserCounts, {
        totalDelta: 1,
      });
    }

    return { success: true };
  },
);

/**
 * Update current user's profile (name, phoneNumber)
 * Uses Better Auth component adapter's updateMany mutation
 * Only allows users to update their own profile.
 *
 * Authorization is enforced by Better Auth's `getAuthUser`, so this remains a
 * plain mutation rather than `guarded.mutation('profile.write', ...)`.
 *
 * Includes optimistic locking to prevent lost updates.
 */
export const updateCurrentUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    // Client must provide the updatedAt they last saw for optimistic concurrency control
    lastKnownUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current user
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const userId = assertUserId(authUser, 'User ID not found in auth user');

    // Find current profile
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first();

    if (!profile) {
      throw new ConvexError('Profile not found');
    }

    // Optimistic concurrency check
    if (profile.updatedAt !== args.lastKnownUpdatedAt) {
      throw new ConvexError(
        'Profile was modified by another process. Please refresh and try again.',
      );
    }

    // Build update object
    const updateData: {
      name?: string;
      phoneNumber?: string | null;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updateData.name = args.name.trim();
    }

    if (args.phoneNumber !== undefined) {
      updateData.phoneNumber = args.phoneNumber || null;
    }

    // Perform update with optimistic lock
    await ctx.db.patch(profile._id, updateData);

    return { success: true };
  },
});

/**
 * Get user profile by user ID
 * Internal-only so profiles can't be fetched directly from clients
 */
export const getUserProfile = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
  },
});

/**
 * Get current user profile (Better Auth user data + app-specific role).
 * Returns `null` for unauthenticated callers so client hooks can handle the
 * signed-out state without throwing.
 */
export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    // Get Better Auth user via authComponent
    let authUser: unknown;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      // Better Auth throws "Unauthenticated" error when session is invalid
      // Return null to allow conditional usage in useAuth hook
      return null;
    }

    if (!authUser) {
      // Return null instead of throwing to allow conditional usage in useAuth hook
      return null;
    }

    // Better Auth Convex adapter returns the Convex document with _id
    const userId = assertUserId(authUser, 'User ID not found in auth user');

    // Get role from userProfiles - this is a fast indexed query
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first();

    // Convert Better Auth timestamps (ISO strings or numbers) to Unix timestamps
    const authUserTyped = authUser as {
      createdAt?: string | number;
      updatedAt?: string | number;
      email?: string;
      name?: string;
      phoneNumber?: string;
      emailVerified?: boolean;
    };
    const createdAt = authUserTyped.createdAt
      ? typeof authUserTyped.createdAt === 'string'
        ? new Date(authUserTyped.createdAt).getTime()
        : authUserTyped.createdAt
      : Date.now();
    const updatedAt = authUserTyped.updatedAt
      ? typeof authUserTyped.updatedAt === 'string'
        ? new Date(authUserTyped.updatedAt).getTime()
        : authUserTyped.updatedAt
      : Date.now();

    return {
      id: userId, // Better Auth user ID
      email: authUserTyped.email || '',
      name: authUserTyped.name || null,
      phoneNumber: authUserTyped.phoneNumber || null,
      role: profile?.role || 'seller', // Default to 'seller' if no profile exists yet
      emailVerified: authUserTyped.emailVerified || false,
      createdAt,
      updatedAt,
    };
  },
});

/**
 * Get or create user profile with invariant enforcement.
 * Guarantees: profile always exists for authenticated user.
 * Uses existing queries/mutations to avoid direct DB access.
 *
 * This is an action because it may create a profile (write side-effect).
 * Prefer this when you require the profile to exist (e.g., during checkout).
 */
export const getOrCreateProfile = action({
  args: {},
  handler: async (ctx: any, _args: any): Promise<any> => {
    // Get current user via auth
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      return null;
    }
    const userId = assertUserId(authUser, 'User ID not found');

    // Check if profile already exists (reuse existing query)
    const existing = await ctx.runQuery(api.users.getCurrentUserProfile, {});
    if (existing) {
      return existing;
    }

    // Profile missing — create it
    // Determine role based on first user
    const userCountResult = await ctx.runQuery(api.users.getUserCount, {});
    const isFirstUser = userCountResult.isFirstUser;
    const role = isFirstUser ? 'platform_admin' : 'seller';

    // Create profile (idempotent via existing check inside mutation)
    await ctx.runMutation(api.userProfiles.createUserProfileIfNotExists, {
      userId,
      role,
    });

    // Fetch the newly created profile
    const profile = await ctx.runQuery(api.users.getCurrentUserProfile, {});
    if (!profile) {
      throw new ConvexError('Failed to create user profile');
    }

    return profile;
  },
});

/**
 * Update user role (for admin operations)
 * SECURITY: Requires authenticated admin caller
 */
export const updateUserRole = guarded.mutation(
  'user.write',
  {
    userId: v.string(),
    role: v.union(v.literal('seller'), v.literal('platform_admin')), // Enforced enum
  },
  async (ctx, args, _role) => {
    // Role validation is now handled by the Convex schema enum

    // Update role in userProfiles
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q: any) => q.eq('userId', args.userId))
      .first();

    if (!profile) {
      throw new Error('User profile not found');
    }

    await ctx.db.patch(profile._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
);
