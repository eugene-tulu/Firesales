import { api } from '@convex/_generated/api';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { format } from 'date-fns';
import { Package, DollarSign, Calendar, Clock } from 'lucide-react';
import { PageHeader } from '~/components/PageHeader';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { Skeleton } from '~/components/ui/skeleton';
import { useAuth } from '~/features/auth/hooks/useAuth';

export const Route = createFileRoute('/app/orders')({
  component: OrdersPage,
  errorComponent: AdminErrorBoundary,
});

function OrdersPage() {
  const { user } = useAuth();

  const ordersQuery = useQuery(api.orders.listByUser, {});
  const isLoading = ordersQuery === undefined;

  // Group orders by date for display
  const groupedOrders =
    ordersQuery?.reduce(
      (groups, order) => {
        const date = new Date(order.createdAt).toLocaleDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(order);
        return groups;
      },
      {} as Record<string, typeof ordersQuery>,
    ) || {};

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      case 'refunded':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Orders" description="View and manage your flash sale orders" />

      {isLoading ? (
        <div className="space-y-4">
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
      ) : ordersQuery?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Orders Yet</CardTitle>
            <CardDescription>
              You haven't placed any orders yet. Browse flash sales to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/app/flashSales">
              <button
                type="button"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
              >
                View Flash Sales
              </button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>
                {ordersQuery?.length} order{ordersQuery?.length !== 1 ? 's' : ''} placed
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([date, dayOrders]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                </div>
                <div className="space-y-4">
                  {dayOrders.map((order) => (
                    <Card key={order._id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Order #{order._id.toString().slice(-8).toUpperCase()}
                            </CardTitle>
                            <CardDescription>
                              {order.productId ? (
                                <a
                                  href={`/dashboard/flash-sales/${order.productId}`}
                                  className="hover:underline"
                                >
                                  View Product
                                </a>
                              ) : (
                                'Unknown product'
                              )}
                            </CardDescription>
                          </div>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {order.status.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Quantity</div>
                            <div className="font-semibold">{order.quantity}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Amount</div>
                            <div className="font-semibold">${(order.amount / 100).toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Currency</div>
                            <div className="font-semibold uppercase">{order.currency}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Status</div>
                            <div className="font-semibold capitalize">{order.status}</div>
                          </div>
                        </div>

                        {order.dodoPaymentId && (
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            Payment ID: {order.dodoPaymentId}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created: {format(new Date(order.createdAt), 'PPpp')}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
