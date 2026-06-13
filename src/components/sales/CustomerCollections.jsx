/**
 * CustomerCollections — Separate section for collecting customer debt payments.
 * Collections are NOT sales. They reduce customer debt balance (DebtRecord).
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plus, Wallet, User, CheckCircle2, AlertCircle } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

const LABELS = {
  en: {
    title: 'Customer Collections',
    collect: 'Collect Payment',
    customer: 'Customer',
    amount_paid: 'Amount Paid',
    date: 'Date',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    collections_today: 'Collections Total Today',
    no_collections: 'No collections today',
    select_customer: 'Select customer...',
    branch: 'Branch',
    payment_method: 'Payment Method',
    cash: 'Cash',
    network: 'Network',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    collection_saved: 'Collection saved',
    debt_updated: 'Customer balance updated',
    no_debt: 'No open debt found for this customer',
  },
  ar: {
    title: 'تحصيلات العملاء',
    collect: 'تحصيل دفعة',
    customer: 'العميل',
    amount_paid: 'المبلغ المدفوع',
    date: 'التاريخ',
    notes: 'ملاحظات',
    save: 'حفظ',
    cancel: 'إلغاء',
    collections_today: 'إجمالي التحصيلات اليوم',
    no_collections: 'لا توجد تحصيلات اليوم',
    select_customer: 'اختر العميل...',
    branch: 'الفرع',
    payment_method: 'طريقة الدفع',
    cash: 'نقد',
    network: 'شبكة',
    bank_transfer: 'تحويل بنكي',
    cheque: 'شيك',
    collection_saved: 'تم حفظ التحصيل',
    debt_updated: 'تم تحديث رصيد العميل',
    no_debt: 'لا يوجد دين مفتوح لهذا العميل',
  },
  fa: {
    title: 'وصول مشتریان',
    collect: 'دریافت پرداخت',
    customer: 'مشتری',
    amount_paid: 'مبلغ پرداختی',
    date: 'تاریخ',
    notes: 'یادداشت',
    save: 'ذخیره',
    cancel: 'لغو',
    collections_today: 'جمع وصولی امروز',
    no_collections: 'وصولی امروز ندارد',
    select_customer: 'مشتری را انتخاب کنید...',
    branch: 'فرع',
    payment_method: 'روش پرداخت',
    cash: 'نقد',
    network: 'شبکه',
    bank_transfer: 'انتقال بانکی',
    cheque: 'چک',
    collection_saved: 'وصولی ذخیره شد',
    debt_updated: 'موجودی مشتری به‌روز شد',
    no_debt: 'بدهی باز برای این مشتری یافت نشد',
  },
};

const emptyForm = {
  customer_name: '',
  debt_id: '',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  payment_method: 'cash',
  branch: '',
};

export default function CustomerCollections({ branch: defaultBranch, date: defaultDate }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const qc = useQueryClient();
  const { ownerFilter, managerBranch } = useTenant();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, branch: defaultBranch || managerBranch || '', date: defaultDate || format(new Date(), 'yyyy-MM-dd') });
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load open customer debts
  const { data: debts = [] } = useQuery({
    queryKey: ['debts', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter({ ...(ownerFilter || {}), type: 'receivable', party_type: 'customer' }, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  // Load today's collections (CreditCollection records)
  const todayStr = defaultDate || format(new Date(), 'yyyy-MM-dd');
  const { data: collections = [] } = useQuery({
    queryKey: ['credit_collections', ownerFilter, todayStr],
    queryFn: () => base44.entities.CreditCollection.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 200),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const openDebts = useMemo(() =>
    debts.filter(d => d.status !== 'paid' && d.status !== 'written_off'),
    [debts]
  );

  const collectionsToday = useMemo(() => {
    const branchFilter = defaultBranch && defaultBranch !== 'all' ? defaultBranch : null;
    return collections.filter(c => !branchFilter || c.branch === branchFilter);
  }, [collections, defaultBranch]);

  const collectionsTotal = collectionsToday.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // When customer selected, auto-fill debt_id
  const handleCustomerSelect = (debtId) => {
    const debt = openDebts.find(d => d.id === debtId);
    if (debt) {
      set('debt_id', debtId);
      set('customer_name', debt.party_name);
    }
  };

  const saveMut = useMutation({
    mutationFn: async (data) => {
      // 1. Create CreditCollection record
      const collection = await base44.entities.CreditCollection.create({
        date: data.date,
        branch: data.branch || defaultBranch || '',
        amount: Number(data.amount),
        received_via: data.payment_method,
        notes: data.notes,
        customer_name: data.customer_name,
        debt_id: data.debt_id,
        ...(ownerFilter || {}),
      });

      // 2. If linked to a DebtRecord, create a DebtPayment and update the debt
      if (data.debt_id) {
        const debt = openDebts.find(d => d.id === data.debt_id);
        if (debt) {
          const paid = (Number(debt.paid_amount) || 0) + Number(data.amount);
          const remaining = Math.max(0, (Number(debt.total_amount) || 0) - paid);
          const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'open';

          await base44.entities.DebtPayment.create({
            debt_id: data.debt_id,
            party_name: debt.party_name,
            date: data.date,
            amount: Number(data.amount),
            payment_method: data.payment_method,
            notes: data.notes,
          });

          await base44.entities.DebtRecord.update(data.debt_id, {
            paid_amount: paid,
            remaining_amount: remaining,
            status,
          });
        }
      }

      return collection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit_collections'] });
      qc.invalidateQueries({ queryKey: ['debts'] });
      setShowForm(false);
      setForm({ ...emptyForm, branch: defaultBranch || managerBranch || '', date: defaultDate || format(new Date(), 'yyyy-MM-dd') });
      setError('');
    },
    onError: (err) => setError(err.message || 'Failed to save'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customer_name) { setError('Customer name required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Amount must be greater than 0'); return; }
    setError('');
    saveMut.mutate(form);
  };

  return (
    <div className="rounded-xl border border-emerald-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50">
        <Wallet className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">{lbl.title}</span>
        <span className="ms-auto text-xs font-bold text-emerald-700">{currency}{collectionsTotal.toLocaleString()}</span>
      </div>

      <div className="p-3 space-y-2">
        {/* Today's collections list */}
        {collectionsToday.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">{lbl.no_collections}</p>
        ) : (
          <div className="space-y-1.5">
            {collectionsToday.map(c => (
              <div key={c.id} className="flex items-center gap-2 bg-emerald-50/60 rounded-lg px-3 py-2">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium flex-1">{c.customer_name || 'Customer'}</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">{c.received_via}</Badge>
                <span className="text-xs font-bold text-emerald-700">{currency}{Number(c.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Collections total */}
        <div className="flex justify-between items-center bg-emerald-100 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-emerald-800">{lbl.collections_today}</span>
          <span className="text-sm font-bold text-emerald-800">{currency}{collectionsTotal.toLocaleString()}</span>
        </div>

        {/* Add collection button */}
        <Button type="button" variant="outline" size="sm" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />{lbl.collect}
        </Button>
      </div>

      {/* Collection Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              {lbl.collect}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5" />{error}
              </div>
            )}

            {/* Link to existing debt or enter customer name */}
            <div>
              <Label className="text-xs text-muted-foreground">{lbl.customer} (from open debts)</Label>
              <Select value={form.debt_id} onValueChange={handleCustomerSelect}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={lbl.select_customer} />
                </SelectTrigger>
                <SelectContent>
                  {openDebts.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span>{d.party_name}</span>
                        <span className="text-muted-foreground text-xs ml-1">({currency}{(d.remaining_amount || 0).toLocaleString()} due)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{lbl.customer} (or enter manually)</Label>
              <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Customer name..." className="h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">{lbl.amount_paid}</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" className="h-10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{lbl.date}</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-10" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{lbl.payment_method}</Label>
              <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{lbl.cash}</SelectItem>
                  <SelectItem value="network">{lbl.network}</SelectItem>
                  <SelectItem value="bank_transfer">{lbl.bank_transfer}</SelectItem>
                  <SelectItem value="cheque">{lbl.cheque}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{lbl.notes}</Label>
              <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="..." className="h-10" />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 h-11 font-bold" disabled={saveMut.isPending}>
                {saveMut.isPending ? '...' : lbl.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-11">{lbl.cancel}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
