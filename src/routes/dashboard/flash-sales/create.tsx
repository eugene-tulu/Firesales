import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/convex/_generated/api';
import { $scrapeProduct } from '~/lib/scrape-product';

export const Route = createFileRoute('/dashboard/flash-sales/create')({
  component: CreateFlashSale,
});

function CreateFlashSale() {
  const navigate = useNavigate();
  const createProduct = useMutation(api.products.createProduct);
  const createFlashSale = useMutation(api.flashSales.create);

  const [step, setStep] = useState<'url' | 'review' | 'inventory'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [productUrl, setProductUrl] = useState('');
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [inventory, setInventory] = useState('50');

  // Step 1: Scrape product URL
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await $scrapeProduct({ data: { url: productUrl } });
      setScrapedData(data);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to scrape product');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create flash sale
  const handleCreate = async () => {
    setLoading(true);
    setError('');

    try {
      // Create product
      const productId = await createProduct({
        name: scrapedData.name,
        price: scrapedData.price * 100, // Convert to cents
        description: scrapedData.description || '',
        imageUrl: scrapedData.imageUrl || '',
        url: productUrl,
        totalUnits: parseInt(inventory),
      });

      // Create flash sale
      const result = await createFlashSale({
        productId,
        allocatedInventory: parseInt(inventory),
      });

      // Navigate to the flash sale page
      navigate({
        to: '/dashboard/flash-sales/$saleId',
        params: { saleId: result.flashSaleId },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create flash sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Flash Sale</h1>
        <p className="text-muted-foreground">
          Paste a product URL and we'll extract the details for you
        </p>
      </div>

      {/* Step 1: Enter URL */}
      {step === 'url' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Product URL</CardTitle>
            <CardDescription>
              Enter a URL from Shopify, Amazon, or any e-commerce site
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrape} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Product URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://store.com/products/item"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  required
                />
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting product info...
                  </>
                ) : (
                  'Extract Product'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Set Inventory */}
      {step === 'review' && scrapedData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Review & Set Inventory</CardTitle>
            <CardDescription>
              Confirm the product details and set how many units to sell
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Preview */}
            <div className="border rounded-lg p-4 space-y-4">
              {scrapedData.imageUrl && (
                <img
                  src={scrapedData.imageUrl}
                  alt={scrapedData.name}
                  className="w-full h-48 object-cover rounded"
                />
              )}

              <div>
                <h3 className="font-semibold text-lg">{scrapedData.name}</h3>
                <p className="text-2xl font-bold text-green-600">${scrapedData.price.toFixed(2)}</p>
                {scrapedData.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {scrapedData.description.substring(0, 200)}...
                  </p>
                )}
              </div>
            </div>

            {/* Inventory Input */}
            <div className="space-y-2">
              <Label htmlFor="inventory">Allocated Inventory</Label>
              <Input
                id="inventory"
                type="number"
                min="1"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="50"
              />
              <p className="text-sm text-muted-foreground">
                How many units do you want to sell in this flash sale?
              </p>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('url');
                  setScrapedData(null);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleCreate} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Flash Sale'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
