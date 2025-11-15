import { createServerFn } from '@tanstack/start';
import { scrapeProduct } from '~/lib/firecrawl';

export const $scrapeProduct = createServerFn({ method: 'POST' })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const product = await scrapeProduct(data.url);
    return product;
  });
