import { api } from '@convex/_generated/api';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { useState } from 'react';
import { Calendar, TrendingUp, DollarSign, Package } from 'lucide-react';
import { PageHeader } from '~/components/PageHeader';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export const Route = createFileRoute('/app/flashSales/analytics')({
  component: FlashSalesAnalytics,
  errorComponent: AdminErrorBoundary,
});

type TimeRange = '7d' | '30d' | '90d' | 'all';

function FlashSalesAnalytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const flashSales = useQuery(api.flashSales.list, {});
  const stats = useQuery(api.admin.getSystemStats, {});

  // Calculate aggregated stats
  const totalRevenue = flashSales?.reduce((sum, sale) => sum + sale.totalRevenue, 0) || 0;
  const totalSales = flashSales?.reduce((sum, sale) => sum + sale.totalSales, 0) || 0;
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const activeSales = flashSales?.filter((s) => s.status === 'live').length || 0;
  const completedSales = flashSales?.filter((s) => s.status === 'completed').length || 0;

  // Group by status
  const salesByStatus = {
    draft: flashSales?.filter((s) => s.status === 'draft').length || 0,
    live: activeSales,
    completed: completedSales,
  };

  // Top performing flash sales by revenue
  const topSales = flashSales
    ? [...flashSales].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flash Sales Analytics"
        description="Track performance and revenue across your flash sales"
      >
        <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From {totalSales} total sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">Units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSales}</div>
            <p className="text-xs text-muted-foreground">{completedSales} completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Flash Sales by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-3xl font-bold text-yellow-600">{salesByStatus.draft}</div>
              <div className="text-sm text-yellow-700">Draft</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-600">{salesByStatus.live}</div>
              <div className="text-sm text-green-700">Live</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{salesByStatus.completed}</div>
              <div className="text-sm text-blue-700">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Flash Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {topSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No flash sales created yet. Create your first flash sale to see analytics.
            </div>
          ) : (
            <div className="space-y-4">
              {topSales.map((sale, index) => (
                <div
                  key={sale._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{sale.product?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Status:{' '}
                        <span
                          className={`capitalize ${sale.status === 'live' ? 'text-green-600' : sale.status === 'completed' ? 'text-blue-600' : 'text-yellow-600'}`}
                        >
                          {sale.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      ${((sale.totalRevenue || 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sale.totalSales} sales • {sale.remainingInventory} remaining
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
