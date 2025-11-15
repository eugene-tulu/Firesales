import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export interface ScrapedProduct {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  try {
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              description: { type: 'string' },
              imageUrl: { type: 'string' },
              inStock: { type: 'boolean' },
            },
            required: ['name', 'price'],
          },
        },
      ],
    });

    if (!result.success || !result.data?.json) {
      throw new Error('Failed to scrape product');
    }

    return {
      name: result.data.json.name,
      price: result.data.json.price,
      description: result.data.json.description,
      imageUrl: result.data.json.imageUrl,
    };
  } catch (error) {
    console.error('Firecrawl error:', error);
    throw new Error('Failed to extract product information');
  }
}
