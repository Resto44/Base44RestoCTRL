import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Fetch products filtered by purchase category_id using server-side filtering.
 * Returns empty array if categoryId is not provided.
 * Uses WHERE category_id = categoryId in the database query.
 */
export function usePurchaseProductsByCategory(categoryId) {
  const { activeRestaurantId } = useTenant();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['purchase_products_by_category', categoryId, activeRestaurantId],
    queryFn: () => {
      if (!categoryId) return [];
      
      // Server-side filter: only fetch products where category_id matches
      return base44.entities.Product.filter(
        {
          category_id: categoryId,
          ...(activeRestaurantId && { restaurant_id: activeRestaurantId }),
        },
        'name',
        1000
      );
    },
    enabled: !!categoryId, // Only run query if categoryId is provided
    staleTime: 30000,
  });

  return { products, isLoading };
}
