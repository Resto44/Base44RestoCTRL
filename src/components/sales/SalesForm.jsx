/**
 * SalesForm — Professional Restaurant ERP Sales Entry
 * Supports: Cash Register (Opening/Closing/Difference/Status), Dynamic POS/Network entries,
 *           Customer Credit Sales, Proof Upload
 */
import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BranchSelect from '@/components/shared/BranchSelect';
import NetworkAccountSelect from '@/components/network/NetworkAccountSelect';
import SmartUploadZone from '@/components/shared/SmartUploadZone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Store, Receipt, Plus, Trash2, Wifi, CreditCard, AlertCircle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

const LABELS = {
  en: {
    date: 'Date', branch: 'Branch', save: 'Save', cancel: 'Cancel',
    cash_register: 'Cash Register',
    opening_cash: 'Opening Cash',
    closing_cash: 'Closing Cash',
    cash_difference: 'Cash Difference',
    cash_status: 'Cash Status',
    cash_notes: 'Cash Notes',
    balanced: 'Balanced',
    shortage: 'Shortage',
    overage: 'Overage',
    network_sales: 'Network Sales', add_pos: 'Add POS Device',
    pos_device: 'POS Device', amount: 'Amount', notes_optional: 'Notes (optional)',
    remove: 'Remove', network_total: 'Network Total',
    customer_credit: 'Customer Credit Sales',
    credit_customer: 'Customer Name', credit_amount: 'Credit Amount', add_credit: 'Add Credit Entry',
    sales_total: 'Sales Total', total: 'Total',
    optional: 'optional', proof: 'Network Proof', ocr_detected: 'OCR detected',
    notes: 'Notes',
  },
  ar: {
    date: 'التاريخ', branch: 'الفرع', save: 'حفظ', cancel: 'إلغاء',
    cash_register: 'صندوق النقد',
    opening_cash: 'رصيد الافتتاح',
    closing_cash: 'رصيد الإغلاق',
    cash_difference: 'الفرق النقدي',
    cash_status: 'حالة النقد',
    cash_notes: 'ملاحظات النقد',
    balanced: 'متوازن',
    shortage: 'عجز',
    overage: 'زيادة',
    network_sales: 'مبيعات الشبكة', add_pos: 'إضافة جهاز POS',
    pos_device: 'جهاز POS', amount: 'المبلغ', notes_optional: 'ملاحظات (اختياري)',
    remove: 'حذف', network_total: 'إجمالي الشبكة',
    customer_credit: 'مبيعات العملاء الآجلة',
    credit_customer: 'اسم العميل', credit_amount: 'مبلغ الآجل', add_credit: 'إضافة قيد آجل',
    sales_total: 'إجمالي المبيعات', total: 'المجموع',
    optional: 'اختياري', proof: 'إثبات الشبكة', ocr_detected: 'تم اكتشاف مبلغ',
    notes: 'ملاحظات',
  },
  fa: {
    date: 'تاریخ', branch: 'فرع', save: 'ذخیره', cancel: 'لغو',
    cash_register: 'صندوق نقد',
    opening_cash: 'موجودی ابتدا',
    closing_cash: 'موجودی پایان',
    cash_difference: 'اختلاف نقدی',
    cash_status: 'وضعیت نقد',
    cash_notes: 'یادداشت نقد',
    balanced: 'متعادل',
    shortage: 'کسری',
    overage: 'مازاد',
    network_sales: 'فروش شبکه', add_pos: 'افزودن دستگاه POS',
    pos_device: 'دستگاه POS', amount: 'مبلغ', notes_optional: 'یادداشت (اختیاری)',
    remove: 'حذف', network_total: 'جمع شبکه',
    customer_credit: 'فروش نسیه مشتری',
    credit_customer: 'نام مشتری', credit_amount: 'مبلغ نسیه', add_credit: 'افزودن نسیه',
    sales_total: 'جمع فروش', total: 'جمع کل',
    optional: 'اختياري', proof: 'رسید شبکه', ocr_detected: 'مبلغ شناسایی شد',
    notes: 'یادداشت',
  },
};

function NumInput({ label, value, onChange, readOnly = false, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/60'}`}>
      <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{label}</p>
      <Input
        type="number" inputMode="decimal" step="0.01"
        value={value || ''}
        placeholder="0"
        readOnly={readOnly}
        onChange={e => onChange && onChange(e.target.value)}
        className={`text-2xl h-14 font-bold text-center border-0 bg-transparent focus-visible:ring-0 p-0 ${readOnly ? 'cursor-default text-primary' : ''}`}
      />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, total, currency }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold">{title}</span>
      {total !== undefined && (
        <span className="ms-auto text-xs text-primary font-bold">{currency}{Number(total).toLocaleString()}</span>
      )}
    </div>
  );
}

function CashStatusBadge({ status, lbl }) {
  if (!status) return null;
  const config = {
    Balanced: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    Shortage: { color: 'bg-red-100 text-red-700 border-red-200', icon: TrendingDown },
    Overage: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: TrendingUp },
  };
  const c = config[status] || config.Balanced;
  const Icon = c.icon;
  const label = lbl[status.toLowerCase()] || status;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </span>
  );
}

export default function SalesForm({ initial, onSubmit, onCancel }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { managerBranch, branches } = useTenant();
  const defaultBranch = initial?.branch || managerBranch || branches[0]?.key || '';

  const parsePosEntries = () => {
    if (initial?.pos_entries_json) {
      try { return JSON.parse(initial.pos_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    const legacyNet = initial?.restaurant_network ?? initial?.network ?? 0;
    if (legacyNet > 0) {
      return [{ id: Date.now(), device_id: initial?.restaurant_network_account_id || '', amount: legacyNet, notes: '' }];
    }
    return [];
  };

  const parseCreditEntries = () => {
    if (initial?.credit_entries_json) {
      try { return JSON.parse(initial.credit_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    const legacyCredit = initial?.credit ?? 0;
    if (legacyCredit > 0) {
      return [{ id: Date.now(), customer: '', amount: legacyCredit, notes: '' }];
    }
    return [];
  };

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    branch: defaultBranch,
    notes: '',
    ...initial,
  });

  // Cash Register fields
  const [openingCash, setOpeningCash] = useState(initial?.opening_cash ?? '');
  const [closingCash, setClosingCash] = useState(initial?.closing_cash ?? '');
  const [cashNotes, setCashNotes] = useState(initial?.cash_notes || '');

  // POS / Network
  const [posEntries, setPosEntries] = useState(parsePosEntries);
  const [proofUrl, setProofUrl] = useState(initial?.proof_url || '');
  const [ocrData, setOcrData] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);

  // Customer Credit
  const [creditEntries, setCreditEntries] = useState(parseCreditEntries);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // POS helpers
  const addPos = () => setPosEntries(prev => [...prev, { id: Date.now(), device_id: '', amount: '', notes: '' }]);
  const removePos = (id) => setPosEntries(prev => prev.filter(e => e.id !== id));
  const updatePos = (id, field, value) => setPosEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  // Credit helpers
  const addCredit = () => setCreditEntries(prev => [...prev, { id: Date.now(), customer: '', amount: '', notes: '' }]);
  const removeCredit = (id) => setCreditEntries(prev => prev.filter(e => e.id !== id));
  const updateCredit = (id, field, value) => setCreditEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const handleOcrResult = ({ file_url, ocr }) => {
    setProofUrl(file_url);
    setOcrData(ocr);
    if (ocr?.amount && posEntries.length > 0) {
      const lastId = posEntries[posEntries.length - 1].id;
      updatePos(lastId, 'amount', ocr.amount);
    }
  };

  // Computed values
  const opening = Number(openingCash) || 0;
  const closing = Number(closingCash) || 0;
  const cashDifference = useMemo(() => {
    if (!openingCash && !closingCash) return null;
    return closing - opening;
  }, [opening, closing, openingCash, closingCash]);

  const cashStatus = useMemo(() => {
    if (cashDifference === null) return null;
    if (cashDifference === 0) return 'Balanced';
    if (cashDifference < 0) return 'Shortage';
    return 'Overage';
  }, [cashDifference]);

  const networkTotal = posEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const creditTotal = creditEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Grand total = closing cash (actual cash on hand) + network + credit
  const grandTotal = closing + networkTotal + creditTotal;

  const handleSubmit = (e) => {
    e.preventDefault();

    const firstPos = posEntries[0];
    const payload = {
      ...form,
      // Cash register fields
      opening_cash: opening || 0,
      closing_cash: closing || 0,
      cash_difference: cashDifference ?? 0,
      cash_status: cashStatus || 'Balanced',
      cash_notes: cashNotes || '',
      // Keep backward-compat fields (closing cash = restaurant cash for legacy)
      restaurant_cash: closing || 0,
      restaurant_network: networkTotal,
      restaurant_network_account_id: firstPos?.device_id || '',
      credit: creditTotal,
      pos_entries_json: JSON.stringify(posEntries.map(({ id, ...rest }) => rest)),
      credit_entries_json: JSON.stringify(creditEntries.map(({ id, ...rest }) => rest)),
      cash: closing || 0,
      network: networkTotal,
      driver_cash: 0,
      driver_network: 0,
      driver_name: '',
      driver_employee_id: '',
      driver_network_account_id: '',
      drivers_json: '',
    };
    onSubmit(payload, proofUrl, ocrData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2">
      {/* Date & Branch */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.date}</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-10" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.branch}</Label>
          <BranchSelect value={form.branch} onChange={v => set('branch', v)} />
        </div>
      </div>

      {/* CASH REGISTER */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={Store} title={lbl.cash_register} />
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label={lbl.opening_cash} value={openingCash} onChange={setOpeningCash} />
            <NumInput label={lbl.closing_cash} value={closingCash} onChange={setClosingCash} />
          </div>

          {/* Cash Difference (auto-calculated) */}
          {cashDifference !== null && (
            <div className="rounded-xl p-3 bg-muted/40 border border-border">
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{lbl.cash_difference}</p>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-extrabold ${cashDifference < 0 ? 'text-red-600' : cashDifference > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {cashDifference >= 0 ? '+' : ''}{currency}{Math.abs(cashDifference).toLocaleString()}
                </span>
                <CashStatusBadge status={cashStatus} lbl={lbl} />
              </div>
            </div>
          )}

          {/* Cash Status (read-only display) */}
          {cashStatus && (
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30">
              <span className="text-xs text-muted-foreground font-medium">{lbl.cash_status}</span>
              <CashStatusBadge status={cashStatus} lbl={lbl} />
            </div>
          )}

          {/* Cash Notes */}
          <div>
            <Label className="text-xs text-muted-foreground">{lbl.cash_notes}</Label>
            <Input
              value={cashNotes}
              onChange={e => setCashNotes(e.target.value)}
              placeholder="..."
              className="h-10 mt-1"
            />
          </div>
        </div>
      </div>

      {/* NETWORK SALES */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={Wifi} title={lbl.network_sales} total={networkTotal} currency={currency} />
        <div className="p-3 space-y-3">
          {posEntries.map((entry, idx) => (
            <div key={entry.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">POS #{idx + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePos(entry.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{lbl.pos_device}</Label>
                <NetworkAccountSelect branch={form.branch} value={entry.device_id} onChange={v => updatePos(entry.id, 'device_id', v)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{lbl.amount}</Label>
                  <Input type="number" inputMode="decimal" step="0.01" min="0" value={entry.amount || ''} placeholder="0" onChange={e => updatePos(entry.id, 'amount', e.target.value)} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{lbl.notes_optional}</Label>
                  <Input value={entry.notes || ''} placeholder="..." onChange={e => updatePos(entry.id, 'notes', e.target.value)} className="h-10" />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addPos}>
            <Plus className="w-3.5 h-3.5 mr-1" />{lbl.add_pos}
          </Button>
          {posEntries.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{lbl.proof} ({lbl.optional})</Label>
              <SmartUploadZone fileUrl={proofUrl} onResult={handleOcrResult} onViewImage={() => setZoomImg(proofUrl)} label="Scan receipt" />
              {ocrData?.amount && <p className="text-xs text-emerald-600 mt-1">{lbl.ocr_detected}: {ocrData.amount?.toLocaleString()}</p>}
            </div>
          )}
          {networkTotal > 0 && (
            <div className="flex justify-between items-center bg-primary/5 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground font-medium">{lbl.network_total}</span>
              <span className="text-sm font-bold text-primary">{currency}{networkTotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* CUSTOMER CREDIT SALES */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={CreditCard} title={lbl.customer_credit} total={creditTotal > 0 ? creditTotal : undefined} currency={currency} />
        <div className="p-3 space-y-3">
          {creditEntries.map((entry, idx) => (
            <div key={entry.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCredit(entry.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{lbl.credit_customer}</Label>
                  <Input value={entry.customer || ''} placeholder="..." onChange={e => updateCredit(entry.id, 'customer', e.target.value)} className="h-10" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{lbl.credit_amount}</Label>
                  <Input type="number" inputMode="decimal" step="0.01" min="0" value={entry.amount || ''} placeholder="0" onChange={e => updateCredit(entry.id, 'amount', e.target.value)} className="h-10" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{lbl.notes_optional}</Label>
                <Input value={entry.notes || ''} placeholder="..." onChange={e => updateCredit(entry.id, 'notes', e.target.value)} className="h-10" />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addCredit}>
            <Plus className="w-3.5 h-3.5 mr-1" />{lbl.add_credit}
          </Button>
        </div>
      </div>

      {/* SALES TOTAL SUMMARY */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-primary/10">
          <span className="text-sm font-bold text-primary">{lbl.sales_total}</span>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{lbl.closing_cash}</span>
            <span className="font-semibold">{currency}{closing.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{lbl.network_sales}</span>
            <span className="font-semibold">{currency}{networkTotal.toLocaleString()}</span>
          </div>
          {creditTotal > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{lbl.customer_credit}</span>
              <span className="font-semibold">{currency}{creditTotal.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-primary/20 pt-1.5 flex justify-between items-center">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Receipt className="w-3.5 h-3.5" />{lbl.total}
            </div>
            <p className="text-2xl font-extrabold text-primary">{currency}{grandTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* General Notes */}
      <div className="rounded-xl p-3 bg-muted/60">
        <Label className="text-xs text-muted-foreground">{lbl.notes}</Label>
        <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="h-10 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm mt-1" placeholder="..." />
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1 h-12 text-base font-bold">{lbl.save}</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">{lbl.cancel}</Button>}
      </div>

      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-sm p-2">
          <img src={zoomImg} alt="Proof" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </form>
  );
}
