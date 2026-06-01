import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useNotify } from '@/lib/useNotify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BranchSelect from '@/components/shared/BranchSelect';
import { format } from 'date-fns';
import { ShoppingBag, Plus } from 'lucide-react';

const defaultForm = () => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  branch: localStorage.getItem('qa_last_branch') || 'branch_1',
  cash: '',
  network: '',
  credit: '',
  notes: '',
});

export default function QuickSalesModal({ open, onOpenChange }) {
  const { t, currency } = useLanguage();
  const qc = useQueryClient();
  const notif = useNotify();
  const cashRef = useRef(null);
  const [form, setForm] = useState(defaultForm());
  const [saved, setSaved] = useState(false);

  // Auto-focus cash field when modal opens
  useEffect(() => {
    if (open) {
      setForm(defaultForm());
      setSaved(false);
      setTimeout(() => cashRef.current?.focus(), 120);
    }
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoWalletTx = async (saleData, saleId) => {
    const base = { date: saleData.date, branch: saleData.branch, auto_generated: true, reference_id: saleId };
    const promises = [];
    if ((saleData.network || 0) > 0) {
      promises.push(base44.entities.WalletTransaction.create({
        ...base, type: 'network_sales_auto', wallet: 'owner_network', direction: 'in',
        amount: saleData.network, payment_method: 'network',
        description: `Network sales — ${saleData.branch} — ${saleData.date}`,
      }));
    }
    if ((saleData.cash || 0) > 0) {
      promises.push(base44.entities.WalletTransaction.create({
        ...base, type: 'cash_sales_branch', wallet: 'branch_cash', direction: 'in',
        amount: saleData.cash, payment_method: 'cash',
        description: `Cash sales — ${saleData.branch} — ${saleData.date}`,
      }));
    }
    await Promise.all(promises);
    qc.invalidateQueries({ queryKey: ['wallet_transactions'] });
  };

  const saveMut = useMutation({
    mutationFn: async (data) => {
      // Upsert: check if same date+branch exists
      const existing = await base44.entities.DailySales.filter({ date: data.date, branch: data.branch });
      let sale;
      if (existing?.length > 0) {
        sale = await base44.entities.DailySales.update(existing[0].id, data);
        // Remove old auto wallet tx then re-create
        const oldTx = await base44.entities.WalletTransaction.filter({ reference_id: existing[0].id, auto_generated: true });
        await Promise.all(oldTx.map(tx => base44.entities.WalletTransaction.delete(tx.id)));
        await autoWalletTx(data, existing[0].id);
      } else {
        sale = await base44.entities.DailySales.create(data);
        await autoWalletTx(data, sale.id);
      }
      const total = (data.cash || 0) + (data.network || 0) + (data.credit || 0);
      await notif.sale({ branch: data.branch, amount: total, action: 'create' });
      localStorage.setItem('qa_last_branch', data.branch);
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const buildData = () => ({
    date: form.date,
    branch: form.branch,
    cash: Number(form.cash) || 0,
    network: Number(form.network) || 0,
    credit: Number(form.credit) || 0,
    notes: form.notes,
  });

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.branch) return;
    await saveMut.mutateAsync(buildData());
    onOpenChange(false);
  };

  const handleSaveAndAdd = async (e) => {
    e?.preventDefault();
    if (!form.branch) return;
    const branch = form.branch;
    await saveMut.mutateAsync(buildData());
    setForm({ ...defaultForm(), branch, date: form.date });
    setTimeout(() => cashRef.current?.focus(), 80);
  };

  const total = (Number(form.cash) || 0) + (Number(form.network) || 0) + (Number(form.credit) || 0);
  const busy = saveMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="w-4 h-4 text-primary" />
            فروشات روزانه
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('date')}</Label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('branch')}</Label>
              <BranchSelect value={form.branch} onChange={v => set('branch', v)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('cash')}</Label>
              <Input
                ref={cashRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.cash}
                onChange={e => set('cash', e.target.value)}
                placeholder="0"
                className="text-center font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs">{t('network')}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.network}
                onChange={e => set('network', e.target.value)}
                placeholder="0"
                className="text-center font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs">{t('credit')}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.credit}
                onChange={e => set('credit', e.target.value)}
                placeholder="0"
                className="text-center font-semibold"
              />
            </div>
          </div>

          {total > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5 text-center">
              <p className="text-xs text-muted-foreground">{t('total_sales')}</p>
              <p className="text-xl font-bold text-emerald-600">{currency}{total.toLocaleString()}</p>
            </div>
          )}

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="..." />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 h-11 text-sm font-semibold" disabled={busy || !form.branch}>
              {busy ? '...' : saved ? '✓ Saved!' : t('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 text-sm"
              disabled={busy || !form.branch}
              onClick={handleSaveAndAdd}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Save & Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}