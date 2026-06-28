/**
 * SalesForm — Daily Sales entry form.
 *
 * Finalized Accounting Rules:
 *  1. Sales Total = Cash Sales + POS Sales + Customer Credit.
 *  2. Never change Sales Total because of cash shortage, overage or owner payments.
 *  3. Expected Cash = Opening Cash + Cash Sales.
 *  4. Cash Difference = Actual Cash - Expected Cash.
 *  5. If Difference < 0 → Cash Shortage.
 *  6. If Difference > 0 → Cash Overage.
 *  7. Owner payment = Owner Capital Contribution, never Sales.
 *  8. Operating Result = Total Sales - Approved Purchases.
 *  9. Opening Cash = Previous Shift Closing Cash (automatic).
 *  10. Closing Cash = Actual Cash + Owner Capital Contribution.
 *  11. Next shift Opening Cash = Previous Closing Cash.
 *  12. Remaining Difference = Closing Cash - Expected Cash.
 *      Shift cannot close until Remaining Difference = 0 or Manager Approval.
 *  13. Sales, Cash Reconciliation, Purchases and Operating Result are independent.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import {
  Store, CreditCard, Trash2, Plus, Search,
  TrendingDown, TrendingUp, CheckCircle2,
  AlertCircle, ShieldCheck, User, Info,
  Scale, Banknote, DollarSign
} from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      {badge}
    </div>
  );
}

function NumInput({ label, value, onChange, required, prefix, placeholder, readOnly, helpText }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{label}</Label>
      {helpText && <p className="text-[9px] text-muted-foreground mb-1">{helpText}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{prefix}</span>}
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={e => onChange && onChange(e.target.value)}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder || '0.00'}
          className={`h-10 ${prefix ? 'pl-8' : ''} text-base md:text-sm font-medium ${readOnly ? 'bg-muted cursor-default' : ''}`}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;
  const cfg = {
    Balanced: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle2, label: 'Balanced' },
    Shortage: { cls: 'bg-red-100 text-red-700 border-red-200', Icon: TrendingDown, label: 'Shortage' },
    Overage:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: TrendingUp, label: 'Overage' },
  };
  const c = cfg[status] || cfg.Balanced;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>
      <c.Icon className="w-3.5 h-3.5" />{c.label}
    </span>
  );
}

// ── Customer Credit Entry ──────────────────────────────────────────────────────
function CustomerCreditEntry({ entry, idx, onRemove, onUpdate, customers, currency }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [customers, searchQuery]);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(entry.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="relative">
        <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Customer</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={entry.customer || searchQuery}
            placeholder="Search customer by name or phone..."
            className="h-10 pl-8 text-base md:text-sm"
            onChange={e => {
              setSearchQuery(e.target.value);
              if (entry.customer) {
                onUpdate(entry.id, 'customer', '');
                onUpdate(entry.id, 'customer_phone', '');
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
                key={c.customer_name}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border last:border-0"
                onClick={() => {
                  onUpdate(entry.id, 'customer', c.customer_name);
                  onUpdate(entry.id, 'customer_phone', c.phone || '');
                  onUpdate(entry.id, 'current_debt', c.outstanding_balance || 0);
                  onUpdate(entry.id, 'credit_limit', c.credit_limit || 0);
                  setShowDropdown(false);
                  setSearchQuery('');
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{c.customer_name}</p>
                    {c.phone && <p className="text-[10px] text-muted-foreground">{c.phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-red-600">{currency}{Number(c.outstanding_balance || 0).toLocaleString()}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Debt</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {entry.customer && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-background rounded-md p-2 border border-border">
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Current Debt</p>
            <p className="text-xs font-bold text-red-600">{currency}{Number(entry.current_debt || 0).toLocaleString()}</p>
          </div>
          <div className="bg-background rounded-md p-2 border border-border">
            <p className="text-[9px] text-muted-foreground uppercase font-bold">Credit Limit</p>
            <p className="text-xs font-bold text-blue-600">{currency}{Number(entry.credit_limit || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <NumInput
        label="Credit Amount"
        value={entry.amount}
        onChange={v => onUpdate(entry.id, 'amount', v)}
        prefix={currency}
      />
      <div className="pt-1">
        <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Notes (optional)</Label>
        <Input
          value={entry.notes}
          onChange={e => onUpdate(entry.id, 'notes', e.target.value)}
          placeholder="..."
          className="h-10 md:h-8 text-base md:text-xs"
        />
      </div>
    </div>
  );
}

// ── Main Form ──────────────────────────────────────────────────────────────────
export default function SalesForm({ initial, onSubmit, onCancel }) {
  const { t, currency } = useLanguage();
  const { user } = useAuth();
  const { ownerFilter, branches, managerBranch, activeRestaurant } = useTenant();

  // ── Form meta state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    date: initial?.date || format(new Date(), 'yyyy-MM-dd'),
    branch: initial?.branch || managerBranch || branches[0]?.key || '',
    shift: initial?.shift || 'Morning',
    cashier_name: initial?.cashier_name || '',
    cashier_employee_id: initial?.cashier_employee_id || '',
    sales_notes: initial?.sales_notes || '',
    ...initial,
  });
  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // ── Section A: Sales Revenue inputs ──────────────────────────────────────────
  const [cashSalesInput, setCashSalesInput] = useState(
    initial?.restaurant_cash !== undefined ? String(initial.restaurant_cash)
      : initial?.cash !== undefined ? String(initial.cash) : ''
  );

  // ── Section B: Cash Reconciliation inputs ───────────────────────────────────
  const [openingCash, setOpeningCash] = useState(initial?.opening_cash ?? '');
  const [actualCashCount, setActualCashCount] = useState(initial?.actual_cash_count ?? '');
  const [ownerContributionInput, setOwnerContributionInput] = useState(initial?.owner_cash_injection ?? '');
  const [cashNotes, setCashNotes] = useState(initial?.cash_notes || '');
  const [managerApproved, setManagerApproved] = useState(initial?.manager_approval || false);

  // ── Employees ────────────────────────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees_cashiers', ownerFilter?.created_by, ownerFilter?.branch, form.branch],
    queryFn: async () => {
      if (!ownerFilter?.created_by && !ownerFilter?.branch) return [];
      const all = await base44.entities.Employee.filter(
        { ...ownerFilter, is_active: true }, 'full_name', 200
      );
      const branchFiltered = form.branch
        ? all.filter(e => !e.branch || e.branch === form.branch || e.branch === 'all')
        : all;
      const CASHIER_ROLES = ['cashier', 'manager', 'owner', 'supervisor', 'admin'];
      return branchFiltered.filter(e => {
        const pos = (e.position || '').toLowerCase();
        return CASHIER_ROLES.some(r => pos.includes(r));
      });
    },
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by || !!ownerFilter?.branch,
  });

  useEffect(() => {
    if (employees.length === 1 && !form.cashier_name) {
      setForm(prev => ({ ...prev, cashier_name: employees[0].full_name, cashier_employee_id: employees[0].id }));
    }
  }, [employees]);

  // Rule 9: Auto-populate Opening Cash from previous shift's Closing Cash
  useEffect(() => {
    if (!initial?.id && openingCash === '' && ownerFilter?.created_by && form.branch) {
      supabase
        .from('daily_sales')
        .select('closing_cash, date, shift')
        .eq('created_by', ownerFilter.created_by)
        .eq('branch', form.branch)
        .order('date', { ascending: false })
        .order('created_date', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            setOpeningCash(data[0].closing_cash ?? 0);
          } else {
            setOpeningCash(0);
          }
        });
    }
  }, [ownerFilter?.created_by, form.branch, initial?.id]);

  // ── POS devices ──────────────────────────────────────────────────────────────
  const { data: posDevices = [] } = useQuery({
    queryKey: ['pos_devices_form', activeRestaurant?.id, ownerFilter?.created_by, form.branch],
    queryFn: async () => {
      const createdBy = ownerFilter?.created_by;
      if (!createdBy) return [];
      const all = await base44.entities.NetworkAccount.filter({ created_by: createdBy }, '-created_date', 200);
      if (!form.branch) return all.filter(a => a.status === 'active' || a.is_active);
      return all.filter(a =>
        (a.status === 'active' || a.is_active) &&
        (!a.branch || a.branch === form.branch || a.branch_id === form.branch)
      );
    },
    staleTime: 30000,
    enabled: !!ownerFilter?.created_by,
  });

  const parsePosEntries = () => {
    if (initial?.pos_entries_json) {
      try { return JSON.parse(initial.pos_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    return [{ id: Date.now(), device_id: '', device_name: '', amount: '', notes: '' }];
  };
  const [posEntries, setPosEntries] = useState(parsePosEntries);

  const parseCreditEntries = () => {
    if (initial?.credit_entries_json) {
      try { return JSON.parse(initial.credit_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    return [];
  };
  const [creditEntries, setCreditEntries] = useState(parseCreditEntries);

  const addPos = () => setPosEntries(prev => [...prev, { id: Date.now(), device_id: '', device_name: '', amount: '', notes: '' }]);
  const removePos = (id) => setPosEntries(prev => prev.filter(e => e.id !== id));
  const updatePos = (id, field, value) => setPosEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  const addCredit = () => setCreditEntries(prev => [...prev, { id: Date.now(), customer: '', amount: '', notes: '' }]);
  const removeCredit = (id) => setCreditEntries(prev => prev.filter(e => e.id !== id));
  const updateCredit = (id, field, value) => setCreditEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  // ── Customers ────────────────────────────────────────────────────────────────
  const { data: customers = [] } = useQuery({
    queryKey: ['v_customer_summary_form', ownerFilter?.created_by],
    queryFn: async () => {
      if (!ownerFilter?.created_by) return [];
      const { data, error } = await supabase
        .from('v_customer_summary')
        .select('*')
        .eq('created_by', ownerFilter.created_by)
        .order('customer_name');
      if (error) return [];
      return data || [];
    },
    staleTime: 30000,
    enabled: !!ownerFilter?.created_by,
  });

  // ── Approved Purchases ───────────────────────────────────────────────────────
  const { data: approvedPurchasesForDate = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ['approved_purchases_for_date', ownerFilter?.created_by, form.date],
    queryFn: async () => {
      if (!ownerFilter?.created_by || !form.date) return [];
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, total_amount, approval_status, date')
        .eq('created_by', ownerFilter.created_by)
        .eq('date', form.date)
        .in('approval_status', ['approved', 'auto_approved'])
        .limit(100);
      if (error) return [];
      return data || [];
    },
    staleTime: 15000,
    enabled: !!ownerFilter?.created_by && !!form.date,
  });

  const hasApprovedPurchases = approvedPurchasesForDate.length > 0;
  const approvedPurchasesTotal = approvedPurchasesForDate.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);

  // ── Section A: Sales Total ──────────────────────────────────────────────────
  const cashSales    = Math.max(0, Number(cashSalesInput) || 0);
  const networkTotal = posEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const creditTotal  = creditEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalSales   = cashSales + networkTotal + creditTotal;

  // ── Section B: Cash Reconciliation ──────────────────────────────────────────
  const opening         = Number(openingCash) || 0;
  const actualCount     = actualCashCount !== '' ? Number(actualCashCount) : null;
  const ownerContrib    = Number(ownerContributionInput) || 0;

  // Rule 3: Expected Cash = Opening Cash + Cash Sales
  const expectedCash = opening + cashSales;

  // Rule 4: Cash Difference = Actual Cash - Expected Cash
  const cashDifference = actualCount !== null ? actualCount - expectedCash : null;

  const cashReconcStatus = useMemo(() => {
    if (cashDifference === null) return null;
    if (cashDifference === 0) return 'Balanced';
    return cashDifference < 0 ? 'Shortage' : 'Overage';
  }, [cashDifference]);

  // Rule 10: Closing Cash = Actual Cash + Owner Capital Contribution
  const closingCash = actualCount !== null ? (actualCount + ownerContrib) : opening;

  // Rule 12: Remaining Difference = Closing Cash - Expected Cash
  const remainingDifference = actualCount !== null ? (closingCash - expectedCash) : null;

  const cashShortageAmount = cashDifference !== null ? Math.max(0, -cashDifference) : 0;
  const cashOverageAmount  = cashDifference !== null ? Math.max(0, cashDifference) : 0;

  const needsManagerApproval = remainingDifference !== 0 && remainingDifference !== null;

  // ── Section C: Operating Result ──────────────────────────────────────────────
  const operatingResult = totalSales - approvedPurchasesTotal;
  const purchasesOwnerContrib = Math.max(0, approvedPurchasesTotal - totalSales);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!hasApprovedPurchases) {
      toast.error("Please record today's purchases before closing daily sales.");
      return;
    }

    // Rule 12: Shift cannot close until Remaining Difference = 0 or Manager Approval is given.
    if (remainingDifference !== 0 && remainingDifference !== null && !managerApproved) {
      toast.error("Cash difference must be balanced (Remaining Difference = 0) or manager approval must be provided.");
      return;
    }

    const invalidCredit = creditEntries.find(en => Number(en.amount) > 0 && !en.customer);
    if (invalidCredit) {
      toast.error('Please select a customer for all credit entries');
      return;
    }

    const payload = {
      ...form,
      restaurant_cash: cashSales,
      cash: cashSales,
      restaurant_network: networkTotal,
      network: networkTotal,
      restaurant_network_account_id: posEntries[0]?.device_id || '',
      credit: creditTotal,
      total_sales: totalSales,
      pos_entries_json: JSON.stringify(posEntries.map(({ id, ...rest }) => rest)),
      credit_entries_json: JSON.stringify(creditEntries.map(({ id, ...rest }) => rest)),
      
      opening_cash: opening,
      closing_cash: closingCash,
      actual_cash_count: actualCount ?? opening,
      expected_cash: expectedCash,
      cash_difference: cashDifference ?? 0,
      remaining_difference: remainingDifference ?? 0,
      cash_shortage_amount: cashShortageAmount,
      cash_overage_amount: cashOverageAmount,
      cash_status: cashReconcStatus || 'Balanced',
      cash_notes: cashNotes || '',
      owner_cash_injection: ownerContrib,
      manager_approval: managerApproved,
      manager_approved_by: managerApproved ? (user?.email || '') : '',

      approved_purchases_total: approvedPurchasesTotal,
      daily_operating_result: operatingResult,
      owner_capital_contribution: purchasesOwnerContrib,
      
      restaurant_id: activeRestaurant?.id || null,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2 max-w-full overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Date</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-10 text-base md:text-sm" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Branch</Label>
          <BranchSelect value={form.branch} onChange={v => set('branch', v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Shift</Label>
          <Select value={form.shift} onValueChange={v => set('shift', v)}>
            <SelectTrigger className="h-10 text-base md:text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Cashier</Label>
          <Select
            value={form.cashier_employee_id || ''}
            onValueChange={id => {
              const emp = employees.find(e => e.id === id);
              if (emp) setForm(prev => ({ ...prev, cashier_employee_id: id, cashier_name: emp.full_name }));
            }}
          >
            <SelectTrigger className="h-10 text-base md:text-sm">
              <SelectValue placeholder="Select cashier..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SECTION A — SALES REVENUE */}
      <div className="rounded-xl border-2 border-blue-200 overflow-hidden bg-background shadow-sm">
        <SectionHeader icon={DollarSign} title="Sales Revenue" badge={<Badge className="bg-blue-600">{currency}{totalSales.toLocaleString()}</Badge>} />
        <div className="p-3 space-y-3">
          <NumInput label="Cash Sales" value={cashSalesInput} onChange={setCashSalesInput} prefix={currency} helpText="Actual cash revenue collected" />
          
          <div className="rounded-xl border border-border overflow-hidden">
            <SectionHeader icon={CreditCard} title="Network / POS Sales" badge={<Badge variant="outline">{currency}{networkTotal.toLocaleString()}</Badge>} />
            <div className="p-3 space-y-3">
              {posEntries.map((entry, idx) => (
                <div key={entry.id} className="bg-muted/30 p-2 rounded-lg border border-border/50 space-y-2">
                  <Select
                    value={entry.device_id || '__manual__'}
                    onValueChange={v => {
                      if (v === '__manual__') {
                        updatePos(entry.id, 'device_id', '');
                        updatePos(entry.id, 'device_name', 'Manual Network Entry');
                      } else {
                        const d = posDevices.find(pd => pd.id === v);
                        updatePos(entry.id, 'device_id', v);
                        updatePos(entry.id, 'device_name', d?.account_name || d?.device_name || '');
                      }
                    }}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select POS device..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">Manual Entry</SelectItem>
                      {posDevices.map(d => <SelectItem key={d.id} value={d.id}>{d.account_name || d.device_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <NumInput label="Amount" value={entry.amount} onChange={v => updatePos(entry.id, 'amount', v)} prefix={currency} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-10 text-destructive" onClick={() => removePos(entry.id)} disabled={posEntries.length === 1}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full h-10 border-dashed" onClick={addPos}><Plus className="w-3 h-3 mr-1" /> Add POS</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <SectionHeader icon={User} title="Customer Credit Sales" badge={<Badge variant="outline">{currency}{creditTotal.toLocaleString()}</Badge>} />
            <div className="p-3 space-y-3">
              {creditEntries.map((entry, idx) => (
                <CustomerCreditEntry key={entry.id} entry={entry} idx={idx} onRemove={removeCredit} onUpdate={updateCredit} customers={customers} currency={currency} />
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full h-10 border-dashed" onClick={addCredit}><Plus className="w-3 h-3 mr-1" /> Add Credit</Button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B — CASH RECONCILIATION */}
      <div className="rounded-xl border-2 border-amber-200 overflow-hidden bg-background shadow-sm">
        <SectionHeader icon={Scale} title="Cash Reconciliation" />
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Opening Cash" value={openingCash} onChange={setOpeningCash} prefix={currency} helpText="Auto-fetched from prev shift" />
            <NumInput label="Expected Cash" value={expectedCash} readOnly prefix={currency} helpText="Opening + Cash Sales" />
          </div>
          <NumInput label="Actual Cash Count" value={actualCashCount} onChange={setActualCashCount} prefix={currency} helpText="Physical count in register" />
          
          {cashDifference !== null && (
            <div className={`rounded-xl p-3 border ${cashReconcStatus === 'Shortage' ? 'bg-red-50 border-red-200' : cashReconcStatus === 'Overage' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Cash Difference</p>
                <StatusBadge status={cashReconcStatus} />
              </div>
              <p className={`text-xl font-black ${cashDifference < 0 ? 'text-red-600' : cashDifference > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {cashDifference >= 0 ? '+' : ''}{currency}{Math.abs(cashDifference).toLocaleString()}
              </p>
            </div>
          )}

          {cashReconcStatus === 'Shortage' && (
            <NumInput label="Owner Capital Contribution" value={ownerContributionInput} onChange={setOwnerContributionInput} prefix={currency} helpText="Owner paid to cover shortage" />
          )}

          {actualCount !== null && (
            <div className={`rounded-xl p-3 border ${remainingDifference === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">Remaining Difference</span>
                <span className={`text-lg font-black ${remainingDifference === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {remainingDifference >= 0 ? '+' : ''}{currency}{Math.abs(remainingDifference).toLocaleString()}
                </span>
              </div>
              {remainingDifference !== 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Button type="button" size="sm" variant={managerApproved ? 'default' : 'destructive'} className="w-full h-8 text-xs" onClick={() => setManagerApproved(!managerApproved)}>
                    {managerApproved ? 'Approved by Manager' : 'Require Manager Approval'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="bg-muted/30 rounded-lg p-2 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Closing Cash (for next shift)</span>
            <span className="text-sm font-bold text-foreground">{currency}{closingCash.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* SECTION C — OPERATING RESULT */}
      {hasApprovedPurchases && (
        <div className="rounded-xl border-2 border-emerald-200 overflow-hidden bg-background shadow-sm">
          <SectionHeader icon={Info} title="Operating Result" />
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between text-xs"><span>Total Sales</span><span className="font-bold text-blue-700">{currency}{totalSales.toLocaleString()}</span></div>
            <div className="flex justify-between text-xs"><span>Approved Purchases</span><span className="font-bold text-orange-600">{currency}{approvedPurchasesTotal.toLocaleString()}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold uppercase text-muted-foreground">Operating Result</span>
              <span className={`text-xl font-black ${operatingResult >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {operatingResult >= 0 ? '+' : ''}{currency}{operatingResult.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="button" variant="outline" className="h-12 font-bold" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="h-12 font-bold bg-primary" disabled={purchasesLoading || (remainingDifference !== 0 && remainingDifference !== null && !managerApproved)}>Save</Button>
      </div>
    </form>
  );
}
