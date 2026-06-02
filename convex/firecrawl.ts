import Firecrawl from '@mendable/firecrawl-js';
import { v } from 'convex/values';
import type { ActionCtx } from './_generated/server';
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { authComponent } from './auth';

const FREE_SCRAPE_LIMIT = 3;
const FIRECRAWL_CREDIT_FEATURE_ID = 'scrape_credits';

function getFirecrawlApiKey(): string {
  return process.env.FIRECRAWL_API_KEY ?? '';
}

function getNotConfiguredError(url: string) {
  return {
    success: false as const,
    url,
    error:
      'Firecrawl API key is not configured. Set FIRECRAWL_API_KEY in your Convex environment variables to enable Firecrawl web scraping. See docs/FIRECRAWL_SETUP.md for setup instructions.',
    markdown: null,
    json: null,
  };
}

export const isFirecrawlConfigured = action({
  args: {},
  handler: async (_ctx: ActionCtx) => {
    const apiKey = getFirecrawlApiKey();
    return {
      configured: apiKey.length > 0,
    };
  },
});

export const extractWithFirecrawl = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx: ActionCtx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error('Authentication required');
    }

    const sellerId = authUser._id.toString();

    const apiKey = getFirecrawlApiKey();
    if (!apiKey || apiKey.length === 0) {
      return getNotConfiguredError(args.url);
    }

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', sellerId))
      .first();

    if (!profile) {
      throw new Error('User profile not found. Please contact support.');
    }

    const freeScrapesUsed = profile.freeScrapesUsed ?? 0;
    const isWithinFreeLimit = freeScrapesUsed < FREE_SCRAPE_LIMIT;

    if (!isWithinFreeLimit) {
      // Try Autumn paid credit check; degrade gracefully if Autumn is unconfigured
      try {
        const checkResult = await ctx.runAction(internal.autumn.checkAutumnCredits, {
          customerId: sellerId,
          featureId: FIRECRAWL_CREDIT_FEATURE_ID,
        });

        if (!checkResult.allowed) {
          return {
            success: false as const,
            url: args.url,
            error:
              'No scrape credits remaining. You have used all 3 free scrapes. Please purchase a credit pack to continue importing products.',
            upgradeRequired: true,
            markdown: null,
            json: null,
          };
        }
      } catch {
        // Autumn unavailable — degrade: free scrapes only, prevent runaway cost
        return {
          success: false as const,
          url: args.url,
          error:
            'No free scrapes remaining. Please configure billing to purchase additional scrape credits.',
          upgradeRequired: true,
          markdown: null,
          json: null,
        };
      }
    }

    let result: { markdown?: string; json?: Record<string, unknown> } | null = null;
    try {
      const firecrawl = new Firecrawl({ apiKey });
      const scrapeResult = await firecrawl.scrape(args.url, {
        formats: [
          'markdown',
          {
            type: 'json',
            schema: {},
          },
        ],
      });

      if (!scrapeResult) {
        throw new Error('No data returned from Firecrawl');
      }

      result = {
        markdown: scrapeResult.markdown || '',
        json: (scrapeResult.json as Record<string, unknown>) || null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to extract content from Firecrawl';

      if (
        errorMessage.includes('API key') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('401')
      ) {
        return getNotConfiguredError(args.url);
      }

      throw new Error(errorMessage);
    }

    if (isWithinFreeLimit) {
      await ctx.runMutation(internal.userProfiles.bumpFreeScrapes, {
        userId: sellerId,
      });
    }

    return {
      success: true as const,
      url: args.url,
      markdown: result.markdown || '',
      json: result.json,
    };
  },
});
