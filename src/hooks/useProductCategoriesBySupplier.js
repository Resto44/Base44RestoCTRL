import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';

/**
 * Fetch product categories that contain products from a specific supplier.
 * Used in Purchase Invoice flow: Supplier → Product Category → Subcategory → Product
 */
export function useProductCategoriesBySupplier(supplierId) {
  const { activeRestaurantId } = useTenant();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['product_categories_by_supplier', supplierId, activeRestaurantId],
    queryFn: async () => {
      if (!supplierId || !activeRestaurantId) return [];

      // Query to get all product categories that have products from this supplier
      const { data, error } = await supabase
        .from('products')
        .select('category_id')
        .eq('supplier_id', supplierId)
        .eq('restaurant_id', activeRestaurantId)
        .is('category_id', 'not.is.null');

      if (error) {
        console.error('Error fetching product categories by supplier:', error);
        return [];
      }

      // Get unique category IDs
      const categoryIds = [...new Set(data.map(p => p.category_id))];

      if (categoryIds.length === 0) return [];

      // Fetch the category details
      const { data: categoryData, error: catError } = await supabase
        .from('product_categories')
        .select('*')
        .in('id', categoryIds)
        .eq('restaurant_id', activeRestaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (catError) {
        console.error('Error fetching category details:', catError);
        return [];
      }

      return categoryData || [];
    },
    enabled: !!(supplierId && activeRestaurantId),
    staleTime: 30000,
  });

  return { categories, isLoading };
}
