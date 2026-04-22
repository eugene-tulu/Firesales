import { createFileRoute, redirect } from '@tanstack/react-router';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { useAuth } from '~/features/auth/hooks/useAuth';
import { routeAuthGuard } from '~/features/auth/server/route-guards';

export const Route = createFileRoute('/app/flashSales/')({
  component: FlashSalesDashboard,
  beforeLoad: routeAuthGuard,
  loader: async ({ context: { convexQueryClient } }) => {
    const convexClient = convexQueryClient.convexClient;
    // Server-side check - redirect if not authenticated
    const session = await convexClient.query(api.auth.getCurrentUser, {});
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: '/app/flashSales' } });
    }

    // Fetch initial flash sales data for SSR/progressive enhancement
    const flashSales = await convexClient.query(api.flashSales.list, {});

    return { flashSales };
  },
});

function FlashSalesDashboard() {
  const { user } = useAuth();
  const { flashSales } = Route.useLoaderData();

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Flash Sales Dashboard</h1>
          <p className="text-muted-foreground">Manage your flash sales, products, and inventory</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>Manage your product catalog</CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/app/flashSales/products">
                <Button variant="outline" className="w-full">
                  Manage Products
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flash Sales</CardTitle>
              <CardDescription>Create and manage flash sales</CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/app/flashSales/create">
                <Button variant="outline" className="w-full">
                  Create Flash Sale
                </Button>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>Track your sales performance</CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/app/flashSales/analytics">
                <Button variant="outline" className="w-full">
                  View Analytics
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.name || user?.email}!</h2>
          <p className="mb-4">
            You're all set to start creating flash sales. Use the cards above to manage your
            products, create new flash sales, or view your sales analytics.
          </p>
          <p>
            Remember: Flash sales are limited-time events with limited inventory. Our atomic
            inventory system ensures no overselling even during high-traffic periods.
          </p>
          <p className="mt-2 text-sm">
            You have {flashSales?.length || 0} active flash sale
            {flashSales?.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    </div>
  );
}
