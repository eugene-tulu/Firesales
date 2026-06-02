import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { dodopayments, portal } from '@dodopayments/better-auth';
import { betterAuth } from 'better-auth';
import { v, ConvexError } from 'convex/values';
import { DodoPayments } from 'dodopayments';
import { getBetterAuthSecret, getSiteUrl } from '../src/lib/server/env.server';
import type { UserId } from '../src/lib/shared/user-id';
import { api, components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { action, internalAction, mutation, query } from './_generated/server';
import authConfig from './auth.config';

const siteUrl = getSiteUrl();
const secret = getBetterAuthSecret(); // Required — throws if not set

// Initialize Dodo Payments client (optional for development)
const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY;
const dodoEnvironment =
  (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode';

// Create a Dodo Payments client (real or mock)
export const dodoPayments: any = dodoApiKey
  ? new DodoPayments({
      bearerToken: dodoApiKey,
      environment: dodoEnvironment,
    })
  : {
      checkoutSessions: {
        create: async (params: any) => {
          console.warn('Mock Dodo: checkoutSessions.create called with', params);
          return {
            checkout_url: 'https://example.com/checkout/mock',
            session_id: 'mock-session-id',
          };
        },
      },
      portal: () => ({}),
    };

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: any, { optionsOnly } = { optionsOnly: false }) => {
  console.log('[createAuth] siteUrl:', siteUrl);
  const plugins = [
    convex({
      authConfig,
    }),
    ...(dodoApiKey
      ? [
          dodopayments({
            client: dodoPayments,
            createCustomerOnSignUp: true,
            use: [
              // Checkout plugin disabled - using custom checkout sessions for flash sales
              // Portal plugin available for customer self-service
              portal(),
              // Webhook plugin will be configured separately in Convex HTTP handler
            ],
          }),
        ]
      : []),
    // Note: tanstackStartCookies() is not used in Convex functions.
    // Cookie handling for TanStack Start is done via convexBetterAuthReactStart in src/lib/auth-server.ts
  ];

  return betterAuth({
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    secret,
    rateLimit: {
      window: 60 * 60,
      max: 100,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      sendResetPassword: async ({ user, url, token }) => {
        const ctxWithRunMutation = ctx as any & {
          runMutation?: (
            fn: unknown,
            args: unknown,
          ) => Promise<{ ok: boolean; retryAfter?: number }>;
        };

        if (!ctxWithRunMutation.runMutation) {
          throw new Error('Rate limiter mutation unavailable in current context');
        }

        // FIXED: Use IP-based rate limiting instead of email-based to prevent DoS
        const rateLimitKey = `passwordReset:${ctxWithRunMutation.request?.ip || 'unknown'}`;
        const rateLimitResult = await ctxWithRunMutation.runMutation(
          components.rateLimiter.lib.rateLimit,
          {
            name: 'passwordReset',
            key: rateLimitKey,
            config: {
              kind: 'token bucket',
              rate: 3,
              period: 60 * 60 * 1000,
              capacity: 3,
            },
          },
        );

        // Also apply account-based rate limiting (if user exists)
        if (user) {
          const accountRateLimitKey = `passwordReset:account:${user.id}`;
          await ctxWithRunMutation.runMutation(components.rateLimiter.lib.rateLimit, {
            name: 'passwordReset',
            key: accountRateLimitKey,
            config: {
              kind: 'token bucket',
              rate: 3,
              period: 60 * 60 * 1000,
              capacity: 3,
            },
          });
        }

        if (!rateLimitResult.ok) {
          throw new Error(
            `Rate limit exceeded. Too many password reset requests. Please try again in ${Math.ceil(
              (rateLimitResult.retryAfter ?? 0) / (60 * 1000),
            )} minutes.`,
          );
        }

        const ctxWithScheduler = ctx as any & {
          scheduler?: {
            runAfter: (delay: number, fn: unknown, args: unknown) => Promise<void>;
          };
        };
        if (ctxWithScheduler.scheduler) {
          await ctxWithScheduler.scheduler.runAfter(
            0,
            internal.emails.sendPasswordResetEmailMutation,
            {
              user: {
                id: user.id,
                email: user.email,
                name: user.name || null,
              },
              url,
              token,
            },
          );
        } else {
          throw new Error('Cannot send email: scheduler not available');
        }
      },
    },
    user: {
      additionalFields: {
        phoneNumber: {
          type: 'string',
          required: false,
        },
      },
    },
    plugins,
    database: authComponent.adapter(ctx),
  });
};

const internalRateLimitToken = process.env.BETTER_AUTH_SECRET;
if (!internalRateLimitToken) {
  throw new Error('BETTER_AUTH_SECRET environment variable is required');
}

// Circuit breaker key for rate limiter
const RATE_LIMITER_BREAKER_KEY = 'rate_limiter_breaker';

// Circuit breaker state management
async function getBreakerState(ctx: any) {
  const doc = await ctx.db
    .query('systemStatus')
    .withIndex('by_key', (q: any) => q.eq('key', RATE_LIMITER_BREAKER_KEY))
    .first();

  if (doc) {
    return doc.state;
  }

  return {
    consecutiveFailures: 0,
    lastFailure: null,
    circuitOpen: false,
  };
}

async function updateBreakerState(
  ctx: any,
  updates: { consecutiveFailures: number; lastFailure: number | null; circuitOpen: boolean },
) {
  await ctx.db.upsert(
    'systemStatus',
    { key: RATE_LIMITER_BREAKER_KEY },
    {
      state: updates,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
  );
}

async function resetBreakerState(ctx: any) {
  await updateBreakerState(ctx, {
    consecutiveFailures: 0,
    lastFailure: null,
    circuitOpen: false,
  });
}

// Action wrapper for rate limiting
export const rateLimitAction = action({
  args: {
    token: v.string(),
    name: v.string(),
    key: v.string(),
    config: v.union(
      v.object({
        kind: v.literal('token bucket'),
        rate: v.number(),
        period: v.number(),
        capacity: v.number(),
      }),
      v.object({
        kind: v.literal('fixed window'),
        rate: v.number(),
        period: v.number(),
        capacity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.token !== internalRateLimitToken) {
      throw new ConvexError('Unauthorized rate limit access');
    }

    // Circuit breaker check
    const breaker = await getBreakerState(ctx);
    const now = Date.now();
    const BREAKER_THRESHOLD = 5; // failures before opening
    const BREAKER_TIMEOUT = 30_000; // 30 seconds

    if (breaker.circuitOpen) {
      if (breaker.lastFailure && now - breaker.lastFailure < BREAKER_TIMEOUT) {
        // Circuit is open — fail closed
        throw new ConvexError('Rate limiting service temporarily unavailable');
      }
      // Half-open: allow one attempt to test recovery, reset state
      await resetBreakerState(ctx);
    }

    const { token: _token, ...rateLimitArgs } = args;
    try {
      const result = await ctx.runMutation(
        components.rateLimiter.lib.rateLimit,
        rateLimitArgs as any,
      );

      // Success — reset breaker
      await resetBreakerState(ctx);
      return result;
    } catch (error) {
      // Record failure
      const failures = breaker.consecutiveFailures + 1;
      await updateBreakerState(ctx, {
        consecutiveFailures: failures,
        lastFailure: now,
        circuitOpen: failures >= BREAKER_THRESHOLD,
      });

      console.error('[RATE_LIMIT_FAIL]', {
        error,
        failures,
        circuitOpen: failures >= BREAKER_THRESHOLD,
      });

      // Fail-closed — never bypass rate limiting due to errors
      throw new ConvexError('Rate limiting service temporarily unavailable');
    }
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await authComponent.getAuthUser(ctx);
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  },
});

// Create user profile after signup
export const createProfileAfterSignup = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Unauthenticated');
    }

    const userId = identity.subject.split('|')[0] as UserId;

    const existingProfile = await ctx.runQuery(api.users.getCurrentUserProfile);
    if (existingProfile) {
      return { success: true, message: 'Profile already exists' };
    }

    const userCountResult = await ctx.runQuery(api.users.getUserCount, {});
    const isFirstUser = userCountResult.isFirstUser;

    await ctx.runMutation(api.userProfiles.createUserProfileIfNotExists, {
      userId,
      role: isFirstUser ? 'platform_admin' : 'seller',
    });

    return { success: true, message: 'Profile created successfully' };
  },
});

// Get latest JWKS for token signing key rotation
export const getLatestJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    return await auth.api.getLatestJwks();
  },
});
