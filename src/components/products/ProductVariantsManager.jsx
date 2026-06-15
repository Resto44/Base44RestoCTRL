import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_VARIANTS = ['Small', 'Medium', 'Large', 'Half', 'Full', 'Family Size'];

function VariantForm({ initial, productId, restaurantId, onSubmit, onCancel }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    name_en: '',
    sku_suffix: '',
    cost_price: '',
    selling_price: '',
    stock_impact: '1',
    is_active: true,
    product_id: productId,
    restaurant_id: restaurantId,
    ...initial,
  });

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      stock_impact: Number(form.stock_impact) || 1,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-1 mb-2">
        {PRESET_VARIANTS.map(v => (
          <button key={v} type="button"
            className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => set('name', v)}
          >{v}</button>
        ))}
      </div>
      <div>
        <Label className="text-xs">{t('variant_name')} *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('name_ar')}</Label>
          <Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} dir="rtl" />
        </div>
        <div>
          <Label className="text-xs">SKU Suffix</Label>
          <Input value={form.sku_suffix} onChange={e => set('sku_suffix', e.target.value)} placeholder="-SM" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">{t('purchase_cost')}</Label>
          <Input type="number" step="0.01" min="0" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">{t('selling_price')}</Label>
          <Input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">{t('stock_impact')}</Label>
          <Input type="number" step="0.01" value={form.stock_impact} onChange={e => set('stock_impact', e.target.value)} placeholder="1" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('active')}</Label>
        <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">{initial?.id ? t('save') : t('add_variant')}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}

export default function ProductVariantsManager({ product }) {
  const { t, currency } = useLanguage();
  const { activeRestaurant } = useTenant();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['product_variants', product?.id],
    queryFn: () => base44.entities.ProductVariant.filter({ product_id: product.id }, 'sort_order', 100),
    enabled: !!product?.id,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ProductVariant.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product_variants', product.id] }); setShowForm(false); toast.success(t('variant_added')); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductVariant.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product_variants', product.id] }); setEditing(null); toast.success(t('product_updated')); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ProductVariant.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product_variants', product.id] }); setDeleting(null); },
    onError: (e) => toast.error(e.message),
  });

  if (!product) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('product_variants')}</h3>
        <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); }}>
          <Plus className="w-3 h-3 mr-1" />{t('add_variant')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t('loading')}</p>
      ) : variants.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">{t('no_variants')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map(v => (
            <div key={v.id} className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{v.name}</span>
                  {v.name_ar && <span className="text-xs text-muted-foreground" dir="rtl">{v.name_ar}</span>}
                  {!v.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>Cost: {currency}{v.cost_price}</span>
                  <span>Price: {currency}{v.selling_price}</span>
                  <span>Stock ×{v.stock_impact}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(v); setShowForm(false); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(v)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('add_variant')}</DialogTitle></DialogHeader>
          <VariantForm
            productId={product.id}
            restaurantId={activeRestaurant?.id}
            onSubmit={(data) => createMut.mutate(data)}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Variant</DialogTitle></DialogHeader>
          {editing && (
            <VariantForm
              initial={editing}
              productId={product.id}
              restaurantId={activeRestaurant?.id}
              onSubmit={(data) => updateMut.mutate({ id: editing.id, data })}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting.id)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
