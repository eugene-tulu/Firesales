import { api } from '@convex/_generated/api';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Package, DollarSign } from 'lucide-react';
import { PageHeader } from '~/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { useAuth } from '~/features/auth/hooks/useAuth';
import { routeAuthGuard } from '~/features/auth/server/route-guards';

export const Route = createFileRoute('/app/flashSales/products')({
  component: ProductsPage,
  beforeLoad: routeAuthGuard,
});

function ProductsPage() {
  const { user } = useAuth();

  const productsQuery = useQuery(api.products.list, {});
  const isLoading = productsQuery === undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Products" description="Manage your product catalog" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Products" description="Manage your product catalog and inventory" />

      {productsQuery?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Products Yet</CardTitle>
            <CardDescription>
              Create your first product by scraping a URL from an e-commerce site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/dashboard/flash-sales/create">
              <Button>Create Product</Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productsQuery?.map((product) => (
            <Card key={product._id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-2">{product.name}</CardTitle>
                    <CardDescription>
                      {new Date(product.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      product.status === 'active'
                        ? 'default'
                        : product.status === 'draft'
                          ? 'secondary'
                          : product.status === 'paused'
                            ? 'outline'
                            : 'destructive'
                    }
                  >
                    {product.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-md"
                  />
                )}
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Price</div>
                      <div className="font-semibold">${(product.price / 100).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
                {product.url && (
                  <div className="text-xs text-muted-foreground truncate">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Source ↗
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
