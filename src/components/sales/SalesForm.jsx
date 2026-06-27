/**
 * SalesForm — Daily Sales entry form.
 *
 * Accounting rules enforced here:
 *  1. Total Sales = Cash Sales + Network/POS Sales + Customer Credit Sales
 *     Sales are NEVER affected by cash shortage, overage, or owner payments.
 *  2. Cash Reconciliation is a SEPARATE block:
 *       Opening Cash
 *       Cash Sales  (entered directly — the actual cash revenue)
 *       Expected Cash = Opening Cash + Cash Sales
 *       Actual Cash Count (physical count)
 *       Cash Difference = Actual − Expected
 *       → Shortage if Actual < Expected  (does NOT reduce Sales)
 *       → Overage  if Actual > Expected  (does NOT increase Sales)
 *       Owner Capital Contribution = amount owner paid to cover shortage
 *  3. Operating Result = Total Sales − Approved Purchases (shown read-only)
 *  4. If Purchases > Sales → Operating Loss + Owner Capital Contribution stored
 *     separately (never classified as sales revenue).
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

  // ── Section A: Sales Revenue inputs (independent of reconciliation) ──────────
  // Cash Sales = the actual cash revenue collected (entered directly by cashier)
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

  // ── Employees (cashier dropdown) ─────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees_cashiers', ownerFilter?.created_by, form.branch],
    queryFn: async () => {
      if (!ownerFilter?.created_by) return [];
      const all = await base44.entities.Employee.filter(
        { created_by: ownerFilter.created_by, is_active: true }, 'full_name', 200
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
    enabled: !!ownerFilter?.created_by,
  });

  useEffect(() => {
    if (employees.length === 1 && !form.cashier_name) {
      setForm(prev => ({ ...prev, cashier_name: employees[0].full_name, cashier_employee_id: employees[0].id }));
    }
  }, [employees]);

  useEffect(() => {
    if (employees.length > 0 && form.cashier_name) {
      const stillValid = employees.some(e => e.full_name === form.cashier_name);
      if (!stillValid) {
        setForm(prev => ({
          ...prev,
          cashier_name: employees.length === 1 ? employees[0].full_name : '',
          cashier_employee_id: employees.length === 1 ? employees[0].id : '',
        }));
      }
    }
  }, [form.branch, employees]);

  // Auto-populate Opening Cash from previous record
  useEffect(() => {
    if (!initial?.id && openingCash === '' && ownerFilter?.created_by) {
      supabase
        .from('daily_sales')
        .select('closing_cash, actual_cash_count')
        .eq('created_by', ownerFilter.created_by)
        .eq('branch', form.branch)
        .order('date', { ascending: false })
        .order('created_date', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            // Opening = previous actual cash count (or closing_cash as fallback)
            setOpeningCash(data[0].actual_cash_count ?? data[0].closing_cash ?? 0);
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
  const [proofUrl, setProofUrl] = useState(initial?.proof_url || '');
  const [ocrData, setOcrData] = useState(null);

  useEffect(() => {
    if (posDevices.length === 1 && posEntries.length === 1 && !posEntries[0].device_id && !posEntries[0].amount) {
      setPosEntries([{
        id: posEntries[0].id,
        device_id: posDevices[0].id,
        device_name: posDevices[0].account_name || posDevices[0].device_name || '',
        amount: '', notes: '',
      }]);
    }
  }, [posDevices]);

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

  // ── Approved Purchases for the selected date ─────────────────────────────────
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

  // ── Section A: Sales Total (NEVER affected by reconciliation) ────────────────
  const cashSales   = Math.max(0, Number(cashSalesInput) || 0);
  const networkTotal = posEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const creditTotal  = creditEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  // Total Sales = Cash Sales + Network + Credit  ← the only correct formula
  const totalSales  = cashSales + networkTotal + creditTotal;

  // ── Section B: Cash Reconciliation (separate from sales) ────────────────────
  const opening         = Number(openingCash) || 0;
  const actualCount     = actualCashCount !== '' ? Number(actualCashCount) : null;
  const ownerContrib    = Number(ownerContributionInput) || 0;

  // Expected Cash = Opening Cash + Cash Sales
  const expectedCash = opening + cashSales;

  // Cash Difference = Actual − Expected  (null when actual not yet entered)
  const cashDifference = actualCount !== null ? actualCount - expectedCash : null;

  const cashReconcStatus = useMemo(() => {
    if (cashDifference === null) return null;
    if (cashDifference === 0) return 'Balanced';
    return cashDifference < 0 ? 'Shortage' : 'Overage';
  }, [cashDifference]);

  // Cash Shortage = max(0, -(cashDifference))  when actual < expected
  const cashShortageAmount = cashDifference !== null ? Math.max(0, -cashDifference) : 0;
  // Cash Overage  = max(0, cashDifference)     when actual > expected
  const cashOverageAmount  = cashDifference !== null ? Math.max(0, cashDifference) : 0;

  // After owner contribution, effective cash difference = 0 (balanced)
  const effectiveCashDiff = cashDifference !== null
    ? cashDifference + ownerContrib   // owner tops up the shortage
    : null;

  const needsManagerApproval = cashReconcStatus === 'Shortage' && cashShortageAmount > 50;

  // ── Section C: Operating Result ──────────────────────────────────────────────
  // Operating Result = Total Sales − Approved Purchases
  const operatingResult = totalSales - approvedPurchasesTotal;
  // If Purchases > Sales → operating loss; owner capital contribution from purchases side
  const purchasesOwnerContrib = Math.max(0, approvedPurchasesTotal - totalSales);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    // Block save if no approved purchase for this date
    if (!hasApprovedPurchases) {
      toast.error("Please record today's purchases before closing daily sales.");
      return;
    }

    const invalidCredit = creditEntries.find(en => Number(en.amount) > 0 && !en.customer);
    if (invalidCredit) {
      toast.error('Please select a customer for all credit entries');
      return;
    }

    const firstPos = posEntries[0];

    const payload = {
      ...form,
      // ── Section A: Sales (source of truth — never modified by reconciliation) ──
      restaurant_cash: cashSales,
      cash: cashSales,
      restaurant_network: networkTotal,
      network: networkTotal,
      restaurant_network_account_id: firstPos?.device_id || '',
      credit: creditTotal,
      total_sales: totalSales,
      pos_entries_json: JSON.stringify(posEntries.map(({ id, ...rest }) => rest)),
      credit_entries_json: JSON.stringify(creditEntries.map(({ id, ...rest }) => rest)),
      proof_url: proofUrl || '',

      // ── Section B: Cash Reconciliation (separate — does not affect sales) ─────
      opening_cash: opening,
      // closing_cash kept for backward compat — set to actual count
      closing_cash: actualCount ?? opening,
      actual_cash_count: actualCount ?? opening,
      expected_cash: expectedCash,
      cash_difference: cashDifference ?? 0,
      cash_shortage_amount: cashShortageAmount,
      cash_overage_amount: cashOverageAmount,
      cash_status: cashReconcStatus || 'Balanced',
      cash_notes: cashNotes || '',
      owner_cash_injection: ownerContrib,
      manager_approval: managerApproved,
      manager_approved_by: managerApproved ? (user?.email || '') : '',

      // ── Section C: Operating Result ───────────────────────────────────────────
      approved_purchases_total: approvedPurchasesTotal,
      daily_operating_result: operatingResult,
      // Owner capital contribution from purchases shortfall (NOT sales revenue)
      owner_capital_contribution: purchasesOwnerContrib,

      // Driver fields (unchanged)
      driver_cash: 0,
      driver_network: 0,
      driver_name: '',
      driver_employee_id: '',
      driver_network_account_id: '',
      drivers_json: '',
    };

    onSubmit(payload, proofUrl, ocrData);
  };

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2 max-w-full overflow-x-hidden">

      {/* Date & Branch */}
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

      {/* Shift & Cashier */}
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
          {employees.length > 0 ? (
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
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                    {emp.position && <span className="text-muted-foreground text-xs ml-1">({emp.position})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value="No Cashier Found" disabled className="h-10 text-base md:text-sm bg-muted" />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION A — SALES REVENUE
          Sales Total = Cash Sales + Network/POS + Customer Credit
          This section is COMPLETELY INDEPENDENT of cash reconciliation.
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border-2 border-blue-200 overflow-hidden bg-background shadow-sm">
        <SectionHeader
          icon={DollarSign}
          title="Sales Revenue"
          badge={<Badge className="text-[10px] font-bold bg-blue-600 text-white">{currency}{totalSales.toLocaleString()}</Badge>}
        />
        <div className="p-3 space-y-3">
          <p className="text-[10px] text-muted-foreground italic">
            Enter actual revenue collected. Cash Sales = money received from customers in cash.
            This value is independent of the cash register count.
          </p>

          {/* Cash Sales — direct revenue entry */}
          <NumInput
            label="Cash Sales"
            value={cashSalesInput}
            onChange={setCashSalesInput}
            prefix={currency}
            helpText="Actual cash revenue from customers (not the register difference)"
          />

          {/* Network / POS Sales */}
          <div className="rounded-xl border border-border overflow-hidden">
            <SectionHeader
              icon={CreditCard}
              title="Network / POS Sales"
              badge={<Badge variant="outline" className="text-[10px] font-bold text-primary">{currency}{networkTotal.toLocaleString()}</Badge>}
            />
            <div className="p-3 space-y-3">
              {posEntries.map((entry, idx) => {
                const device = posDevices.find(d => d.id === entry.device_id);
                const deviceLabel = device
                  ? (device.account_name || device.device_name || device.network_provider || 'POS Device')
                  : (entry.device_name || 'Manual Network Entry');
                return (
                  <div key={entry.id} className="bg-muted/30 p-2 rounded-lg border border-border/50 space-y-2">
                    {posDevices.length > 0 ? (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Device #{idx + 1}</Label>
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
                          <SelectTrigger className="h-10 text-base md:text-sm">
                            <SelectValue placeholder="Select POS device..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__manual__">Manual Network Entry</SelectItem>
                            {posDevices.map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.account_name || d.device_name || d.network_provider}
                                {d.account_number && <span className="text-muted-foreground text-xs ml-1">#{d.account_number}</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs font-semibold text-muted-foreground">{deviceLabel}</p>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <NumInput
                          label={`Amount #${idx + 1}`}
                          value={entry.amount}
                          onChange={v => updatePos(entry.id, 'amount', v)}
                          prefix={currency}
                        />
                      </div>
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-10 w-10 text-destructive"
                        onClick={() => removePos(entry.id)}
                        disabled={posEntries.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="w-full h-10 text-sm border-dashed" onClick={addPos}>
                <Plus className="w-3 h-3 mr-1" /> Add POS Device
              </Button>
            </div>
          </div>

          {/* Customer Credit Sales */}
          <div className="rounded-xl border border-border overflow-hidden">
            <SectionHeader
              icon={User}
              title="Customer Credit Sales"
              badge={<Badge variant="outline" className="text-[10px] font-bold text-primary">{currency}{creditTotal.toLocaleString()}</Badge>}
            />
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
                />
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full h-10 text-sm border-dashed" onClick={addCredit}>
                <Plus className="w-3 h-3 mr-1" /> Add Credit Entry
              </Button>
            </div>
          </div>

          {/* Sales Total Summary */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-1.5">
            <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <Info className="w-3 h-3" /> Sales Total
            </p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cash Sales</span>
              <span className="font-bold text-foreground">{currency}{cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Network / POS Sales</span>
              <span className="font-bold text-foreground">{currency}{networkTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Customer Credit Sales</span>
              <span className="font-bold text-foreground">{currency}{creditTotal.toLocaleString()}</span>
            </div>
            <Separator className="my-1 bg-blue-200" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-blue-700 uppercase">Total Sales</span>
              <span className="text-2xl font-black text-blue-700">{currency}{totalSales.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION B — CASH RECONCILIATION
          Separate from sales. Shortage/Overage do NOT affect Sales Total.
          Expected Cash = Opening Cash + Cash Sales
          Actual Cash Count = physical count by cashier
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border-2 border-amber-200 overflow-hidden bg-background shadow-sm">
        <SectionHeader icon={Scale} title="Cash Reconciliation" />
        <div className="p-3 space-y-3">
          <p className="text-[10px] text-muted-foreground italic">
            Compare expected cash (Opening + Cash Sales) with the physical count.
            Any difference is a reconciliation item — it does NOT change Sales Total.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <NumInput
              label="Opening Cash"
              value={openingCash}
              onChange={setOpeningCash}
              prefix={currency}
              helpText="Cash in register at start of shift"
            />
            <NumInput
              label="Expected Cash"
              value={expectedCash}
              readOnly
              prefix={currency}
              helpText="Opening + Cash Sales (auto)"
            />
          </div>

          <NumInput
            label="Actual Cash Count"
            value={actualCashCount}
            onChange={setActualCashCount}
            prefix={currency}
            helpText="Physical cash counted at end of shift"
          />

          {/* Reconciliation result */}
          {cashDifference !== null && (
            <div className={`rounded-xl p-3 border ${
              cashReconcStatus === 'Shortage' ? 'bg-red-50 border-red-200' :
              cashReconcStatus === 'Overage'  ? 'bg-amber-50 border-amber-200' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Cash Difference</p>
                <StatusBadge status={cashReconcStatus} />
              </div>
              <p className={`text-xl font-extrabold ${
                cashDifference < 0 ? 'text-red-600' : cashDifference > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {cashDifference >= 0 ? '+' : ''}{currency}{Math.abs(cashDifference).toLocaleString()}
              </p>
              {cashReconcStatus === 'Shortage' && (
                <p className="text-[10px] text-red-600 mt-1 font-medium">
                  Cash Shortage: {currency}{cashShortageAmount.toLocaleString()} — Sales Total is unchanged.
                </p>
              )}
              {cashReconcStatus === 'Overage' && (
                <p className="text-[10px] text-amber-600 mt-1 font-medium">
                  Cash Overage: {currency}{cashOverageAmount.toLocaleString()} — Sales Total is unchanged.
                </p>
              )}
            </div>
          )}

          {/* Owner Capital Contribution to cover cash shortage */}
          {cashReconcStatus === 'Shortage' && (
            <NumInput
              label="Owner Capital Contribution (Cash)"
              value={ownerContributionInput}
              onChange={setOwnerContributionInput}
              prefix={currency}
              helpText="Amount owner paid from personal money to cover the shortage. NOT sales revenue."
              placeholder="0.00"
            />
          )}

          {/* Effective cash position after owner contribution */}
          {cashReconcStatus === 'Shortage' && ownerContrib > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-medium">Cash Position After Contribution</span>
              <span className={`text-sm font-bold ${effectiveCashDiff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {effectiveCashDiff >= 0 ? '+' : ''}{currency}{Math.abs(effectiveCashDiff || 0).toLocaleString()}
              </span>
            </div>
          )}

          {/* Manager Approval for large shortages */}
          {needsManagerApproval && (
            <div className={`rounded-xl p-3 border ${managerApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {managerApproved
                  ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  : <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className={`text-xs font-bold ${managerApproved ? 'text-emerald-700' : 'text-red-700'}`}>
                  {managerApproved ? 'Approved by Manager' : 'Manager Approval Required'}
                </span>
              </div>
              {!managerApproved ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-red-600 leading-tight">Shortage exceeds limit. Approval required.</p>
                  <Button
                    type="button" size="sm"
                    className="w-full h-10 md:h-8 text-sm md:text-xs bg-red-600 hover:bg-red-700"
                    onClick={() => setManagerApproved(true)}
                  >
                    Approve Shortage
                  </Button>
                </div>
              ) : (
                <p className="text-[10px] text-emerald-600">Verified by {user?.email}</p>
              )}
            </div>
          )}

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Reconciliation Notes</Label>
            <Textarea
              value={cashNotes}
              onChange={e => setCashNotes(e.target.value)}
              placeholder="..."
              className="min-h-[60px] text-base md:text-xs resize-none"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION C — OPERATING RESULT (read-only, shown when purchases exist)
          Operating Result = Total Sales − Approved Purchases
          ═══════════════════════════════════════════════════════════════════════ */}
      {!purchasesLoading && !hasApprovedPurchases && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium leading-snug">
            Please record today&apos;s purchases before closing daily sales.
          </p>
        </div>
      )}

      {hasApprovedPurchases && (
        <div className="rounded-xl border-2 border-emerald-200 overflow-hidden bg-background shadow-sm">
          <SectionHeader icon={Info} title="Operating Result" />
          <div className="p-3 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total Sales</span>
              <span className="font-bold text-blue-700">{currency}{totalSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Approved Purchases</span>
              <span className="font-bold text-orange-600">{currency}{approvedPurchasesTotal.toLocaleString()}</span>
            </div>
            <Separator className="my-1 bg-emerald-200" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold uppercase text-muted-foreground">Operating Result</span>
              <span className={`text-xl font-black ${operatingResult >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {operatingResult >= 0 ? '+' : ''}{currency}{operatingResult.toLocaleString()}
              </span>
            </div>
            {purchasesOwnerContrib > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-[10px] text-amber-700 font-bold uppercase">Owner Capital Contribution (Purchases Gap)</p>
                <p className="text-sm font-bold text-amber-700">{currency}{purchasesOwnerContrib.toLocaleString()}</p>
                <p className="text-[9px] text-amber-600 mt-0.5">Owner funds to cover purchase shortfall. NOT classified as sales revenue.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="button" variant="outline" className="h-12 text-sm font-bold" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="h-12 text-sm font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          disabled={(needsManagerApproval && !managerApproved) || purchasesLoading}
          title={!hasApprovedPurchases ? "Please record today's purchases before closing daily sales." : undefined}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
