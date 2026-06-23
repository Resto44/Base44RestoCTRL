/**
 * SalesForm — Professional Restaurant ERP Sales Entry
 *
 * SALES CALCULATION:
 *   Cash Sales = Closing Cash - Opening Cash
 *   Today's Sales = Cash Sales + Network Sales + Customer Credit Sales
 *
 * FIELDS:
 *   Opening Cash (required) | Closing Cash (required)
 *   Cash Difference (auto) | Cash Status (auto: Balanced/Shortage/Overage)
 *   Cash Notes | Shift (Morning/Evening) | Cashier Name | Sales Notes
 *   Manager Approval (when shortage exceeds threshold)
 *   Network Sales (multiple POS devices)
 *   Customer Credit Sales (from Debt Management)
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BranchSelect from '@/components/shared/BranchSelect';
import NetworkAccountSelect from '@/components/network/NetworkAccountSelect';
import SmartUploadZone from '@/components/shared/SmartUploadZone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  Store, Receipt, Plus, Trash2, Wifi, CreditCard,
  CheckCircle2, TrendingUp, TrendingDown, User, Clock,
  AlertCircle, ShieldCheck, Search
} from 'lucide-react';

// Manager approval threshold — shortages above this amount require approval
const MANAGER_APPROVAL_THRESHOLD = 50;

const LABELS = {
  en: {
    date: 'Date', branch: 'Branch', save: 'Save', cancel: 'Cancel',
    cash_register: 'Cash Register',
    opening_cash: 'Opening Cash (Required)',
    closing_cash: 'Closing Cash (Required)',
    cash_difference: 'Cash Difference (Auto)',
    cash_status: 'Cash Status',
    cash_notes: 'Cash Notes',
    balanced: 'Balanced', shortage: 'Shortage', overage: 'Overage',
    shift: 'Shift', morning: 'Morning', evening: 'Evening',
    cashier_name: 'Cashier Name',
    sales_notes: 'Sales Notes',
    manager_approval: 'Manager Approval Required',
    manager_approved: 'Shortage Approved',
    approval_note: 'Shortage exceeds threshold — manager approval required',
    network_sales: 'Network Sales', add_pos: 'Add POS Device',
    pos_device: 'POS Device', amount: 'Amount', notes_optional: 'Notes (optional)',
    remove: 'Remove', network_total: 'Network Total',
    customer_credit: 'Customer Credit Sales',
    search_customer: 'Search customer by name or phone...',
    select_customer: 'Select Customer',
    current_debt: 'Current Debt',
    credit_limit: 'Credit Limit',
    available_credit: 'Available Credit',
    credit_amount: 'Credit Amount', add_credit: 'Add Credit Entry',
    sales_total: 'Sales Total', total: 'Total',
    cash_sales: 'Cash Sales (Closing − Opening)',
    optional: 'optional', proof: 'Network Proof', ocr_detected: 'OCR detected',
    notes: 'Notes',
  },
  ar: {
    date: 'التاريخ', branch: 'الفرع', save: 'حفظ', cancel: 'إلغاء',
    cash_register: 'صندوق النقد',
    opening_cash: 'رصيد الافتتاح (مطلوب)',
    closing_cash: 'رصيد الإغلاق (مطلوب)',
    cash_difference: 'الفرق النقدي (تلقائي)',
    cash_status: 'حالة النقد',
    cash_notes: 'ملاحظات النقد',
    balanced: 'متوازن', shortage: 'عجز', overage: 'زيادة',
    shift: 'الوردية', morning: 'صباحية', evening: 'مسائية',
    cashier_name: 'اسم الكاشير',
    sales_notes: 'ملاحظات المبيعات',
    manager_approval: 'يتطلب موافقة المدير',
    manager_approved: 'تمت الموافقة على العجز',
    approval_note: 'العجز يتجاوز الحد — يلزم موافقة المدير',
    network_sales: 'مبيعات الشبكة', add_pos: 'إضافة جهاز POS',
    pos_device: 'جهاز POS', amount: 'المبلغ', notes_optional: 'ملاحظات (اختياري)',
    remove: 'حذف', network_total: 'إجمالي الشبكة',
    customer_credit: 'مبيعات العملاء الآجلة',
    search_customer: 'ابحث عن عميل بالاسم أو الهاتف...',
    select_customer: 'اختر العميل',
    current_debt: 'الدين الحالي',
    credit_limit: 'حد الائتمان',
    available_credit: 'الائتمان المتاح',
    credit_amount: 'مبلغ الآجل', add_credit: 'إضافة قيد آجل',
    sales_total: 'إجمالي المبيعات', total: 'المجموع',
    cash_sales: 'المبيعات النقدية (إغلاق − افتتاح)',
    optional: 'اختياري', proof: 'إثبات الشبكة', ocr_detected: 'تم اكتشاف مبلغ',
    notes: 'ملاحظات',
  },
  fa: {
    date: 'تاریخ', branch: 'فرع', save: 'ذخیره', cancel: 'لغو',
    cash_register: 'صندوق نقد',
    opening_cash: 'موجودی ابتدا (الزامی)',
    closing_cash: 'موجودی پایان (الزامی)',
    cash_difference: 'اختلاف نقدی (خودکار)',
    cash_status: 'وضعیت نقد',
    cash_notes: 'یادداشت نقد',
    balanced: 'متعادل', shortage: 'کسری', overage: 'مازاد',
    shift: 'شیفت', morning: 'صبح', evening: 'عصر',
    cashier_name: 'نام صندوقدار',
    sales_notes: 'یادداشت فروش',
    manager_approval: 'تأیید مدیر لازم است',
    manager_approved: 'کسری تأیید شد',
    approval_note: 'کسری از حد مجاز بیشتر است — تأیید مدیر لازم است',
    network_sales: 'فروش شبکه', add_pos: 'افزودن دستگاه POS',
    pos_device: 'دستگاه POS', amount: 'مبلغ', notes_optional: 'یادداشت (اختیاری)',
    remove: 'حذف', network_total: 'جمع شبکه',
    customer_credit: 'فروش نسیه مشتری',
    search_customer: 'جستجوی مشتری بر اساس نام یا تلفن...',
    select_customer: 'انتخاب مشتری',
    current_debt: 'بدهی فعلی',
    credit_limit: 'سقف اعتبار',
    available_credit: 'اعتبار موجود',
    credit_amount: 'مبلغ نسیه', add_credit: 'افزودن نسیه',
    sales_total: 'جمع فروش', total: 'جمع کل',
    cash_sales: 'فروش نقدی (پایان − ابتدا)',
    optional: 'اختياري', proof: 'رسید شبکه', ocr_detected: 'مبلغ شناسایی شد',
    notes: 'یادداشت',
  },
};

function NumInput({ label, value, onChange, readOnly = false, highlight, required = false }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/60'}`}>
      <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <Input
        type="number" inputMode="decimal" step="0.01"
        value={value || ''}
        placeholder="0"
        readOnly={readOnly}
        required={required}
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

// ── Customer Credit Entry with Debt Management integration ────────────────────
function CustomerCreditEntry({ entry, idx, onRemove, onUpdate, customers, currency, lbl }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedCustomer = customers.find(c => c.id === entry.customer_id);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.party_name || '').toLowerCase().includes(q) ||
      (c.party_phone || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [customers, searchQuery]);

  const handleSelectCustomer = (customer) => {
    onUpdate(entry.id, 'customer_id', customer.id);
    onUpdate(entry.id, 'customer', customer.party_name);
    onUpdate(entry.id, 'customer_phone', customer.party_phone || '');
    onUpdate(entry.id, 'current_debt', customer.remaining_amount || 0);
    onUpdate(entry.id, 'credit_limit', customer.credit_limit || 0);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const availableCredit = (selectedCustomer?.credit_limit || entry.credit_limit || 0) - (selectedCustomer?.remaining_amount || entry.current_debt || 0);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(entry.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Customer Search */}
      <div className="relative">
        <Label className="text-xs text-muted-foreground">{lbl.select_customer}</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={selectedCustomer ? selectedCustomer.party_name : searchQuery}
            placeholder={lbl.search_customer}
            className="h-10 pl-8"
            onChange={e => {
              setSearchQuery(e.target.value);
              if (selectedCustomer) {
                onUpdate(entry.id, 'customer_id', '');
                onUpdate(entry.id, 'customer', '');
              }
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
        </div>
        {showDropdown && filteredCustomers.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredCustomers.map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border last:border-0"
                onClick={() => handleSelectCustomer(c)}
              >
                <p className="font-medium text-foreground">{c.party_name}</p>
                {c.party_phone && <p className="text-xs text-muted-foreground">{c.party_phone}</p>}
              </button>
            ))}
          </div>
        )}
        {showDropdown && filteredCustomers.length === 0 && searchQuery && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg p-3">
            <p className="text-xs text-muted-foreground text-center">No customers found</p>
          </div>
        )}
      </div>

      {/* Customer Debt Info */}
      {selectedCustomer && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">{lbl.current_debt}</p>
            <p className="text-xs font-bold text-red-600">{currency}{(selectedCustomer.remaining_amount || 0).toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">{lbl.credit_limit}</p>
            <p className="text-xs font-bold text-blue-600">{currency}{(selectedCustomer.credit_limit || 0).toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">{lbl.available_credit}</p>
            <p className={`text-xs font-bold ${availableCredit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {currency}{availableCredit.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Credit Amount */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.credit_amount}</Label>
          <Input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={entry.amount || ''}
            placeholder="0"
            onChange={e => onUpdate(entry.id, 'amount', e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.notes_optional}</Label>
          <Input
            value={entry.notes || ''}
            placeholder="..."
            onChange={e => onUpdate(entry.id, 'notes', e.target.value)}
            className="h-10"
          />
        </div>
      </div>
    </div>
  );
}

export default function SalesForm({ initial, onSubmit, onCancel }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { managerBranch, branches, ownerFilter } = useTenant();
  const { user } = useAuth();
  const defaultBranch = initial?.branch || managerBranch || branches[0]?.key || '';

  // ── Load customers from Debt Management ──────────────────────────────────────
  const { data: customers = [] } = useQuery({
    queryKey: ['debt_customers_form', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter(
      { ...(ownerFilter || {}), type: 'receivable', party_type: 'customer' },
      'party_name', 500
    ),
    staleTime: 30000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

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
      return [{ id: Date.now(), customer_id: '', customer: '', amount: legacyCredit, notes: '' }];
    }
    return [];
  };

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    branch: defaultBranch,
    shift: 'Morning',
    cashier_name: '',
    sales_notes: '',
    ...initial,
  });

  // Cash Register fields
  const [openingCash, setOpeningCash] = useState(initial?.opening_cash ?? '');
  const [closingCash, setClosingCash] = useState(initial?.closing_cash ?? '');
  const [cashNotes, setCashNotes] = useState(initial?.cash_notes || '');
  const [managerApproved, setManagerApproved] = useState(initial?.manager_approval || false);

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
  const addCredit = () => setCreditEntries(prev => [...prev, { id: Date.now(), customer_id: '', customer: '', amount: '', notes: '' }]);
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

  // ── Computed values ──────────────────────────────────────────────────────────
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

  // Cash Sales = Closing Cash - Opening Cash
  const cashSales = useMemo(() => {
    if (cashDifference === null) return closing; // fallback: use closing if no opening
    return Math.max(0, cashDifference); // only positive difference counts as sales
  }, [cashDifference, closing]);

  const networkTotal = posEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const creditTotal = creditEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Grand total = Cash Sales + Network + Credit
  const grandTotal = cashSales + networkTotal + creditTotal;

  // Manager approval required when shortage exceeds threshold
  const needsManagerApproval = cashStatus === 'Shortage' && Math.abs(cashDifference || 0) > MANAGER_APPROVAL_THRESHOLD;

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
      // Shift & cashier
      shift: form.shift || 'Morning',
      cashier_name: form.cashier_name || '',
      sales_notes: form.sales_notes || '',
      // Manager approval
      manager_approval: managerApproved,
      manager_approved_by: managerApproved ? (user?.email || '') : '',
      // Sales amounts (correct formula: cash sales = closing - opening)
      restaurant_cash: cashSales,  // Cash Sales = Closing - Opening
      restaurant_network: networkTotal,
      restaurant_network_account_id: firstPos?.device_id || '',
      credit: creditTotal,
      // Legacy backward-compat fields
      cash: cashSales,
      network: networkTotal,
      // JSON entries
      pos_entries_json: JSON.stringify(posEntries.map(({ id, ...rest }) => rest)),
      credit_entries_json: JSON.stringify(creditEntries.map(({ id, ...rest }) => rest)),
      proof_url: proofUrl || '',
      // Driver fields (zero for counter sales)
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

      {/* ── CASH REGISTER ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={Store} title={lbl.cash_register} />
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label={lbl.opening_cash} value={openingCash} onChange={setOpeningCash} required />
            <NumInput label={lbl.closing_cash} value={closingCash} onChange={setClosingCash} required />
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

          {/* Cash Status */}
          {cashStatus && (
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30">
              <span className="text-xs text-muted-foreground font-medium">{lbl.cash_status}</span>
              <CashStatusBadge status={cashStatus} lbl={lbl} />
            </div>
          )}

          {/* Manager Approval (when shortage exceeds threshold) */}
          {needsManagerApproval && (
            <div className={`rounded-xl p-3 border ${managerApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2 mb-2">
                {managerApproved
                  ? <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                }
                <p className={`text-xs font-semibold ${managerApproved ? 'text-emerald-700' : 'text-red-700'}`}>
                  {managerApproved ? lbl.manager_approved : lbl.manager_approval}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{lbl.approval_note}</p>
              <Button
                type="button"
                size="sm"
                variant={managerApproved ? 'outline' : 'default'}
                className={`w-full h-9 ${managerApproved ? 'border-emerald-300 text-emerald-700' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                onClick={() => setManagerApproved(v => !v)}
              >
                {managerApproved ? '✓ Approved' : 'Approve Shortage'}
              </Button>
            </div>
          )}

          {/* Cash Notes */}
          <div>
            <Label className="text-xs text-muted-foreground">{lbl.cash_notes}</Label>
            <Input value={cashNotes} onChange={e => setCashNotes(e.target.value)} placeholder="..." className="h-10 mt-1" />
          </div>
        </div>
      </div>

      {/* ── SHIFT & CASHIER ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={Clock} title={`${lbl.shift} & ${lbl.cashier_name}`} />
        <div className="p-3 space-y-3">
          {/* Shift selector */}
          <div>
            <Label className="text-xs text-muted-foreground">{lbl.shift}</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['Morning', 'Evening'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('shift', s)}
                  className={`h-10 rounded-lg text-sm font-semibold border transition-all ${
                    form.shift === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {s === 'Morning' ? lbl.morning : lbl.evening}
                </button>
              ))}
            </div>
          </div>
          {/* Cashier Name */}
          <div>
            <Label className="text-xs text-muted-foreground">{lbl.cashier_name}</Label>
            <div className="relative mt-1">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={form.cashier_name || ''}
                onChange={e => set('cashier_name', e.target.value)}
                placeholder="..."
                className="h-10 pl-8"
              />
            </div>
          </div>
          {/* Sales Notes */}
          <div>
            <Label className="text-xs text-muted-foreground">{lbl.sales_notes}</Label>
            <Input
              value={form.sales_notes || ''}
              onChange={e => set('sales_notes', e.target.value)}
              placeholder="..."
              className="h-10 mt-1"
            />
          </div>
        </div>
      </div>

      {/* ── NETWORK SALES ── */}
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

      {/* ── CUSTOMER CREDIT SALES ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SectionHeader icon={CreditCard} title={lbl.customer_credit} total={creditTotal > 0 ? creditTotal : undefined} currency={currency} />
        <div className="p-3 space-y-3">
          {creditEntries.map((entry, idx) => (
            <CustomerCreditEntry
              key={entry.id}
              entry={entry}
              idx={idx}
              onRemove={removeCredit}
              onUpdate={updateCredit}
              customers={customers}
              currency={currency}
              lbl={lbl}
            />
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addCredit}>
            <Plus className="w-3.5 h-3.5 mr-1" />{lbl.add_credit}
          </Button>
        </div>
      </div>

      {/* ── SALES TOTAL SUMMARY ── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
        <div className="px-4 py-2.5 bg-primary/10">
          <span className="text-sm font-bold text-primary">{lbl.sales_total}</span>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{lbl.cash_sales}</span>
            <span className="font-semibold">{currency}{cashSales.toLocaleString()}</span>
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

      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1 h-12 text-base font-bold"
          disabled={needsManagerApproval && !managerApproved}
        >
          {lbl.save}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">{lbl.cancel}</Button>}
      </div>

      {needsManagerApproval && !managerApproved && (
        <p className="text-xs text-red-600 text-center">{lbl.approval_note}</p>
      )}

      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-sm p-2">
          <img src={zoomImg} alt="Proof" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </form>
  );
}
