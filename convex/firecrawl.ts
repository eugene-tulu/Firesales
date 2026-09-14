import Firecrawl from '@mendable/firecrawl-js';
import { v } from 'convex/values';
import { assertUserId } from '../src/lib/shared/user-id';
import { internal } from './_generated/api';
import { action, internalMutation, internalQuery } from './_generated/server';
import { authComponent } from './auth';

const FREE_RESEARCH_LIMIT = 3;

type SourceFacts = {
  chefName?: string;
  cuisine?: string;
  location?: string;
  menuName?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  pickupDetails?: string;
};

type ChefSourceResearchResult =
  | {
      success: false;
      error: string;
      upgradeRequired?: true;
    }
  | {
      success: true;
      facts: SourceFacts;
      sourceUrl: string;
      sourceExcerpt: string;
      remainingFreeImports: number;
    };

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asPrice(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export const getResearchAllowance = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
    return { used: profile?.freeScrapesUsed ?? 0, profileExists: Boolean(profile) };
  },
});

export const recordResearchUse = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
    if (!profile) return null;
    const freeScrapesUsed = (profile.freeScrapesUsed ?? 0) + 1;
    await ctx.db.patch(profile._id, { freeScrapesUsed, updatedAt: Date.now() });
    return freeScrapesUsed;
  },
});

export const isFirecrawlConfigured = action({
  args: {},
  handler: async () => ({ configured: Boolean(process.env.FIRECRAWL_API_KEY) }),
});

/**
 * Imports public facts from a chef's own menu, booking, venue, or social-link
 * page. The result is deliberately a draft: the chef reviews every detail
 * before it becomes a public drop.
 */
export const researchChefSource = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<ChefSourceResearchResult> => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId = assertUserId(authUser, 'Authentication required');

    let url: URL;
    try {
      url = new URL(args.url);
    } catch {
      throw new Error('Enter a valid public URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only public HTTP(S) URLs can be imported.');
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return {
        success: false as const,
        error: 'Firecrawl is not configured yet. Add FIRECRAWL_API_KEY to enable source research.',
      };
    }

    const allowance = await ctx.runQuery(internal.firecrawl.getResearchAllowance, { userId });
    if (allowance.used >= FREE_RESEARCH_LIMIT) {
      return {
        success: false as const,
        error:
          'You have used your three complimentary source imports. You can still create a drop manually.',
        upgradeRequired: true as const,
      };
    }

    try {
      const firecrawl = new Firecrawl({ apiKey });
      const result = (await firecrawl.scrape(url.toString(), {
        formats: [
          'markdown',
          {
            type: 'json',
            schema: {
              type: 'object',
              properties: {
                chefName: { type: 'string' },
                cuisine: { type: 'string' },
                location: { type: 'string' },
                menuName: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                imageUrl: { type: 'string' },
                pickupDetails: { type: 'string' },
              },
            },
          },
        ],
      })) as { markdown?: string; json?: Record<string, unknown> };

      const source = result.json ?? {};
      const facts: SourceFacts = {
        chefName: asText(source.chefName),
        cuisine: asText(source.cuisine),
        location: asText(source.location),
        menuName: asText(source.menuName),
        description: asText(source.description),
        price: asPrice(source.price),
        imageUrl: asText(source.imageUrl),
        pickupDetails: asText(source.pickupDetails),
      };

      await ctx.runMutation(internal.firecrawl.recordResearchUse, { userId });
      return {
        success: true as const,
        facts,
        sourceUrl: url.toString(),
        sourceExcerpt: (result.markdown || '').slice(0, 1_200),
        remainingFreeImports: Math.max(0, FREE_RESEARCH_LIMIT - allowance.used - 1),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import that source.';
      throw new Error(message);
    }
  },
});
