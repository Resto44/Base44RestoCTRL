import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Fetch products filtered by product_category_id, supplier_id, and subcategory_id using server-side filtering.
 * Used in Purchase Invoice flow: Supplier → Product Category → Subcategory → Product
 */
export function usePurchaseProductsByCategory(productCategoryId, supplierId, subcategoryId) {
  const { activeRestaurantId } = useTenant();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['purchase_products_filtered', productCategoryId, supplierId, subcategoryId, activeRestaurantId],
    queryFn: () => {
      // Prioritize subcategoryId or productCategoryId
      const effectiveCategoryId = subcategoryId || productCategoryId;
      
      const filter = {
        ...(activeRestaurantId && { restaurant_id: activeRestaurantId }),
      };

      if (effectiveCategoryId) {
        filter.category_id = effectiveCategoryId;
      }

      if (supplierId) {
        filter.supplier_id = supplierId;
      }

      // If no filters are provided, return empty to avoid loading all products
      if (!effectiveCategoryId && !supplierId) return [];

      return base44.entities.Product.filter(filter, 'name', 1000);
    },
    enabled: !!(productCategoryId || supplierId),
    staleTime: 30000,
  });

  return { products, isLoading };
}
