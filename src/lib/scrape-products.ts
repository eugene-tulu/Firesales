import { createServerFn } from '@tanstack/react-start';
import { api } from '@convex/_generated/api';

export const $scrapeProduct = createServerFn({ method: 'POST' })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }: { data: { url: string } }) => {
    const result = await api.firecrawl.extractWithFirecrawl({ url: data.url });
    if (!result.success || !result.json) {
      throw new Error('Failed to scrape product');
    }
    return {
      name: result.json.name,
      price: result.json.price,
      description: result.json.description,
      imageUrl: result.json.imageUrl,
    };
  });
