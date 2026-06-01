import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Plus, Package, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import EmptyState from '@/components/shared/EmptyState';

const TODAY = format(new Date(), 'yyyy-MM-dd');

function TransferForm({ onSave, onClose, branches }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    date: TODAY, from_branch: '', to_branch: '',
    product_id: '', product_name: '', qty: '', unit: 'kg', notes: '', status: 'completed'
  });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleProductChange = (pid) => {
    const p = products.find(x => x.product_id === pid);
    set('product_id', pid);
    set('product_name', p?.name || pid);
    set('unit', p?.unit || 'kg');
  };

  const valid = form.from_branch && form.to_branch && form.product_id && Number(form.qty) > 0
    && form.from_branch !== form.to_branch;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('date')}</label>
        <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">From {t('branch')}</label>
          <Select value={form.from_branch} onValueChange={v => set('from_branch', v)}>
            <SelectTrigger><SelectValue placeholder={t('branch')} /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">To {t('branch')}</label>
          <Select value={form.to_branch} onValueChange={v => set('to_branch', v)}>
            <SelectTrigger><SelectValue placeholder={t('branch')} /></SelectTrigger>
            <SelectContent>
              {branches.filter(b => b.key !== form.from_branch).map(b => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('product')}</label>
        <Select value={form.product_id} onValueChange={handleProductChange}>
          <SelectTrigger><SelectValue placeholder={t('select_product')} /></SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p.product_id} value={p.product_id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('quantity')}</label>
          <Input type="number" min="0" step="0.01" value={form.qty} onChange={e => set('qty', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('unit')}</label>
          <Input value={form.unit} onChange={e => set('unit', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">{t('notes')}</label>
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('notes')} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} disabled={!valid} className="flex-1">Save Transfer</Button>
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </div>
  );
}

export default function InventoryTransfer() {
  const { t, branches } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['inventory_transfers'],
    queryFn: () => base44.entities.InventoryTransfer.list('-date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.InventoryTransfer.create({ ...data, qty: Number(data.qty) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory_transfers'] }); setShowForm(false); },
  });

  const branchLabel = (key) => branches.find(b => b.key === key)?.label || key;

  const statusColor = { completed: 'bg-emerald-100 text-emerald-700', pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };

  return (
    <div>
      <PageHeader
        title="Inventory Transfers"
        action={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Transfer
          </Button>
        }
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Inventory Transfer</DialogTitle></DialogHeader>
          <TransferForm branches={branches} onSave={(d) => createMutation.mutate(d)} onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : transfers.length === 0 ? (
        <EmptyState message="No transfers recorded yet" />
      ) : (
        <div className="space-y-2">
          {transfers.map(tr => (
            <Card key={tr.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{tr.product_name || tr.product_id}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span>{branchLabel(tr.from_branch)}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{branchLabel(tr.to_branch)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{tr.qty} {tr.unit}</div>
                  <div className="text-xs text-muted-foreground">{tr.date}</div>
                  <Badge className={`text-[10px] mt-1 ${statusColor[tr.status] || ''}`}>{tr.status}</Badge>
                </div>
              </div>
              {tr.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{tr.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}