import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { useTenant } from '@/lib/TenantContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { Plus, ArrowDownLeft, ArrowUpRight, Building2, User,
  TrendingUp, Banknote, CreditCard,
  Trash2, Scale, AlertTriangle, UserCircle, ShieldCheck, ExternalLink
} from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid
} from 'recharts';
import BranchSelect from '@/components/shared/BranchSelect';
import SponsorLedger from '@/components/settlement/SponsorLedger';
import BranchSettlementLedger from '@/components/treasury/BranchSettlementLedger';
import ReconciliationDashboard from '@/components/treasury/ReconciliationDashboard';
import CashflowProjection from '@/components/treasury/CashflowProjection';
import OwnerPersonalFinance from '@/components/treasury/OwnerPersonalFinance';
import { useNotify } from '@/lib/useNotify';

const TX_TYPES = [
  // Auto-generated (shown in history, not in add form)
  { value: 'network_sales_auto',        label: 'Network Sales (Auto)',            wallet: 'owner_network', direction: 'in',  auto: true },
  { value: 'cash_sales_branch',         label: 'Cash Sales (Auto)',               wallet: 'branch_cash',   direction: 'in',  auto: true },
  // Credit collections
  { value: 'credit_collection_network', label: 'Credit Collection (Network)',     wallet: 'owner_network', direction: 'in' },
  { value: 'credit_collection_cash',    label: 'Credit Collection (Cash)',        wallet: 'branch_cash',   direction: 'in' },
  // Branch → Owner settlements
  { value: 'branch_to_owner_cash',      label: 'Branch → Owner (Cash Transfer)', wallet: 'owner_cash',    direction: 'in',  settlement: true },
  { value: 'branch_to_owner_network',   label: 'Branch → Owner (Network Sales)', wallet: 'owner_network', direction: 'in',  settlement: true },
  // Owner → Branch
  { value: 'owner_to_branch_funding',   label: 'Owner → Branch (Funding)',        wallet: 'branch_cash',   direction: 'in',  settlement: true },
  { value: 'owner_expense',             label: 'Owner Expense (for Branch)',      wallet: 'owner_network', direction: 'out', settlement: true },
  { value: 'owner_salary_payment',      label: 'Owner Pays Salary (for Branch)', wallet: 'owner_network', direction: 'out', settlement: true },
  { value: 'owner_external_payment',    label: 'Owner Supplier Payment',         wallet: 'owner_network', direction: 'out', settlement: true },
  // Pure owner
  { value: 'owner_external_debt',       label: 'External Debt (Owner)',           wallet: 'owner_network', direction: 'out' },
  { value: 'owner_personal_withdrawal', label: 'Personal Withdrawal',             wallet: 'owner_cash',    direction: 'out' },
  { value: 'owner_investment',          label: 'Owner Investment In',             wallet: 'owner_cash',    direction: 'in' },
  // Branch
  { value: 'salary_advance',            label: 'Salary Advance (Branch)',         wallet: 'branch_cash',   direction: 'out' },
  { value: 'branch_purchase_payment',   label: 'Branch Purchase Payment',        wallet: 'branch_cash',   direction: 'out' },
  { value: 'branch_expense',            label: 'Branch Expense',                  wallet: 'branch_cash',   direction: 'out' },
];

const TYPE_META = Object.fromEntries(TX_TYPES.map(t => [t.value, t]));

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') };
});

const emptyForm = { date: format(new Date(), 'yyyy-MM-dd'), type: '', wallet: 'owner', branch: '', amount: '', payment_method: 'cash', description: '' };

export default function Treasury() {
  const { currency, t } = useLanguage();
  const { role } = useRole();
  const { branches, activeRestaurantId } = useTenant();
  const notif = useNotify();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterBranch, setFilterBranch] = useState('all');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { ownerFilter } = useTenant();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['wallet_transactions', ownerFilter],
    queryFn: () => base44.entities.WalletTransaction.filter(ownerFilter || {}, '-date', 2000),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', ownerFilter],
    queryFn: () => base44.entities.Employee.filter(ownerFilter || {}, 'full_name', 500),
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 2000),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements_all', ownerFilter],
    queryFn: () => base44.entities.SettlementRecord.filter(ownerFilter || {}, '-date', 500),
    staleTime: 30000,
    enabled: !!ownerFilter?.created_by,
  });

  // Sponsor ledger summary for overview
  const sponsorSummary = useMemo(() => {
    const receivedBySponsor = settlements
      .filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && s.status === 'approved')
      .reduce((a, s) => a + (s.amount || 0), 0);
    const sentToOwner = settlements
      .filter(s => s.flow_type === 'SPONSOR_TO_OWNER' && s.status !== 'rejected')
      .reduce((a, s) => a + (s.amount || 0), 0);
    const remaining = receivedBySponsor - sentToOwner;
    // Count distinct branches with remaining
    const branchMap = {};
    settlements.filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && s.status === 'approved' && s.branch)
      .forEach(s => { branchMap[s.branch] = (branchMap[s.branch] || 0) + (s.amount || 0); });
    settlements.filter(s => s.flow_type === 'SPONSOR_TO_OWNER' && s.status !== 'rejected' && s.branch)
      .forEach(s => { branchMap[s.branch] = (branchMap[s.branch] || 0) - (s.amount || 0); });
    const branchesWithBalance = Object.values(branchMap).filter(v => v > 0).length;
    return { receivedBySponsor, sentToOwner, remaining: Math.max(0, remaining), branchesWithBalance };
  }, [settlements]);

  const saveMut = useMutation({
    mutationFn: d => base44.entities.WalletTransaction.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet_transactions'] }); setShowForm(false); setForm(emptyForm); },
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.WalletTransaction.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet_transactions'] }); setDeleteId(null); },
  });

  // ── Filter transactions ───────────────────────────────────────────────
  const monthTx = useMemo(() =>
    transactions.filter(tx => tx.date?.startsWith(filterMonth)),
    [transactions, filterMonth]
  );
  const filteredTx = useMemo(() =>
    monthTx.filter(tx => filterBranch === 'all' || !tx.branch || tx.branch === filterBranch),
    [monthTx, filterBranch]
  );

  // ── Wallet balances ───────────────────────────────────────────────────
  const walletBalance = useMemo(() => {
    const calc = (walletKey) => transactions.filter(tx => tx.wallet === walletKey)
      .reduce((s, tx) => s + (tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0)), 0);
    return {
      ownerNetwork: calc('owner_network'),
      ownerCash: calc('owner_cash'),
      get ownerTotal() { return this.ownerNetwork + this.ownerCash; },
    };
  }, [transactions]);

  const branchBalances = useMemo(() => {
    const map = {};
    transactions.filter(tx => tx.wallet === 'branch_cash' && tx.branch).forEach(tx => {
      if (!map[tx.branch]) map[tx.branch] = 0;
      map[tx.branch] += tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0);
    });
    return map;
  }, [transactions]);

  // ── Monthly summary ───────────────────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const ownerIn = monthTx.filter(tx => (tx.wallet === 'owner_network' || tx.wallet === 'owner_cash') && tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0);
    const ownerOut = monthTx.filter(tx => (tx.wallet === 'owner_network' || tx.wallet === 'owner_cash') && tx.direction === 'out').reduce((s, tx) => s + (tx.amount || 0), 0);
    const networkIn = monthTx.filter(tx => tx.wallet === 'owner_network' && tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0);
    const branchIn = monthTx.filter(tx => tx.wallet === 'branch_cash' && tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0);
    const branchOut = monthTx.filter(tx => tx.wallet === 'branch_cash' && tx.direction === 'out').reduce((s, tx) => s + (tx.amount || 0), 0);
    return { ownerIn, ownerOut, networkIn, branchIn, branchOut };
  }, [monthTx]);

  // ── Monthly trend (last 6 months) ────────────────────────────────────
  const trendData = useMemo(() => {
    return MONTH_OPTIONS.slice().reverse().map(({ value, label }) => {
      const txs = transactions.filter(tx => tx.date?.startsWith(value));
      const networkIn = txs.filter(tx => tx.wallet === 'owner_network' && tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0);
      const ownerOut = txs.filter(tx => (tx.wallet === 'owner_network' || tx.wallet === 'owner_cash') && tx.direction === 'out').reduce((s, tx) => s + (tx.amount || 0), 0);
      const ownerIn = txs.filter(tx => (tx.wallet === 'owner_network' || tx.wallet === 'owner_cash') && tx.direction === 'in').reduce((s, tx) => s + (tx.amount || 0), 0);
      return { label, networkIn, ownerIn, ownerOut, net: ownerIn - ownerOut };
    });
  }, [transactions]);

  // ── Branch balance chart ──────────────────────────────────────────────
  const branchBalanceChart = useMemo(() => {
    return Object.entries(branchBalances).map(([key, balance]) => ({
      name: branches.find(b => b.key === key)?.label || key,
      balance,
    }));
  }, [branchBalances, branches]);

  // ── Payroll obligation ────────────────────────────────────────────────
  const payrollObligation = useMemo(() =>
    employees.filter(e => e.is_active !== false).reduce((s, e) => s + (e.base_salary || 0), 0),
    [employees]
  );

  const handleSave = async () => {
    if (!form.type || !form.amount || !form.date) return;
    const meta = TYPE_META[form.type];
    const amount = Number(form.amount);
    saveMut.mutate({
      ...form,
      amount,
      wallet: meta?.wallet || form.wallet,
      direction: meta?.direction || 'out',
    });
    // Fire notification based on type
    if (form.type?.startsWith('branch_to_owner')) {
      notif.branchToOwner({ branch: form.branch, amount });
    } else if (form.type === 'owner_to_branch_funding') {
      notif.ownerToBranch({ branch: form.branch, amount });
    } else if (form.type?.startsWith('credit_collection')) {
      notif.creditCollection({ branch: form.branch, amount });
    } else if (form.type === 'salary_advance') {
      notif.salaryAdvance({ branch: form.branch, amount, employeeName: form.description || 'Employee' });
    }
  };

  const typeConfig = form.type ? TYPE_META[form.type] : null;
  const showBranch = typeConfig && (
    typeConfig.wallet === 'branch_cash' ||
    form.type?.startsWith('branch_') ||
    typeConfig.settlement === true
  );

  if (role === 'cashier') {
    return <div className="text-center py-20 text-muted-foreground text-sm">{t('error')}</div>;
  }

  const fmt = (v) => formatCurrency(v, currency);

  return (
    <div>
      <PageHeader
        title={t('treasury')}
        action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> {t('add_transaction')}</Button>}
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="w-full flex-wrap gap-0.5">
          <TabsTrigger value="overview" className="flex-1 text-xs">{t('overview')}</TabsTrigger>
          <TabsTrigger value="settlement" className="flex-1 text-xs">
            <Scale className="w-3 h-3 mr-1" />{t('settlement')}
          </TabsTrigger>
          <TabsTrigger value="reconcile" className="flex-1 text-xs text-amber-700">
            <AlertTriangle className="w-3 h-3 mr-1" />{t('reports')}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1 text-xs">{t('details')}</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 text-xs">{t('analytics')}</TabsTrigger>
          <TabsTrigger value="sponsor" className="flex-1 text-xs text-amber-700">
            <ShieldCheck className="w-3 h-3 mr-1" />{t('sponsor_treasury')}
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex-1 text-xs text-indigo-600">
            <TrendingUp className="w-3 h-3 mr-1" />{t('forecast')}
          </TabsTrigger>
          {role === ROLES.OWNER ? (
            <TabsTrigger value="personal" className="flex-1 text-xs text-violet-600">
              <UserCircle className="w-3 h-3 mr-1" />{t('profile')}
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* ── OVERVIEW ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-3 space-y-3">
          {/* Owner wallets — split Network vs Cash */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('owner')} {t('total')}</p>
                <p className={`text-lg font-bold ${walletBalance.ownerTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(walletBalance.ownerTotal)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> {t('owner_network')}</p>
                <p className={`text-sm font-bold mt-0.5 ${walletBalance.ownerNetwork >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(walletBalance.ownerNetwork)}</p>
                <p className="text-xs text-muted-foreground">+{fmt(monthlySummary.networkIn)} {t('this_month')}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> {t('owner_cash')}</p>
                <p className={`text-sm font-bold mt-0.5 ${walletBalance.ownerCash >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(walletBalance.ownerCash)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">{t('cash_in')}</p>
                <p className="text-sm font-semibold text-emerald-600">{fmt(monthlySummary.ownerIn)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">{t('cash_out')}</p>
                <p className="text-sm font-semibold text-red-500">{fmt(monthlySummary.ownerOut)}</p>
              </div>
            </div>
          </Card>

          {/* Branch cash wallets */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t('branch_cash')}</p>
                <p className="text-xs text-muted-foreground">{t('branch')}</p>
              </div>
            </div>
            {Object.entries(branchBalances).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('no_data')}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(branchBalances).map(([key, bal]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{branches.find(b => b.key === key)?.label || key}</span>
                    <span className={`text-sm font-semibold ${bal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(bal)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sponsor Holdings Summary */}
          {(sponsorSummary.receivedBySponsor > 0 || sponsorSummary.remaining > 0) && (
            <Card className={`p-4 ${sponsorSummary.remaining > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-emerald-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${sponsorSummary.remaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <p className="text-sm font-semibold">Sponsor Holdings (كفيل)</p>
                </div>
                <Link to="/sponsor-treasury" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  Details <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t('inflows')}</p>
                  <p className="text-sm font-bold text-blue-600">{fmt(sponsorSummary.receivedBySponsor)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('direction_out')}</p>
                  <p className="text-sm font-bold text-violet-600">{fmt(sponsorSummary.sentToOwner)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('net_flow')}</p>
                  <p className={`text-sm font-bold ${sponsorSummary.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {fmt(sponsorSummary.remaining)}
                  </p>
                </div>
              </div>
              {sponsorSummary.remaining > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-100 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    {sponsorSummary.branchesWithBalance} {t('branch')} — {t('settlement')}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Payroll obligation */}
          {payrollObligation > 0 && (
            <Card className="p-3 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-medium">{t('payroll')}</p>
                </div>
                <p className="text-sm font-bold text-amber-600">{fmt(payrollObligation)}</p>
              </div>
            </Card>
          )}

          {/* Recent transactions */}
          <Card className="p-4">
            <p className="text-sm font-semibold mb-2">{t('details')}</p>
            <div className="space-y-2">
              {transactions.slice(0, 8).map(tx => {
                const meta = TYPE_META[tx.type];
                const isIn = tx.direction === 'in';
                return (
                  <div key={tx.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isIn ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {isIn ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-red-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium line-clamp-1">{meta?.label || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIn ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                );
              })}
              {transactions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('no_data')}</p>}
            </div>
          </Card>
        </TabsContent>

        {/* ── RECONCILIATION ──────────────────────────────────────────── */}
        <TabsContent value="reconcile" className="mt-3">
          <ReconciliationDashboard
            transactions={transactions}
            sales={allSales}
            branches={branches}
            currency={currency}
          />
        </TabsContent>

        {/* ── SETTLEMENT ──────────────────────────────────────────────── */}
        <TabsContent value="settlement" className="mt-3">
          <BranchSettlementLedger
            transactions={transactions}
            branches={branches}
            currency={currency}
            onRecord={() => setShowForm(true)}
          />
        </TabsContent>

        {/* ── TRANSACTIONS ────────────────────────────────────────────── */}
        <TabsContent value="transactions" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">{t('loading')}</p>
            ) : filteredTx.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">{t('no_data')}</p>
            ) : filteredTx.map(tx => {
              const meta = TYPE_META[tx.type];
              const isIn = tx.direction === 'in';
              return (
                <Card key={tx.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {isIn ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{meta?.label || tx.type}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{tx.date}</span>
                          {tx.branch && <Badge variant="outline" className="text-xs py-0">{tx.branch}</Badge>}
                          {tx.description && <span className="text-xs text-muted-foreground truncate max-w-28">{tx.description}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isIn ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(tx.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── SPONSOR LEDGER ──────────────────────────────────────────── */}
        <TabsContent value="sponsor" className="mt-3">
          <SponsorLedger />
        </TabsContent>

        {/* ── CASHFLOW FORECAST ────────────────────────────────────────── */}
        <TabsContent value="forecast" className="mt-3">
          <CashflowProjection />
        </TabsContent>

        {/* ── OWNER PERSONAL FINANCE ───────────────────────────────────── */}
        {(role === 'owner' || role === 'admin') && (
          <TabsContent value="personal" className="mt-3">
            <OwnerPersonalFinance />
          </TabsContent>
        )}

        {/* ── ANALYTICS ───────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-3 space-y-3">
          {trendData.some(d => d.ownerIn > 0 || d.ownerOut > 0) && (
            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">{t('cashflow_title')}</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="networkIn" name={t('network')} stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ownerIn" name={t('inflows')} stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ownerOut" name={t('outflows')} stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="net" name={t('net_flow')} stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {branchBalanceChart.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">{t('branch_cash')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={branchBalanceChart}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="balance" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Type breakdown */}
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">{t('summary')} — {filterMonth}</p>
            <div className="space-y-1.5">
              {TX_TYPES.map(({ value, label, direction }) => {
                const total = monthTx.filter(tx => tx.type === value).reduce((s, tx) => s + (tx.amount || 0), 0);
                if (total === 0) return null;
                return (
                  <div key={value} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate flex-1">{label}</span>
                    <span className={`font-semibold ml-2 ${direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {direction === 'in' ? '+' : '-'}{fmt(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add transaction dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setForm(emptyForm); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('add_transaction')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('transaction_type')} *</Label>
              <Select value={form.type} onValueChange={v => {
                const meta = TYPE_META[v];
                set('type', v);
                if (meta) { set('wallet', meta.wallet); }
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__settle_header__" disabled className="font-semibold text-xs text-muted-foreground">— Branch ↔ Owner Settlement —</SelectItem>
                  {TX_TYPES.filter(t => !t.auto && t.settlement).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="__credit_header__" disabled className="font-semibold text-xs text-muted-foreground">— Credit Collections —</SelectItem>
                  {TX_TYPES.filter(t => !t.auto && t.value.startsWith('credit_')).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="__owner_header__" disabled className="font-semibold text-xs text-muted-foreground">— Owner Only —</SelectItem>
                  {TX_TYPES.filter(t => !t.auto && !t.settlement && !t.value.startsWith('credit_') && (t.wallet === 'owner_network' || t.wallet === 'owner_cash')).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  <SelectItem value="__branch_header__" disabled className="font-semibold text-xs text-muted-foreground">— Branch Cash —</SelectItem>
                  {TX_TYPES.filter(t => !t.auto && !t.settlement && t.wallet === 'branch_cash').map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></div>
            </div>

            {showBranch && (
              <div><Label className="text-xs">Branch</Label><BranchSelect value={form.branch} onChange={v => set('branch', v)} /></div>
            )}

            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div><Label className="text-xs">Description / Notes</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saveMut.isPending || !form.type || !form.amount}>Save</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this transaction?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMut.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}