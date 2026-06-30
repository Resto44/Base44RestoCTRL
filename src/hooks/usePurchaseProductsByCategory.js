import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Fetch products filtered by purchase_category_id, supplier_id, and subcategory using server-side filtering.
 * Supports flexible filtering based on provided parameters.
 */
export function usePurchaseProductsByCategory(purchaseCategoryId, supplierId, purchaseSubcategoryId) {
  const { activeRestaurantId } = useTenant();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['purchase_products_filtered', purchaseCategoryId, supplierId, purchaseSubcategoryId, activeRestaurantId],
    queryFn: () => {
      // If no category is selected, we might still want to filter by supplier or return empty
      // Based on requirements, we prioritize purchase_category_id or purchase_subcategory_id
      const effectiveCategoryId = purchaseSubcategoryId || purchaseCategoryId;
      
      const filter = {
        ...(activeRestaurantId && { restaurant_id: activeRestaurantId }),
      };

      if (effectiveCategoryId) {
        filter.purchase_category_id = effectiveCategoryId;
      }

      if (supplierId) {
        filter.supplier_id = supplierId;
      }

      // If no filters are provided, return empty to avoid loading all products
      if (!effectiveCategoryId && !supplierId) return [];

      return base44.entities.Product.filter(filter, 'name', 1000);
    },
    enabled: !!(purchaseCategoryId || supplierId),
    staleTime: 30000,
  });

  return { products, isLoading };
}
