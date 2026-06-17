import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Returns only owner-created, active PurchaseCategory records.
 * NO hardcoded defaults — empty array if none created yet.
 */
export function usePurchaseCategories() {
  const { activeRestaurantId } = useTenant();
  const { lang } = useLanguage();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['purchase_categories', activeRestaurantId],
    queryFn: () =>
      base44.entities.PurchaseCategory.filter(
        activeRestaurantId ? { restaurant_id: activeRestaurantId, is_active: true } : { is_active: true },
        'sort_order',
        200
      ),
    enabled: true,
    staleTime: 30000,
  });

  // Resolve localized name: prefer current lang, then name (primary), then ar, then fa
  const getLabel = (cat) => {
    return cat[`name_${lang}`] || cat.name || cat.name_ar || cat.name_fa || '—';
  };

  const options = categories.map(cat => ({
    value: cat.id,
    label: `${cat.icon || '🛒'} ${getLabel(cat)}`,
    color: cat.color,
    cat,
  }));

  return { categories, options, isLoading };
}