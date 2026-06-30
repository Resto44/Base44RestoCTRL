import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProductForm({ initial, onSubmit, onCancel }) {
  const { activeRestaurant } = useTenant();
  const { t, lang } = useLanguage();
  const [form, setForm] = useState({
    product_id: '',
    name: '',
    category_id: '',
    subcategory_id: '',
    category: '',
    purchase_category_id: '',
    unit: '',
    default_price: '',
    default_cost: '',
    description: '',
    restaurant_id: activeRestaurant?.id,
    ...initial,
  });

  // ProductForm uses product_categories ONLY (isolated from expense/purchase/sales/online categories)
  const { data: categories = [] } = useQuery({
    queryKey: ['product_categories', activeRestaurant?.id],
    queryFn: () => base44.entities.ProductCategory.filter(
      activeRestaurant?.id ? { restaurant_id: activeRestaurant.id, is_active: true } : { is_active: true },
      'sort_order',
      500
    ),
    enabled: !!activeRestaurant?.id,
    staleTime: 30000,
  });

  // Load Purchase Categories with hierarchy
  const { data: purchaseCategories = [] } = useQuery({
    queryKey: ['purchase_categories_all', activeRestaurant?.id],
    queryFn: () => base44.entities.PurchaseCategory.filter(
      activeRestaurant?.id ? { restaurant_id: activeRestaurant.id, is_active: true } : { is_active: true },
      'sort_order',
      1000
    ),
    enabled: !!activeRestaurant?.id,
    staleTime: 30000,
  });

  // Level 1: main categories (no parent)
  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  // Level 2: sub-categories of selected main category
  const subCategories = useMemo(() => {
    if (!form.category_id) return [];
    return categories.filter(c => c.parent_id === form.category_id);
  }, [categories, form.category_id]);

  // Level 3: child categories of selected sub-category
  const childCategories = useMemo(() => {
    if (!form.subcategory_id) return [];
    return categories.filter(c => c.parent_id === form.subcategory_id);
  }, [categories, form.subcategory_id]);

  // Purchase Categories Hierarchy (Parent + Child)
  const mainPurchaseCategories = useMemo(() => purchaseCategories.filter(c => !c.parent_id), [purchaseCategories]);
  const subPurchaseCategories = useMemo(() => {
    if (!form.purchase_category_id) return [];
    // If selected is a parent, show its children. If selected is already a child, show its siblings.
    const selected = purchaseCategories.find(c => c.id === form.purchase_category_id);
    const parentId = selected?.parent_id || form.purchase_category_id;
    return purchaseCategories.filter(c => c.parent_id === parentId);
  }, [purchaseCategories, form.purchase_category_id]);

  const getName = (cat) => cat[`name_${lang}`] || cat.name || cat.name_en || cat.name_ar || '—';

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleMainCategoryChange = (value) => {
    const real = value === '__none__' ? '' : value;
    const selected = mainCategories.find(c => c.id === real);
    setForm(prev => ({
      ...prev,
      category_id: real,
      subcategory_id: '',
      child_category_id: '',
      category: selected ? getName(selected) : '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedCat = categories.find(c => c.id === form.category_id);
    onSubmit({
      product_id: form.product_id,
      name: form.name,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      category: selectedCat ? getName(selectedCat) : (form.category || null),
      purchase_category_id: form.purchase_category_id || null,
      unit: form.unit || null,
      default_price: Number(form.default_price) || 0,
      default_cost: Number(form.default_cost) || 0,
      description: form.description || null,
      restaurant_id: form.restaurant_id,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs">{t('product_id')}</Label>
        <Input value={form.product_id} onChange={e => handleChange('product_id', e.target.value)} required disabled={!!initial} />
      </div>
      <div>
        <Label className="text-xs">{t('product_name')}</Label>
        <Input value={form.name} onChange={e => handleChange('name', e.target.value)} required />
      </div>
      <div>
        <Label className="text-xs">{t('description')}</Label>
        <Input value={form.description} onChange={e => handleChange('description', e.target.value)} placeholder={t('optional')} />
      </div>

      {/* Category — cascading 3-level dropdowns */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs font-medium">{t('category')} (Level 1)</Label>
          <Select value={form.category_id || '__none__'} onValueChange={handleMainCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select main category..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {mainCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}{getName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {subCategories.length > 0 && (
          <div>
            <Label className="text-xs font-medium">Sub-category (Level 2)</Label>
            <Select
              value={form.subcategory_id || '__none__'}
              onValueChange={v => { handleChange('subcategory_id', v === '__none__' ? '' : v); handleChange('child_category_id', ''); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub-category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {subCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{getName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {childCategories.length > 0 && (
          <div>
            <Label className="text-xs font-medium">Child Category (Level 3)</Label>
            <Select
              value={form.child_category_id || '__none__'}
              onValueChange={v => handleChange('child_category_id', v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select child category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {childCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{getName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Purchase Category — separate from Product Category */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs font-medium">Purchase Category (Parent) *</Label>
          <Select 
            value={purchaseCategories.find(c => c.id === form.purchase_category_id)?.parent_id || form.purchase_category_id || '__none__'} 
            onValueChange={v => {
              const val = v === '__none__' ? '' : v;
              handleChange('purchase_category_id', val);
              handleChange('purchase_subcategory_id', '');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select parent category..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Select Category —</SelectItem>
              {mainPurchaseCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}{getName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.purchase_category_id && purchaseCategories.filter(c => c.parent_id === (purchaseCategories.find(cat => cat.id === form.purchase_category_id)?.parent_id || form.purchase_category_id)).length > 0 && (
          <div>
            <Label className="text-xs font-medium">Purchase Sub-category</Label>
            <Select 
              value={purchaseCategories.find(c => c.id === form.purchase_category_id)?.parent_id ? form.purchase_category_id : (form.purchase_subcategory_id || '__none__')} 
              onValueChange={v => handleChange('purchase_category_id', v === '__none__' ? (purchaseCategories.find(c => c.id === form.purchase_category_id)?.parent_id || form.purchase_category_id) : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sub-category (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {purchaseCategories.filter(c => c.parent_id === (purchaseCategories.find(cat => cat.id === form.purchase_category_id)?.parent_id || form.purchase_category_id)).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{getName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">{t('unit')}</Label>
        <Input value={form.unit} onChange={e => handleChange('unit', e.target.value)} placeholder={t('optional')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('default_price')}</Label>
          <Input type="number" value={form.default_price} onChange={e => handleChange('default_price', e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">{t('default_cost')}</Label>
          <Input type="number" value={form.default_cost} onChange={e => handleChange('default_cost', e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">{t(initial ? 'update' : 'create')}</Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
