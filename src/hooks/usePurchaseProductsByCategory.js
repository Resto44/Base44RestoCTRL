import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Fetch products filtered by purchase_category_id using server-side filtering.
 * Returns empty array if purchaseCategoryId is not provided.
 * Uses WHERE purchase_category_id = purchaseCategoryId in the database query.
 */
export function usePurchaseProductsByCategory(purchaseCategoryId) {
  const { activeRestaurantId } = useTenant();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['purchase_products_by_category', purchaseCategoryId, activeRestaurantId],
    queryFn: () => {
      if (!purchaseCategoryId) return [];
      
      // Server-side filter: only fetch products where purchase_category_id matches
      return base44.entities.Product.filter(
        {
          purchase_category_id: purchaseCategoryId,
          ...(activeRestaurantId && { restaurant_id: activeRestaurantId }),
        },
        'name',
        1000
      );
    },
    enabled: !!purchaseCategoryId, // Only run query if purchaseCategoryId is provided
    staleTime: 30000,
  });

  return { products, isLoading };
}
