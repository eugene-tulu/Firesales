import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
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
import { useAuth } from '../../auth/hooks/useAuth';
import { ProductManagementTable } from './ProductManagementTable';

interface Product {
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

interface FlashSale {
  _id: Id<'flashSales'>;
  productId: Id<'products'>;
  allocatedInventory: number;
  saleUrl: string;
  status: 'draft' | 'live' | 'completed';
  userId: string;
  totalSales: number;
  totalRevenue: number;
  remainingInventory: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  endedAt?: number;
  product: Product;
}

export function FlashSaleCreation() {
  const { isAuthenticated } = useAuth();
  const [newFlashSale, setNewFlashSale] = useState({
    productId: '' as Id<'products'> | '',
    allocatedInventory: 10,
    saleUrl: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Get user's products
  const userProducts = useQuery(api.products.list);

  // Get user's flash sales
  const userFlashSales = useQuery(api.flashSales.list);

  // Mutations
  const createFlashSale = useMutation(api.flashSales.create);
  const goLive = useMutation(api.flashSales.goLive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      if (!newFlashSale.productId) {
        alert('Please select a product');
        return;
      }

      const result = await createFlashSale({
        productId: newFlashSale.productId,
        allocatedInventory: newFlashSale.allocatedInventory,
      });

      // Reset form
      setNewFlashSale({
        productId: '' as Id<'products'> | '',
        allocatedInventory: 10,
        saleUrl: '',
      });

      console.log('Flash sale created:', result);
    } catch (error) {
      console.error('Error creating flash sale:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoLive = async (flashSaleId: Id<'flashSales'>) => {
    try {
      await goLive({ flashSaleId });
      console.log('Flash sale is now live');
    } catch (error) {
      console.error('Error going live:', error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to create flash sales</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Flash Sale Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Flash Sale</CardTitle>
            <CardDescription>Set up a limited-time sale event for your products</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Select Product</Label>
                <select
                  id="product"
                  value={(newFlashSale.productId as string) || ''}
                  onChange={(e) =>
                    setNewFlashSale({
                      ...newFlashSale,
                      productId: (e.target.value as Id<'products'>) || '',
                    })
                  }
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Select a product</option>
                  {userProducts?.map((product) => (
                    <option key={product._id.toString()} value={product._id.toString()}>
                      {product.name} - ${product.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocatedInventory">Allocated Inventory</Label>
                <Input
                  id="allocatedInventory"
                  type="number"
                  min="1"
                  value={newFlashSale.allocatedInventory}
                  onChange={(e) =>
                    setNewFlashSale({
                      ...newFlashSale,
                      allocatedInventory: parseInt(e.target.value) || 10,
                    })
                  }
                  placeholder="Number of items to sell"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Flash Sale'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Flash Sales List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Flash Sales</CardTitle>
            <CardDescription>Manage your active and past flash sales</CardDescription>
          </CardHeader>
          <CardContent>
            {userFlashSales ? (
              <div className="space-y-4">
                {userFlashSales.map((flashSale) => (
                  <div key={flashSale._id.toString()} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{flashSale.product.name}</h3>
                        <p className="text-sm text-gray-500">
                          {flashSale.status} | {flashSale.remainingInventory} of{' '}
                          {flashSale.allocatedInventory} remaining
                        </p>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(flashSale.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {flashSale.status === 'draft' && (
                          <Button
                            onClick={() => handleGoLive(flashSale._id)}
                            variant="default"
                            size="sm"
                          >
                            Go Live
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                              navigator.clipboard.writeText(
                                `${window.location.origin}/live/${flashSale.saleUrl}`,
                            )
                          }
                        >
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {userFlashSales.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No flash sales found. Create your first flash sale to get started.
                  </div>
                )}
              </div>
            ) : (
              <div>Loading flash sales...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
