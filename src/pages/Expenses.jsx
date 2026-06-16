import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import BranchSelect from '@/components/shared/BranchSelect';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ScanLine, BarChart3, FolderOpen, Tag } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ExpenseAnalytics from '@/components/expenses/ExpenseAnalytics';
import ExpenseCategoryManager, { useExpenseCategories } from '@/components/expenses/ExpenseCategoryManager';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/helpers';
import ReceiptScanner from '@/components/expenses/ReceiptScanner';
import { Dialog as ScanDialog, DialogContent as ScanDialogContent, DialogHeader as ScanDialogHeader, DialogTitle as ScanDialogTitle } from '@/components/ui/dialog';
import { useNotify } from '@/lib/useNotify';
import { useTenant } from '@/lib/TenantContext';

function ExpenseForm({ initial, onSubmit, onCancel, categories }) {
  const { t, lang } = useLanguage();
  const { branches, managerBranch } = useTenant();
  const defaultBranch = initial?.branch || managerBranch || branches[0]?.key || '';
  const [form, setForm] = useState({
    date: initial?.date || format(new Date(), 'yyyy-MM-dd'),
    branch: defaultBranch,
    category: initial?.category || '',
    description: initial?.description || '',
    amount: initial?.amount || '',
    payment_method: initial?.payment_method || 'cash',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const getCatName = (cat) => {
    if (lang === 'ar' && cat.name_ar) return cat.name_ar;
    if (lang === 'fa' && cat.name_fa) return cat.name_fa;
    return cat.name_en;
  };

  const activeCats = categories.filter(c => c.is_active !== false);

  return (
    <div className="space-y-3">
      <div><Label>{t('date')}</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
      <div><Label>{t('branch')}</Label>
        <Select value={form.branch} onValueChange={v => set('branch', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_branches')}</SelectItem>
            {branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t('expense_category')}</Label>
        {activeCats.length === 0 ? (
          <div className="mt-1 p-3 rounded-lg border border-dashed text-center">
            <Tag className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No categories yet. Create them in the Categories tab.</p>
          </div>
        ) : (
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
            <SelectContent>
              {activeCats.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {/* icon removed */}
                    <span>{getCatName(c)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div><Label>{t('description')}</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div><Label>{t('amount')}</Label><Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
      <div><Label>{t('payment_method')}</Label>
        <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">{t('cash')}</SelectItem>
            <SelectItem value="network">{t('network')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => onSubmit({ ...form, amount: Number(form.amount) || 0 })}>{t('save')}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </div>
  );
}

export default function Expenses() {
  const { t, currency, lang } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const qc = useQueryClient();
  const notif = useNotify();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filterBranch, setFilterBranch] = useState('all');
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 2000), staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: categories = [] } = useExpenseCategories();

  const getCatById = (id) => categories.find(c => c.id === id);
  const getCatName = (cat) => {
    if (!cat) return id => id; // fallback
    if (lang === 'ar' && cat.name_ar) return cat.name_ar;
    if (lang === 'fa' && cat.name_fa) return cat.name_fa;
    return cat.name_en;
  };
  const getCatDisplayName = (categoryId) => {
    const cat = getCatById(categoryId);
    if (!cat) return categoryId || '—';
    return getCatName(cat);
  };

  const { activeRestaurantId } = useTenant();
  const createMut = useMutation({
    mutationFn: async (d) => {
      const payload = { ...d, restaurant_id: activeRestaurantId };
      const exp = await base44.entities.Expense.create(payload);
      await notif.expense({ branch: d.branch, amount: d.amount, category: d.category, action: 'create' });
      return exp;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); }
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const exp = await base44.entities.Expense.update(id, data);
      await notif.expense({ branch: data.branch, amount: data.amount, category: data.category, action: 'update' });
      return exp;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setEditing(null); }
  });
  const deleteMut = useMutation({
    mutationFn: async (expense) => {
      await base44.entities.Expense.delete(expense.id);
      await notif.expense({ branch: expense.branch, amount: expense.amount, category: expense.category, action: 'delete' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setDeleting(null); }
  });

  const filtered = filterBranch === 'all' ? expenses : expenses.filter(e => e.branch === filterBranch || e.branch === 'all');
  const totalAmt = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title={t('expenses')}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowScanner(true)}>
              <ScanLine className="w-4 h-4 mr-1" /> Scan
            </Button>
            <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); setScannedData(null); }}>
              <Plus className="w-4 h-4 mr-1" />{t('add_expense')}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="list">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="list" className="flex-1 text-xs">List</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />Analytics
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 text-xs">
            <FolderOpen className="w-3.5 h-3.5 mr-1" />Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="mb-4">
            <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
          </div>

          {totalAmt > 0 && (
            <Card className="p-3 mb-4 bg-destructive/10 border-destructive/20">
              <p className="text-sm font-semibold text-destructive">{t('total_expenses')}: {formatCurrency(totalAmt, currency)}</p>
            </Card>
          )}

          {isLoading ? <p className="text-center text-muted-foreground text-sm py-8">{t('loading')}</p>
            : filtered.length === 0 ? <EmptyState />
            : (
              <div className="space-y-2">
                {filtered.map(e => {
                  const cat = getCatById(e.category);
                  return (
                    <Card key={e.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* icon removed */}
                          {cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color || '#888' }} />}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{getCatDisplayName(e.category)}</p>
                            <p className="text-xs text-muted-foreground">{e.date} · {e.branch === 'all' ? t('all_branches') : (branches.find(b => b.key === e.branch)?.label || e.branch)}</p>
                            {e.description && <p className="text-xs text-muted-foreground truncate">{e.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-destructive">{formatCurrency(e.amount, currency)}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
        </TabsContent>

        <TabsContent value="analytics">
          <ExpenseAnalytics expenses={expenses} categories={categories} />
        </TabsContent>

        <TabsContent value="categories">
          <ExpenseCategoryManager />
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('add_expense')}</DialogTitle></DialogHeader>
          <ExpenseForm initial={scannedData} categories={categories} onSubmit={d => createMut.mutate(d)} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <ScanDialog open={showScanner} onOpenChange={setShowScanner}>
        <ScanDialogContent className="max-w-sm">
          <ScanDialogHeader><ScanDialogTitle>Scan Receipt</ScanDialogTitle></ScanDialogHeader>
          <ReceiptScanner
            onExtracted={(data) => {
              setScannedData({ amount: data.amount, date: data.date, description: data.vendor || data.description, category: data.category });
              setShowScanner(false);
              setShowForm(true);
            }}
            onClose={() => setShowScanner(false)}
          />
        </ScanDialogContent>
      </ScanDialog>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('edit_expense')}</DialogTitle></DialogHeader>
          {editing && <ExpenseForm initial={editing} categories={categories} onSubmit={d => updateMut.mutate({ id: editing.id, data: d })} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle><AlertDialogDescription /></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}