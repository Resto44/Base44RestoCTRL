import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Tag, FolderOpen } from 'lucide-react';

const COLOR_OPTIONS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

function CategoryForm({ initial, onSubmit, onCancel, lang }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    color: initial?.color || '#6366f1',
    is_active: initial?.is_active !== false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-3">
      <div>
        <Label>Category Name *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Rent" />
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COLOR_OPTIONS.map(c => (
            <button key={c} onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="cat_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
        <Label htmlFor="cat_active">Active</Label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => { if (form.name.trim()) onSubmit(form); }} disabled={!form.name.trim()}>Save</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

export function useExpenseCategories() {
  const { activeRestaurantId } = useTenant();
  
  return useQuery({
    queryKey: ['expense_categories', activeRestaurantId],
    queryFn: () => base44.entities.ExpenseCategory.filter(
      activeRestaurantId ? { restaurant_id: activeRestaurantId } : {},
      'sort_order',
      500
    ),
    enabled: true,
    staleTime: 30000,
  });
}

export default function ExpenseCategoryManager({ onClose }) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: categories = [], isLoading } = useExpenseCategories();

  const { activeRestaurantId } = useTenant();
  const createMut = useMutation({
    mutationFn: async (d) => {
      const payload = { 
        name: d.name,
        color: d.color,
        is_active: d.is_active,
        restaurant_id: activeRestaurantId 
      };
      return base44.entities.ExpenseCategory.create(payload);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['expense_categories'] }); 
      setShowForm(false); 
    }
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => {
      return base44.entities.ExpenseCategory.update(id, {
        name: data.name,
        color: data.color,
        is_active: data.is_active
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense_categories'] }); setEditing(null); }
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.ExpenseCategory.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense_categories'] }); setDeleting(null); }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Expense Categories</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{categories.length}</span>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-4">Loading...</p>
      ) : categories.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">No expense categories yet</p>
          <p className="text-xs text-muted-foreground mb-3">Create your first category to start tracking expenses</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create First Category
          </Button>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {categories.map(cat => (
            <div key={cat.id} className={`flex items-center gap-2 p-2 rounded-lg border bg-card ${!cat.is_active ? 'opacity-50' : ''}`}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color || '#888' }} />
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              {!cat.is_active && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(cat)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(cat)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <Button variant="outline" className="w-full mt-2" onClick={onClose}>Done</Button>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Expense Category</DialogTitle></DialogHeader>
          <CategoryForm lang={lang} onSubmit={d => createMut.mutate(d)} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {editing && <CategoryForm lang={lang} initial={editing} onSubmit={d => updateMut.mutate({ id: editing.id, data: d })} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>This will not delete existing expenses using this category.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
