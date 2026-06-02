import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

// fix: MenuProduct is remapped to the `products` table.
// Field mapping: price → default_price, is_available → is_active, sort_order removed (not in products table)
const EMPTY = { name: '', name_ar: '', category: '', default_price: '', description: '', unit: '', is_active: true };

export default function MenuProducts() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['menu-products-all'],
    queryFn: () => base44.entities.MenuProduct.list('name', 500),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? base44.entities.MenuProduct.update(editing, { ...form, default_price: Number(form.default_price) })
      : base44.entities.MenuProduct.create({ ...form, default_price: Number(form.default_price) }),
    onSuccess: () => {
      toast.success(editing ? 'Updated' : 'Created');
      qc.invalidateQueries({ queryKey: ['menu-products'] });
      qc.invalidateQueries({ queryKey: ['menu-products-all'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false); setEditing(null); setForm(EMPTY);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MenuProduct.delete(id),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['menu-products-all'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const toggleAvailable = useMutation({
    mutationFn: (p) => base44.entities.MenuProduct.update(p.id, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-products-all'] }),
  });

  const categories = ['all', ...new Set(products.map(p => p.category || 'Other').filter(Boolean))];
  const filtered = filterCat === 'all' ? products : products.filter(p => (p.category || 'Other') === filterCat);

  const openEdit = (p) => { setForm({ ...p, default_price: String(p.default_price || '') }); setEditing(p.id); setShowForm(true); };
  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Menu Products</h1>
        <Button onClick={openNew} className="gap-1"><Plus className="w-4 h-4" /> Add Product</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filterCat === c ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
            {c}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>}

      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id} className={`${!p.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{p.name}</span>
                  {p.name_ar && <span className="text-sm text-muted-foreground">{p.name_ar}</span>}
                  {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                  {!p.is_active && <Badge className="bg-red-100 text-red-600 text-[10px]">Inactive</Badge>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-primary">{p.default_price} SAR</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleAvailable.mutate(p)}>
                  {p.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No products yet. Click "Add Product" to create menu items.
        </div>
      )}

      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Name (EN) *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div><Label className="text-xs">Name (AR)</Label><Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} dir="rtl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Chicken" /></div>
              <div><Label className="text-xs">Price (SAR) *</Label><Input type="number" value={form.default_price} onChange={e => set('default_price', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>
              <div><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. piece" /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.default_price || saveMutation.isPending}>Save</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
