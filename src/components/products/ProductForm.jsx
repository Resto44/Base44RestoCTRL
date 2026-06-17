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
    category: '',
    unit: '',
    default_price: '',
    default_cost: '',
    description: '',
    restaurant_id: activeRestaurant?.id,
    ...initial,
  });

  // ProductForm uses product_categories ONLY (isolated from expense/menu categories)
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

  const categoryOptions = useMemo(() => categories.map(cat => ({
    value: cat.id,
    label: cat[`name_${lang}`] || cat.name_en || cat.name_ar || cat.name_fa || '—',
    cat,
  })), [categories, lang]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCategoryChange = (value) => {
    const selected = categoryOptions.find(option => option.value === value);
    setForm(prev => ({
      ...prev,
      category_id: value,
      category: selected?.label || '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selected = categoryOptions.find(option => option.value === form.category_id);
    onSubmit({
      product_id: form.product_id,
      name: form.name,
      category_id: form.category_id || null,
      category: selected?.label || form.category || null,
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('category_id')}</Label>
          <Select value={form.category_id || ''} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('optional')} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('unit')}</Label>
          <Input value={form.unit} onChange={e => handleChange('unit', e.target.value)} placeholder={t('optional')} />
        </div>
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
