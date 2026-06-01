import React, { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProductForm({ initial, onSubmit, onCancel }) {
  const { activeRestaurant } = useTenant();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    product_id: '',
    name: '',
    category: '',
    unit: '',
    default_price: '',
    default_cost: '',
    restaurant_id: activeRestaurant?.id,
    ...initial,
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      default_price: Number(form.default_price) || 0,
      default_cost: Number(form.default_cost) || 0,
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('category')}</Label>
          <Input value={form.category} onChange={e => handleChange('category', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t('unit')}</Label>
          <Input value={form.unit} onChange={e => handleChange('unit', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('default_price')}</Label>
          <Input type="number" step="0.01" value={form.default_price} onChange={e => handleChange('default_price', e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">{t('default_cost')}</Label>
          <Input type="number" step="0.01" value={form.default_cost} onChange={e => handleChange('default_cost', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">{t('save')}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1">{t('cancel')}</Button>}
      </div>
    </form>
  );
}