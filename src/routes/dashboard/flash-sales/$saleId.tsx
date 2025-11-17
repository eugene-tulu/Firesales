import { api } from '@convex/_generated/api';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';

export const Route = createFileRoute('/dashboard/flash-sales/$saleId')({
  component: FlashSaleDetail,
});

function FlashSaleDetail() {
  const { saleId } = Route.useParams();
  const flashSales = useQuery(api.flashSales.list);
  const goLive = useMutation(api.flashSales.goLive);
  const [copied, setCopied] = useState(false);

  const sale = flashSales?.find((s: any) => s._id === saleId);

  if (!sale) {
    return <div className="p-8">Loading...</div>;
  }

  const saleUrl = `/live/${sale.saleUrl}`;

  const handleGoLive = async () => {
    await goLive({ flashSaleId: sale._id });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(saleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-green-500';
      case 'draft':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sale.product?.name}</h1>
          <Badge className={`mt-2 ${getStatusColor(sale.status)}`}>
            {sale.status.toUpperCase()}
          </Badge>
        </div>
        {sale.status === 'draft' && (
          <Button onClick={handleGoLive} size="lg">
            🚀 Go Live
          </Button>
        )}
      </div>

      {/* Shareable Link */}
      <Card>
        <CardHeader>
          <CardTitle>Shareable Link</CardTitle>
          <CardDescription>Share this link on Instagram, WhatsApp, or TikTok</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={saleUrl} readOnly className="flex-1" />
            <Button onClick={copyLink} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button asChild variant="outline">
              <a href={saleUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Remaining Inventory</CardDescription>
            <CardTitle className="text-4xl">{sale.remainingInventory}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              of {sale.allocatedInventory} allocated
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-4xl">{sale.totalSales}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">units sold</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Revenue</CardDescription>
            <CardTitle className="text-4xl">${(sale.totalRevenue / 100).toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">total earned</div>
          </CardContent>
        </Card>
      </div>

      {/* Product Details */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sale.product?.imageUrl && (
            <img
              src={sale.product.imageUrl}
              alt={sale.product.name}
              className="w-full h-64 object-cover rounded"
            />
          )}
          <div>
            <div className="text-sm text-muted-foreground">Price</div>
            <div className="text-2xl font-bold">${(sale.product?.price / 100).toFixed(2)}</div>
          </div>
          {sale.product?.description && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <p className="text-sm">{sale.product.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
