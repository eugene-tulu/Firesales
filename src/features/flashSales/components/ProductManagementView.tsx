import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { DeleteActionButton, EditActionButton } from '../../../components/data-table/ActionButtons';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { scrapeProduct } from '../../../lib/firecrawl';
import { FirecrawlForm } from '../../ai/components/FirecrawlForm';
import { useAiUsageStatus } from '../../ai/hooks/useAiUsageStatus';
import { useFirecrawlForm } from '../../ai/hooks/useFirecrawlForm';
import { useAuth } from '../../auth/hooks/useAuth';
import { ProductManagementTable } from './ProductManagementTable';

export interface Product {
  _id: Id<'products'>;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  url: string;
  status: 'draft' | 'active' | 'paused' | 'sold_out' | 'ended';
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export function ProductManagementView() {
  const { isAuthenticated } = useAuth();
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    sourceUrl: '',
  });
  const [isImporting, setIsImporting] = useState(false);

  // Get user's products
  const userProducts = useQuery(api.products.list);

  // Mutations
  const createProduct = useMutation(api.products.create);
  const initializeInventory = useMutation(api.inventory.initialize);

  // AI usage status for Firecrawl
  const { status: aiStatus, isInitialSubscriptionLoad, refresh } = useAiUsageStatus();

  const handleFirecrawlSubmit = async ({ url }: { url: string }) => {
    setIsImporting(true);
    try {
      // Scrape product information from the URL
      const scrapedData = await scrapeProduct(url);

      // Update the form with scraped data
      setNewProduct({
        name: scrapedData.name,
        description: scrapedData.description || '',
        price: scrapedData.price,
        imageUrl: scrapedData.imageUrl || '',
        sourceUrl: url,
      });
    } catch (error) {
      console.error('Error scraping product:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const { handleSubmit: handleFirecrawlFormSubmit } = useFirecrawlForm({
    checkFirecrawlConfigured: async () => {
      // This would check if Firecrawl is configured
      return { configured: true };
    },
    setFirecrawlConfigured: () => {},
    setResults: () => {},
    setLoading: () => {},
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productId = await createProduct({
        name: newProduct.name,
        price: newProduct.price,
        description: newProduct.description,
        imageUrl: newProduct.imageUrl,
        sourceUrl: newProduct.sourceUrl,
      });

      // Initialize inventory for the new product (assuming total units from form)
      await initializeInventory({
        productId,
        totalUnits: 100, // Default to 100 units, this should come from form in real implementation
      });

      // Reset form
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        imageUrl: '',
        sourceUrl: '',
      });

      // In a real implementation, we would refresh the query or update the local state
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to manage products</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Product</CardTitle>
            <CardDescription>Add a new product to your inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Enter product description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  value={newProduct.imageUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <Button type="submit" className="w-full">
                Create Product
              </Button>
            </form>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Import Product from URL</h3>
              <FirecrawlForm
                onSubmit={handleFirecrawlFormSubmit}
                apiKeyMissing={!aiStatus?.authenticated || !aiStatus.subscription.configured}
                isSubmitting={isImporting}
                usageDetails={
                  aiStatus?.authenticated
                    ? {
                        freeLimit: aiStatus.usage.freeLimit,
                        freeMessagesRemaining: aiStatus.usage.freeMessagesRemaining,
                      }
                    : null
                }
                subscriptionDetails={
                  aiStatus?.authenticated
                    ? {
                        status: aiStatus.subscription.status,
                        isUnlimited: aiStatus.subscription.isUnlimited,
                        creditBalance: aiStatus.subscription.creditBalance,
                      }
                    : null
                }
                isInitialSubscriptionLoad={isInitialSubscriptionLoad}
                onRefreshUsage={refresh}
              />
            </div>
          </CardContent>
        </Card>

        {/* Product List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Products</CardTitle>
            <CardDescription>Manage your product inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {userProducts ? (
              <ProductManagementTable
                products={userProducts}
                onEdit={(product) => console.log('Edit product:', product._id)}
                onDelete={(product) => console.log('Delete product:', product._id)}
              />
            ) : (
              <div>Loading products...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
