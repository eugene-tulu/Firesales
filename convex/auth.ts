import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { dodopayments, portal } from '@dodopayments/better-auth';
import { betterAuth } from 'better-auth';
import { v } from 'convex/values';
import { DodoPayments } from 'dodopayments';
import { getBetterAuthSecret, getSiteUrl } from '../src/lib/server/env.server';
import { api, components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { action, mutation, query } from './_generated/server';
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
  const plugins = [
    convex({ authConfig }),
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
      throw new Error('Unauthorized rate limit access');
    }

    const { token: _token, ...rateLimitArgs } = args;
    try {
      return await ctx.runMutation(components.rateLimiter.lib.rateLimit, rateLimitArgs as any);
    } catch (error) {
      console.error('Rate limit action failed:', error);
      return { ok: true, retryAfter: 0 };
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
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const authUser = await authComponent.getAuthUser(ctx);
        if (authUser) {
          const typed = authUser as { id?: string; _id?: string } | undefined;
          const userId = typed?.id || typed?._id;
          if (!userId) {
            throw new Error('User ID not found');
          }

          const existingProfile = await ctx.runQuery(api.users.getCurrentUserProfile);
          if (existingProfile) {
            return { success: true, message: 'Profile already exists' };
          }

          const userCountResult = await ctx.runQuery(api.users.getUserCount, {});
          const isFirstUser = userCountResult.isFirstUser;

          await ctx.runMutation(api.userProfiles.createUserProfileIfNotExists, {
            userId,
            role: isFirstUser ? 'admin' : 'user',
          });

          return { success: true, message: 'Profile created successfully' };
        }
      } catch (error) {
        if (attempt === 4) {
          console.error('Failed to create profile after multiple attempts:', error);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }

    throw new Error('Not authenticated after multiple attempts');
  },
});
