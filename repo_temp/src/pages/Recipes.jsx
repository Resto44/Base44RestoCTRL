import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import { Plus, Pencil, Trash2, ChefHat, Package, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

const emptyIngredient = { product_id: '', product_name: '', qty: '', unit: '', cost_per_unit: '' };
const emptyForm = { menu_item: '', category: '', selling_price: '', ingredients: [], notes: '', is_active: true };

export default function Recipes() {
  const { lang, currency } = useLanguage();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: recipes = [] } = useQuery({ queryKey: ['recipes'], queryFn: () => base44.entities.Recipe.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Recipe.update(editing.id, data)
      : base44.entities.Recipe.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recipes'] }); setShowForm(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Recipe.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recipes'] }); setDeleteTarget(null); },
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      menu_item: r.menu_item || '',
      category: r.category || '',
      selling_price: r.selling_price || '',
      ingredients: safeParseIngredients(r.ingredients),
      notes: r.notes || '',
      is_active: r.is_active !== false,
    });
    setShowForm(true);
  };

  function safeParseIngredients(raw) {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  const addIngredient = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, { ...emptyIngredient }] }));
  const removeIngredient = (i) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));
  const updateIngredient = (i, field, val) => setForm(f => ({
    ...f,
    ingredients: f.ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing),
  }));
  const pickProduct = (i, productId) => {
    const prod = products.find(p => p.product_id === productId || p.id === productId);
    if (prod) updateIngredient(i, 'product_name', prod.name);
    updateIngredient(i, 'product_id', productId);
    if (prod?.default_cost) updateIngredient(i, 'cost_per_unit', prod.default_cost);
    if (prod?.unit) updateIngredient(i, 'unit', prod.unit);
  };

  const totalCost = (ingredients) => ingredients.reduce((s, ing) => s + (parseFloat(ing.qty) || 0) * (parseFloat(ing.cost_per_unit) || 0), 0);

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      selling_price: parseFloat(form.selling_price) || 0,
      ingredients: JSON.stringify(form.ingredients),
    });
  };

  const filtered = useMemo(() => recipes.filter(r =>
    !search || r.menu_item?.toLowerCase().includes(search.toLowerCase()) || r.category?.toLowerCase().includes(search.toLowerCase())
  ), [recipes, search]);

  const ui = {
    en: { title: 'Recipes / BOM', addRecipe: 'Add Recipe', menuItem: 'Menu Item', category: 'Category', sellingPrice: 'Selling Price', ingredients: 'Ingredients (BOM)', addIngredient: 'Add Ingredient', product: 'Product', qty: 'Qty', unit: 'Unit', costPerUnit: 'Cost/Unit', notes: 'Notes', save: 'Save', cancel: 'Cancel', grossMargin: 'Gross Margin', ingredientCost: 'Ingredient Cost', costPct: 'Cost %', noData: 'No recipes found', delete: 'Delete', confirmDelete: 'Delete this recipe?', yes: 'Yes', no: 'No' },
    ar: { title: 'الوصفات / قائمة المواد', addRecipe: 'إضافة وصفة', menuItem: 'طبق القائمة', category: 'الفئة', sellingPrice: 'سعر البيع', ingredients: 'المكونات (BOM)', addIngredient: 'إضافة مكون', product: 'المنتج', qty: 'الكمية', unit: 'الوحدة', costPerUnit: 'التكلفة/الوحدة', notes: 'ملاحظات', save: 'حفظ', cancel: 'إلغاء', grossMargin: 'هامش الربح الإجمالي', ingredientCost: 'تكلفة المكونات', costPct: 'نسبة التكلفة', noData: 'لا توجد وصفات', delete: 'حذف', confirmDelete: 'حذف هذه الوصفة؟', yes: 'نعم', no: 'لا' },
    fa: { title: 'دستورالعمل / BOM', addRecipe: 'افزودن دستورالعمل', menuItem: 'آیتم منو', category: 'دسته‌بندی', sellingPrice: 'قیمت فروش', ingredients: 'مواد اولیه (BOM)', addIngredient: 'افزودن ماده', product: 'محصول', qty: 'مقدار', unit: 'واحد', costPerUnit: 'هزینه/واحد', notes: 'یادداشت', save: 'ذخیره', cancel: 'لغو', grossMargin: 'حاشیه سود ناخالص', ingredientCost: 'هزینه مواد', costPct: 'درصد هزینه', noData: 'دستورالعملی یافت نشد', delete: 'حذف', confirmDelete: 'این دستورالعمل حذف شود؟', yes: 'بله', no: 'خیر' },
  };
  const m = ui[lang] || ui.en;

  return (
    <div>
      <PageHeader
        title={m.title}
        action={<Button size="sm" onClick={openAdd} className="gap-1"><Plus className="w-4 h-4" />{m.addRecipe}</Button>}
      />

      <Input placeholder="🔍" value={search} onChange={e => setSearch(e.target.value)} className="mb-4 max-w-xs" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(r => {
          const ings = safeParseIngredients(r.ingredients);
          const cost = totalCost(ings);
          const price = r.selling_price || 0;
          const costPct = price > 0 ? (cost / price * 100).toFixed(0) : null;
          const margin = price - cost;
          return (
            <Card key={r.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{r.menu_item}</p>
                    {r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(r)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                  <p className="text-muted-foreground">{m.sellingPrice}</p>
                  <p className="font-bold text-primary">{formatCurrency(price, currency)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                  <p className="text-muted-foreground">{m.ingredientCost}</p>
                  <p className="font-bold text-orange-500">{formatCurrency(cost, currency)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                  <p className="text-muted-foreground">{m.grossMargin}</p>
                  <p className={`font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(margin, currency)}</p>
                </div>
              </div>

              {costPct !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${Number(costPct) > 70 ? 'bg-red-500' : Number(costPct) > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Number(costPct))}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{costPct}%</span>
                </div>
              )}

              {ings.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ings.slice(0, 4).map((ing, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <Package className="w-2.5 h-2.5" />
                      {ing.product_name || ing.product_id} ×{ing.qty}
                    </Badge>
                  ))}
                  {ings.length > 4 && <Badge variant="outline" className="text-xs">+{ings.length - 4}</Badge>}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>{m.noData}</p>
          </div>
        )}
      </div>

      {/* Recipe Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? m.menuItem : m.addRecipe}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{m.menuItem}</Label><Input value={form.menu_item} onChange={e => setForm(f => ({ ...f, menu_item: e.target.value }))} /></div>
              <div><Label className="text-xs">{m.category}</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. main, salad" /></div>
            </div>
            <div><Label className="text-xs">{m.sellingPrice}</Label><Input type="number" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} /></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">{m.ingredients}</Label>
                <Button size="sm" variant="outline" onClick={addIngredient} className="gap-1 h-7 text-xs">
                  <Plus className="w-3 h-3" />{m.addIngredient}
                </Button>
              </div>
              <div className="space-y-2">
                {form.ingredients.map((ing, i) => (
                  <div key={i} className="grid grid-cols-5 gap-1.5 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded">
                    <select
                      className="border border-input rounded px-2 py-1 text-xs bg-background col-span-2"
                      value={ing.product_id}
                      onChange={e => pickProduct(i, e.target.value)}
                    >
                      <option value="">— {m.product} —</option>
                      {products.map(p => <option key={p.id} value={p.product_id || p.id}>{p.name}</option>)}
                    </select>
                    <Input type="number" className="h-7 text-xs" placeholder={m.qty} value={ing.qty} onChange={e => updateIngredient(i, 'qty', e.target.value)} />
                    <Input className="h-7 text-xs" placeholder={m.unit} value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} />
                    <div className="flex gap-1">
                      <Input type="number" className="h-7 text-xs" placeholder={m.costPerUnit} value={ing.cost_per_unit} onChange={e => updateIngredient(i, 'cost_per_unit', e.target.value)} />
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeIngredient(i)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              {form.ingredients.length > 0 && (
                <div className="mt-2 text-xs text-right text-muted-foreground">
                  {m.ingredientCost}: <strong>{formatCurrency(totalCost(form.ingredients), currency)}</strong>
                  {form.selling_price > 0 && (
                    <> · {m.grossMargin}: <strong className="text-emerald-600">{formatCurrency(parseFloat(form.selling_price) - totalCost(form.ingredients), currency)}</strong></>
                  )}
                </div>
              )}
            </div>

            <div><Label className="text-xs">{m.notes}</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending}>{m.save}</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>{m.cancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{m.confirmDelete}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{deleteTarget?.menu_item}</p>
          <div className="flex gap-2 mt-2">
            <Button variant="destructive" className="flex-1" onClick={() => deleteMutation.mutate(deleteTarget.id)}>{m.yes}</Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>{m.no}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}