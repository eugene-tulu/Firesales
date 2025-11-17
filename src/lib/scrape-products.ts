import { createServerFn } from '@tanstack/react-start';
import { scrapeProduct } from '~/lib/firecrawl';

export const $scrapeProduct = createServerFn({ method: 'POST' })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }: { data: { url: string } }) => {
    const product = await scrapeProduct(data.url);
    return product;
  });
