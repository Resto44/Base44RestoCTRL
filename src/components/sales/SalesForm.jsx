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
  AlertCircle, ShieldCheck, User, Phone, Info
} from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';
import { toast } from 'sonner';

const MANAGER_APPROVAL_THRESHOLD = 50;

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

function NumInput({ label, value, onChange, required, prefix, placeholder }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{prefix}</span>}
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          placeholder={placeholder || '0.00'}
          className={`h-10 ${prefix ? 'pl-8' : ''} text-base md:text-sm font-medium`}
        />
      </div>
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

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [customers, searchQuery]);

  const handleSelectCustomer = (customer) => {
    onUpdate(entry.id, 'customer', customer.customer_name);
    onUpdate(entry.id, 'customer_phone', customer.phone || '');
    onUpdate(entry.id, 'current_debt', customer.outstanding_balance || 0);
    onUpdate(entry.id, 'credit_limit', customer.credit_limit || 0);
    setShowDropdown(false);
    setSearchQuery('');
  };

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
        <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.select_customer}</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={entry.customer || searchQuery}
            placeholder={lbl.search_customer}
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
                onClick={() => handleSelectCustomer(c)}
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
        label={lbl.credit_amount} 
        value={entry.amount} 
        onChange={v => onUpdate(entry.id, 'amount', v)} 
        prefix={currency}
      />
      
      <div className="pt-1">
        <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.notes_optional}</Label>
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

export default function SalesForm({ initial, onSubmit, onCancel }) {
  const { t, currency } = useLanguage();
  const { user } = useAuth();
  const { ownerFilter, branches, managerBranch, activeRestaurant } = useTenant();
  
  const lbl = {
    date: t('date') || 'Date',
    branch: t('branch') || 'Branch',
    cash_register: t('cash_register') || 'Cash Register',
    opening_cash: t('opening_cash') || 'Opening Cash',
    closing_cash: t('closing_cash') || 'Closing Cash',
    cash_difference: t('cash_difference') || 'Cash Difference',
    balanced: t('balanced') || 'Balanced',
    shortage: t('shortage') || 'Shortage',
    overage: t('overage') || 'Overage',
    network_sales: t('network_sales') || 'Network Sales',
    add_pos: t('add_pos') || 'Add POS Device',
    device: t('device') || 'Device',
    amount: t('amount') || 'Amount',
    customer_credit_sales: t('customer_credit_sales') || 'Customer Credit Sales',
    add_credit: t('add_credit') || 'Add Credit Entry',
    select_customer: t('select_customer') || 'Select Customer',
    search_customer: t('search_customer') || 'Search customer by name or phone...',
    credit_amount: t('credit_amount') || 'Credit Amount',
    notes_optional: t('notes_optional') || 'Notes (optional)',
    sales_total: t('sales_total') || 'Sales Total',
    cash_sales: t('cash_sales') || 'Cash Sales (Closing - Opening)',
    total: t('total') || 'Total',
    save: t('save') || 'Save',
    cancel: t('cancel') || 'Cancel',
    manager_approval: t('manager_approval') || 'Manager Approval',
    approval_needed: t('approval_needed') || 'Shortage exceeds limit. Approval required.',
    approved: t('approved') || 'Approved by Manager',
    shift: t('shift') || 'Shift',
    cashier_name: t('cashier_name') || 'Cashier Name',
    sales_notes: t('sales_notes') || 'Sales Notes',
    morning: t('morning') || 'Morning',
    evening: t('evening') || 'Evening',
    please_select_customer: 'Please select a customer for all credit entries',
  };

  const [form, setForm] = useState({
    date: initial?.date || format(new Date(), 'yyyy-MM-dd'),
    branch: initial?.branch || managerBranch || branches[0]?.key || '',
    shift: initial?.shift || 'Morning',
    cashier_name: initial?.cashier_name || '',
    sales_notes: initial?.sales_notes || '',
    ...initial,
  });

  const [openingCash, setOpeningCash] = useState(initial?.opening_cash ?? '');
  const [closingCash, setClosingCash] = useState(initial?.closing_cash ?? '');
  const [cashNotes, setCashNotes] = useState(initial?.cash_notes || '');
  const [managerApproved, setManagerApproved] = useState(initial?.manager_approval || false);

  // ── FIX 1: Load cashiers (Cashier / Manager / Owner) filtered by branch ──────
  const { data: employees = [] } = useQuery({
    queryKey: ['employees_cashiers', ownerFilter?.created_by, form.branch],
    queryFn: async () => {
      if (!ownerFilter?.created_by) return [];
      const all = await base44.entities.Employee.filter(
        { created_by: ownerFilter.created_by, is_active: true },
        'full_name',
        200
      );
      // Filter by branch if set
      const branchFiltered = form.branch
        ? all.filter(e => !e.branch || e.branch === form.branch || e.branch === 'all')
        : all;
      // Only cashiers, managers, and owners
      const CASHIER_ROLES = ['cashier', 'manager', 'owner', 'supervisor', 'admin'];
      return branchFiltered.filter(e => {
        const pos = (e.position || '').toLowerCase();
        return CASHIER_ROLES.some(r => pos.includes(r));
      });
    },
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });

  // Auto-select cashier when only one exists or when branch changes
  useEffect(() => {
    if (employees.length === 1 && !form.cashier_name) {
      setForm(prev => ({ ...prev, cashier_name: employees[0].full_name }));
    }
  }, [employees]);

  // When branch changes, reset cashier if the current one is not in the new list
  useEffect(() => {
    if (employees.length > 0 && form.cashier_name) {
      const stillValid = employees.some(e => e.full_name === form.cashier_name);
      if (!stillValid) {
        const newCashier = employees.length === 1 ? employees[0].full_name : '';
        setForm(prev => ({ ...prev, cashier_name: newCashier }));
      }
    }
  }, [form.branch, employees]);

  // ── Auto-populate Opening Cash from yesterday ──────────────────────────────
  useEffect(() => {
    if (!initial?.id && !openingCash && ownerFilter?.created_by) {
      const fetchLastClosing = async () => {
        const { data, error } = await supabase
          .from('daily_sales')
          .select('closing_cash')
          .eq('created_by', ownerFilter.created_by)
          .eq('branch', form.branch)
          .order('date', { ascending: false })
          .order('created_date', { ascending: false })
          .limit(1);
        
        if (!error && data?.[0]) {
          setOpeningCash(data[0].closing_cash || 0);
        } else {
          setOpeningCash(0);
        }
      };
      fetchLastClosing();
    }
  }, [ownerFilter?.created_by, form.branch, initial?.id]);

  // ── FIX 2: Load POS devices for the selected branch ───────────────────────
  const { data: posDevices = [] } = useQuery({
    queryKey: ['pos_devices_form', activeRestaurant?.id, ownerFilter?.created_by, form.branch],
    queryFn: async () => {
      const createdBy = ownerFilter?.created_by;
      if (!createdBy) return [];
      const all = await base44.entities.NetworkAccount.filter(
        { created_by: createdBy },
        '-created_date',
        200
      );
      if (!form.branch) return all.filter(a => a.status === 'active' || a.is_active);
      return all.filter(a =>
        (a.status === 'active' || a.is_active) &&
        (!a.branch || a.branch === form.branch || a.branch_id === form.branch)
      );
    },
    staleTime: 30000,
    enabled: !!(ownerFilter?.created_by),
  });

  const parsePosEntries = () => {
    if (initial?.pos_entries_json) {
      try { return JSON.parse(initial.pos_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    // FIX 2: Always start with one row (Manual Network Entry if no devices)
    return [{ id: Date.now(), device_id: '', device_name: '', amount: '', notes: '' }];
  };
  const [posEntries, setPosEntries] = useState(parsePosEntries);
  const [proofUrl, setProofUrl] = useState(initial?.proof_url || '');
  const [ocrData, setOcrData] = useState(null);

  // FIX 2: When POS devices load, populate device names in existing entries
  useEffect(() => {
    if (posDevices.length > 0 && posEntries.length === 1 && !posEntries[0].device_id && !posEntries[0].amount) {
      // Auto-populate first entry with first device if only one device
      if (posDevices.length === 1) {
        setPosEntries([{ id: posEntries[0].id, device_id: posDevices[0].id, device_name: posDevices[0].account_name || posDevices[0].device_name || '', amount: '', notes: '' }]);
      }
    }
  }, [posDevices]);

  const parseCreditEntries = () => {
    if (initial?.credit_entries_json) {
      try { return JSON.parse(initial.credit_entries_json).map((e, i) => ({ ...e, id: Date.now() + i })); } catch { /* ignore */ }
    }
    return [];
  };
  const [creditEntries, setCreditEntries] = useState(parseCreditEntries);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

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

  const addPos = () => setPosEntries(prev => [...prev, { id: Date.now(), device_id: '', device_name: '', amount: '', notes: '' }]);
  const removePos = (id) => setPosEntries(prev => prev.filter(e => e.id !== id));
  const updatePos = (id, field, value) => setPosEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const addCredit = () => setCreditEntries(prev => [...prev, { id: Date.now(), customer: '', amount: '', notes: '' }]);
  const removeCredit = (id) => setCreditEntries(prev => prev.filter(e => e.id !== id));
  const updateCredit = (id, field, value) => setCreditEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const opening = Number(openingCash) || 0;
  const closing = Number(closingCash) || 0;
  
  const cashDifference = useMemo(() => {
    if (openingCash === '' && closingCash === '') return null;
    return closing - opening;
  }, [opening, closing, openingCash, closingCash]);

  const cashStatus = useMemo(() => {
    if (cashDifference === null) return null;
    if (cashDifference === 0) return 'Balanced';
    if (cashDifference < 0) return 'Shortage';
    return 'Overage';
  }, [cashDifference]);

  // FIX 3: Cash Sales = closing - opening (the actual difference, positive or negative)
  // Cash shortage does NOT reduce sales — it is a separate operational indicator.
  // Sales = Cash Difference + Network + Credit (shortage is informational only)
  const cashSales = useMemo(() => {
    if (cashDifference === null) return 0;
    // Use the full difference (positive = overage/sales, negative = shortage)
    // For sales reporting, we use the absolute cash difference as cash sales
    // A shortage means less cash was collected than expected — it does NOT change
    // the network or credit totals. The cash component IS the difference.
    return cashDifference ?? 0;
  }, [cashDifference]);

  const networkTotal = posEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const creditTotal = creditEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  // FIX 3: Grand total = cash difference + network + credit (shortage is informational)
  const grandTotal = cashSales + networkTotal + creditTotal;
  const needsManagerApproval = cashStatus === 'Shortage' && Math.abs(cashDifference || 0) > MANAGER_APPROVAL_THRESHOLD;

  const handleSubmit = (e) => {
    e.preventDefault();
    const invalidCredit = creditEntries.find(e => Number(e.amount) > 0 && !e.customer);
    if (invalidCredit) {
      toast.error(lbl.please_select_customer);
      return;
    }

    const firstPos = posEntries[0];
    const payload = {
      ...form,
      opening_cash: opening,
      closing_cash: closing,
      cash_difference: cashDifference ?? 0,
      cash_status: cashStatus || 'Balanced',
      cash_notes: cashNotes || '',
      shift: form.shift || 'Morning',
      cashier_name: form.cashier_name || '',
      manager_approval: managerApproved,
      manager_approved_by: managerApproved ? (user?.email || '') : '',
      // FIX 3: restaurant_cash = cashDifference (can be negative for shortage)
      restaurant_cash: cashSales,
      restaurant_network: networkTotal,
      restaurant_network_account_id: firstPos?.device_id || '',
      credit: creditTotal,
      cash: cashSales,
      network: networkTotal,
      pos_entries_json: JSON.stringify(posEntries.map(({ id, ...rest }) => rest)),
      credit_entries_json: JSON.stringify(creditEntries.map(({ id, ...rest }) => rest)),
      proof_url: proofUrl || '',
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
    <form onSubmit={handleSubmit} className="space-y-4 pb-2 max-w-full overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.date}</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-10 text-base md:text-sm" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.branch}</Label>
          <BranchSelect value={form.branch} onChange={v => set('branch', v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.shift}</Label>
          <Select value={form.shift} onValueChange={v => set('shift', v)}>
            <SelectTrigger className="h-10 text-base md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">{lbl.morning}</SelectItem>
              <SelectItem value="Evening">{lbl.evening}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* FIX 1: Cashier dropdown — auto-loaded from employees */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{lbl.cashier_name}</Label>
          {employees.length > 0 ? (
            <Select value={form.cashier_name || ''} onValueChange={v => set('cashier_name', v)}>
              <SelectTrigger className="h-10 text-base md:text-sm">
                <SelectValue placeholder="Select cashier..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.full_name}>
                    {emp.full_name}
                    {emp.position && <span className="text-muted-foreground text-xs ml-1">({emp.position})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={form.cashier_name}
              onChange={e => set('cashier_name', e.target.value)}
              placeholder="Cashier name..."
              className="h-10 text-base md:text-sm"
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
        <SectionHeader icon={Store} title={lbl.cash_register} />
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label={lbl.opening_cash} value={openingCash} onChange={setOpeningCash} required prefix={currency} />
            <NumInput label={lbl.closing_cash} value={closingCash} onChange={setClosingCash} required prefix={currency} />
          </div>

          {cashDifference !== null && (
            <div className="rounded-xl p-3 bg-muted/40 border border-border">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">{lbl.cash_difference}</p>
                <CashStatusBadge status={cashStatus} lbl={lbl} />
              </div>
              <div className="text-xl md:text-2xl font-extrabold tracking-tight">
                <span className={cashDifference < 0 ? 'text-red-600' : cashDifference > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                  {cashDifference >= 0 ? '+' : ''}{currency}{Math.abs(cashDifference).toLocaleString()}
                </span>
              </div>
              {/* FIX 3: Clarify that shortage is informational, not a sales deduction */}
              {cashStatus === 'Shortage' && (
                <p className="text-[10px] text-red-500 mt-1">
                  Cash shortage is recorded for audit. It does not reduce sales revenue.
                </p>
              )}
            </div>
          )}

          {needsManagerApproval && (
            <div className={`rounded-xl p-3 border ${managerApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {managerApproved ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className={`text-xs font-bold ${managerApproved ? 'text-emerald-700' : 'text-red-700'}`}>
                  {managerApproved ? lbl.approved : lbl.manager_approval}
                </span>
              </div>
              {!managerApproved ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-red-600 leading-tight">{lbl.approval_needed}</p>
                  <Button type="button" size="sm" className="w-full h-10 md:h-8 text-sm md:text-xs bg-red-600 hover:bg-red-700" onClick={() => setManagerApproved(true)}>
                    Approve Shortage
                  </Button>
                </div>
              ) : (
                <p className="text-[10px] text-emerald-600">Verified by {user?.email}</p>
              )}
            </div>
          )}

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">{t('notes')}</Label>
            <Textarea 
              value={cashNotes} 
              onChange={e => setCashNotes(e.target.value)} 
              placeholder="..." 
              className="min-h-[60px] text-base md:text-xs resize-none"
            />
          </div>
        </div>
      </div>

      {/* FIX 2: Network Sales — NEVER hidden, always shows at least one row */}
      <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
        <SectionHeader 
          icon={CreditCard} 
          title={lbl.network_sales} 
          badge={<Badge variant="outline" className="text-[10px] font-bold text-primary">{currency}{networkTotal.toLocaleString()}</Badge>}
        />
        <div className="p-3 space-y-3">
          {posEntries.map((entry, idx) => {
            // Find matching device name for display
            const device = posDevices.find(d => d.id === entry.device_id);
            const deviceLabel = device
              ? (device.account_name || device.device_name || device.network_provider || 'POS Device')
              : (entry.device_name || 'Manual Network Entry');
            return (
              <div key={entry.id} className="bg-muted/30 p-2 rounded-lg border border-border/50 space-y-2">
                {/* Device selector (if POS devices exist) or label */}
                {posDevices.length > 0 ? (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">
                      {lbl.device} #{idx + 1}
                    </Label>
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
                  <p className="text-xs font-semibold text-muted-foreground">
                    {deviceLabel}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumInput
                      label={`${lbl.amount} #${idx + 1}`}
                      value={entry.amount}
                      onChange={v => updatePos(entry.id, 'amount', v)}
                      prefix={currency}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
            <Plus className="w-3 h-3 mr-1" /> {lbl.add_pos}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
        <SectionHeader 
          icon={User} 
          title={lbl.customer_credit_sales} 
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
              lbl={lbl}
            />
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-10 text-sm border-dashed" onClick={addCredit}>
            <Plus className="w-3 h-3 mr-1" /> {lbl.add_credit}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{lbl.sales_total}</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{lbl.cash_sales}</span>
            <span className={`font-bold ${cashSales < 0 ? 'text-red-600' : 'text-foreground'}`}>
              {cashSales < 0 ? '-' : ''}{currency}{Math.abs(cashSales).toLocaleString()}
              {cashStatus === 'Shortage' && <span className="text-red-500 text-[10px] ml-1">(shortage)</span>}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{lbl.network_sales}</span>
            <span className="font-bold text-foreground">{currency}{networkTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{lbl.customer_credit_sales}</span>
            <span className="font-bold text-foreground">{currency}{creditTotal.toLocaleString()}</span>
          </div>
          <Separator className="my-2 bg-primary/20" />
          <div className="flex justify-between items-end">
            <span className="text-sm font-bold text-primary uppercase">{lbl.total}</span>
            <span className="text-2xl md:text-3xl font-black text-primary tracking-tighter">
              {currency}{grandTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="button" variant="outline" className="h-12 text-sm font-bold" onClick={onCancel}>
          {lbl.cancel}
        </Button>
        <Button 
          type="submit" 
          className="h-12 text-sm font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          disabled={needsManagerApproval && !managerApproved}
        >
          {lbl.save}
        </Button>
      </div>
    </form>
  );
}
