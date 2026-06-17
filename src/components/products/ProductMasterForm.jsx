import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
function nanoid8() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ProductMasterForm({ initial, onSubmit, onCancel }) {
  const { activeRestaurant } = useTenant();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    name_en: '',
    name_fa: '',
    product_id: '',
    sku: '',
    barcode: '',
    category_id: '',
    category: '',
    brand: '',
    supplier_id: '',
    unit: '',
    purchase_cost: '',
    selling_price: '',
    default_price: '',
    default_cost: '',
    tax_rate: '',
    min_stock: '',
    max_stock: '',
    current_stock: '',
    description: '',
    image_url: '',
    status: 'active',
    is_active: true,
    restaurant_id: activeRestaurant?.id,
    ...initial,
  });

  // ProductMasterForm uses product_categories ONLY (isolated from expense/menu categories)
  const { data: categories = [] } = useQuery({
    queryKey: ['product_categories', activeRestaurant?.id],
    queryFn: () => base44.entities.ProductCategory.filter(
      activeRestaurant?.id ? { restaurant_id: activeRestaurant.id } : {},
      'sort_order', 500
    ),
    enabled: !!activeRestaurant?.id,
    staleTime: 30000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', activeRestaurant?.id],
    queryFn: () => base44.entities.Supplier.filter(
      activeRestaurant?.id ? { restaurant_id: activeRestaurant.id } : {},
      'name', 500
    ),
    enabled: !!activeRestaurant?.id,
    staleTime: 30000,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['product_units', activeRestaurant?.id],
    queryFn: () => base44.entities.ProductUnit.list('sort_order', 200),
    staleTime: 60000,
  });

  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const subCategories = useMemo(() => {
    if (!form.category_id) return [];
    return categories.filter(c => c.parent_id === form.category_id);
  }, [categories, form.category_id]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedCat = categories.find(c => c.id === form.category_id);
    onSubmit({
      name: form.name || form.name_en || form.name_ar,
      name_ar: form.name_ar || null,
      name_en: form.name_en || null,
      name_fa: form.name_fa || null,
      product_id: form.product_id || nanoid8(),
      sku: form.sku || null,
      barcode: form.barcode || null,
      category_id: form.category_id || null,
      category: selectedCat?.name_en || selectedCat?.name || form.category || null,
      brand: form.brand || null,
      supplier_id: form.supplier_id || null,
      unit: form.unit || null,
      purchase_cost: Number(form.purchase_cost) || 0,
      selling_price: Number(form.selling_price) || 0,
      default_price: Number(form.selling_price) || Number(form.default_price) || 0,
      default_cost: Number(form.purchase_cost) || Number(form.default_cost) || 0,
      tax_rate: Number(form.tax_rate) || 0,
      min_stock: Number(form.min_stock) || 0,
      max_stock: Number(form.max_stock) || 0,
      current_stock: Number(form.current_stock) || 0,
      description: form.description || null,
      image_url: form.image_url || null,
      status: form.status || 'active',
      is_active: form.status === 'active',
      restaurant_id: activeRestaurant?.id,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="basic">
        <TabsList className="grid grid-cols-3 w-full text-xs">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {/* ── BASIC INFO ── */}
        <TabsContent value="basic" className="space-y-3 pt-2">
          <div>
            <Label className="text-xs font-medium">{t('product_name')} *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Main display name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('name_ar')}</Label>
              <Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="اسم المنتج" dir="rtl" />
            </div>
            <div>
              <Label className="text-xs">{t('name_en')}</Label>
              <Input value={form.name_en} onChange={e => set('name_en', e.target.value)} placeholder="Product name" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('name_fa')}</Label>
            <Input value={form.name_fa} onChange={e => set('name_fa', e.target.value)} placeholder="نام محصول" dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('sku')}</Label>
              <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU-001" />
            </div>
            <div>
              <Label className="text-xs">{t('barcode')}</Label>
              <Input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="1234567890" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('category')}</Label>
              <Select value={form.category_id || ''} onValueChange={v => { set('category_id', v); set('sub_category_id', ''); }}>
                <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
                <SelectContent>
                  {parentCategories.map(c => (
                    <SelectItem key={c.id} value={c.id || ""}>{c.name_en || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('sub_category')}</Label>
              <Select value={form.sub_category_id || ''} onValueChange={v => set('sub_category_id', v)} disabled={subCategories.length === 0}>
                <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
                <SelectContent>
                  {subCategories.map(c => (
                    <SelectItem key={c.id} value={c.id || ""}>{c.name_en || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('unit')}</Label>
              <Select value={form.unit || ''} onValueChange={v => set('unit', v)}>
                <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.abbreviation || u.name || ""}>
                      {u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('brand')}</Label>
              <Input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder={t('optional')} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('supplier')}</Label>
            <Select value={form.supplier_id || ''} onValueChange={v => set('supplier_id', v)}>
              <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— {t('none')} —</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id || ""}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t('description')}</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder={t('optional')} />
          </div>
          <div>
            <Label className="text-xs">{t('image_upload')}</Label>
            <Input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://... or leave blank" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('status')}</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="inactive">{t('inactive')}</SelectItem>
                <SelectItem value="discontinued">{t('discontinued')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ── PRICING ── */}
        <TabsContent value="pricing" className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('purchase_cost')}</Label>
              <Input type="number" step="0.01" min="0" value={form.purchase_cost} onChange={e => set('purchase_cost', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">{t('selling_price')}</Label>
              <Input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('tax_rate')}</Label>
            <Input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} placeholder="0" />
          </div>
          {form.purchase_cost && form.selling_price && (
            <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Profit</span>
                <span className="font-semibold text-green-600">
                  {(Number(form.selling_price) - Number(form.purchase_cost)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-semibold text-blue-600">
                  {Number(form.selling_price) > 0
                    ? (((Number(form.selling_price) - Number(form.purchase_cost)) / Number(form.selling_price)) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── INVENTORY ── */}
        <TabsContent value="inventory" className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('min_stock')}</Label>
              <Input type="number" min="0" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">{t('max_stock')}</Label>
              <Input type="number" min="0" value={form.max_stock} onChange={e => set('max_stock', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">{t('current_stock')}</Label>
              <Input type="number" min="0" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} placeholder="0" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Stock levels are automatically updated via inventory transactions.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">{initial ? t('save') : t('add_product')}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
