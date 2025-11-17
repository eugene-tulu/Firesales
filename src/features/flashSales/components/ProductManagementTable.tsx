import { DeleteActionButton, EditActionButton } from '../../../components/data-table/ActionButtons';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import type { Product } from './ProductManagementView';

interface ProductManagementTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductManagementTable({
  products,
  onEdit,
  onDelete,
}: ProductManagementTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Price</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id.toString()} className="border-b">
                  <td className="py-2">{product.name}</td>
                  <td className="py-2">{product.description}</td>
                  <td className="py-2">${product.price.toFixed(2)}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : product.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : product.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800'
                              : product.status === 'sold_out'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex space-x-2">
                      <EditActionButton onClick={() => onEdit(product)} />
                      <DeleteActionButton onClick={() => onDelete(product)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No products found. Create your first product to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
