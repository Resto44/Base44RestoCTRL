import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { getDateRange, computeDashboardMetrics, formatCurrency, formatPct, formatDate } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import KPICard from '@/components/shared/KPICard';
import RiskBadge from '@/components/shared/RiskBadge';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import PaymentMixCharts from '@/components/dashboard/PaymentMixCharts';
import LowStockWidget from '@/components/dashboard/LowStockWidget';
import AccountsPayableWidget from '@/components/dashboard/AccountsPayableWidget';
import PriceChangesWidget from '@/components/dashboard/PriceChangesWidget';
import SmartInsights from '@/components/dashboard/SmartInsights';
import { Card } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Percent, ShoppingCart, AlertTriangle, Receipt, Flame, Wallet, Scale, ShoppingBag, BarChart3 } from 'lucide-react';
import { computeBranchSettlements } from '@/components/treasury/BranchSettlementLedger';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DashboardChartsTab from '@/components/dashboard/DashboardChartsTab';
import RealDailyProfit from '@/components/dashboard/RealDailyProfit';
import BranchHealthDashboard from '@/components/dashboard/BranchHealthDashboard';
import SalesTrendsChart from '@/components/dashboard/SalesTrendsChart';
import WelcomeDashboard from '@/components/dashboard/WelcomeDashboard';
import ExecutiveSummaryBar from '@/components/dashboard/ExecutiveSummaryBar';
import ManagerWorkspace from '@/components/dashboard/ManagerWorkspace';
import FinancialKPIs from '@/components/dashboard/FinancialKPIs';
import QuickActionsDock from '@/components/dashboard/QuickActionsDock';
import { useRole, ROLES } from '@/lib/RoleContext';

const FETCH_DAYS = 90;

export default function Dashboard() {
  const { t, currency } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const { role } = useRole();
  const [rangeType, setRangeType] = useState('month');
  const [branch, setBranch] = useState('all');
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const dateRange = useMemo(() => {
    if (rangeType === 'custom') return { from: new Date(customFrom), to: new Date(customTo) };
    return getDateRange(rangeType);
  }, [rangeType, customFrom, customTo]);

  const fromStr = formatDate(dateRange.from);
  const toStr = formatDate(dateRange.to);

  const { data: allSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allPurchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allWaste = [] } = useQuery({
    queryKey: ['inventory_waste', ownerFilter],
    queryFn: () => base44.entities.InventoryWaste.filter(ownerFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: walletTx = [] } = useQuery({
    queryKey: ['wallet_transactions', ownerFilter],
    queryFn: () => base44.entities.WalletTransaction.filter(ownerFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory_dashboard', ownerFilter],
    queryFn: () => base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500),
    staleTime: 300000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allPayroll = [] } = useQuery({
    queryKey: ['payroll_runs', ownerFilter],
    queryFn: () => base44.entities.PayrollRun.filter(ownerFilter || {}, '-paid_date', 500),
    staleTime: 300000,
    enabled: !!ownerFilter?.created_by,
  });

  // ── Period-scoped data ────────────────────────────────────────────────
  const filteredSales = useMemo(() =>
    allSales.filter(s => s.date >= fromStr && s.date <= toStr && (branch === 'all' || s.branch === branch)),
    [allSales, fromStr, toStr, branch]
  );
  const filteredPurchases = useMemo(() =>
    allPurchases.filter(p => p.date >= fromStr && p.date <= toStr && (branch === 'all' || p.branch === branch)),
    [allPurchases, fromStr, toStr, branch]
  );
  const filteredExpenses = useMemo(() =>
    allExpenses.filter(e => e.date >= fromStr && e.date <= toStr && (branch === 'all' || e.branch === branch || e.branch === 'all')),
    [allExpenses, fromStr, toStr, branch]
  );
  const filteredWaste = useMemo(() =>
    allWaste.filter(w => w.date >= fromStr && w.date <= toStr && (branch === 'all' || w.branch === branch)),
    [allWaste, fromStr, toStr, branch]
  );
  const totalWasteLoss = useMemo(() => filteredWaste.reduce((s, w) => s + (w.total_loss || 0), 0), [filteredWaste]);

  // ── Correct profit = Sales - Purchase Cost - Expenses (NOT wallet balance) ──
  const metrics = useMemo(() => computeDashboardMetrics(filteredSales, filteredPurchases, filteredExpenses), [filteredSales, filteredPurchases, filteredExpenses]);

  // ── Previous period comparison ────────────────────────────────────────
  const prevRange = useMemo(() => {
    const diffMs = dateRange.to - dateRange.from;
    return { from: new Date(dateRange.from - diffMs - 86400000), to: new Date(dateRange.from - 86400000) };
  }, [dateRange]);
  const prevFrom = formatDate(prevRange.from);
  const prevTo = formatDate(prevRange.to);
  const prevSales = useMemo(() => allSales.filter(s => s.date >= prevFrom && s.date <= prevTo && (branch === 'all' || s.branch === branch)), [allSales, prevFrom, prevTo, branch]);
  const prevPurchases = useMemo(() => allPurchases.filter(p => p.date >= prevFrom && p.date <= prevTo && (branch === 'all' || p.branch === branch)), [allPurchases, prevFrom, prevTo, branch]);
  const prevExpenses = useMemo(() => allExpenses.filter(e => e.date >= prevFrom && e.date <= prevTo && (branch === 'all' || e.branch === branch || e.branch === 'all')), [allExpenses, prevFrom, prevTo, branch]);
  const prevMetrics = useMemo(() => computeDashboardMetrics(prevSales, prevPurchases, prevExpenses), [prevSales, prevPurchases, prevExpenses]);

  // ── Treasury wallet balances — separate from P&L, never mixed into profit ──
  const walletBalances = useMemo(() => {
    const calc = (walletKey) => walletTx.filter(tx => tx.wallet === walletKey)
      .reduce((s, tx) => s + (tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0)), 0);
    const ownerNetwork = calc('owner_network');
    const ownerCash = calc('owner_cash');
    const branchMap = {};
    walletTx.filter(tx => tx.wallet === 'branch_cash' && tx.branch).forEach(tx => {
      if (!branchMap[tx.branch]) branchMap[tx.branch] = 0;
      branchMap[tx.branch] += tx.direction === 'in' ? (tx.amount || 0) : -(tx.amount || 0);
    });
    const totalBranchCash = Object.values(branchMap).reduce((s, v) => s + v, 0);
    // Settlement: total branch balances held by owner
    const settlements = computeBranchSettlements(walletTx, branches);
    const totalHeldByOwner = Object.values(settlements).reduce((s, v) => s + v.remaining, 0);
    return { ownerNetwork, ownerCash, totalBranchCash, totalHeldByOwner };
  }, [walletTx, branches]);

  const vsLabel = (cur, prev) => {
    if (!prev || prev === 0) return null;
    const p = ((cur - prev) / Math.abs(prev) * 100).toFixed(1);
    return `${Number(p) >= 0 ? '+' : ''}${p}% ${t('vs_last_period')}`;
  };

  // ── First-time owner: wait for both queries to finish before deciding ──
  const dataLoading = loadingSales || loadingPurchases;
  const isFirstTime = !dataLoading && allSales.length === 0 && allPurchases.length === 0;

  // Managers see their dedicated branch workspace
  if (role === ROLES.MANAGER) return <ManagerWorkspace />;

  if (dataLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (isFirstTime) return <WelcomeDashboard />;

  return (
    <div className="relative">
      <QuickActionsDock />

      <Tabs defaultValue="overview">
      <PageHeader
        title={t('dashboard')}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/executive-command-center">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> {t('executive_command_center')}
            </Link>
          </Button>
        }
      />

      <TabsList className="w-full mb-4">
        <TabsTrigger value="overview" className="flex-1 text-xs">{t('overview')}</TabsTrigger>
        <TabsTrigger value="charts" className="flex-1 text-xs">{t('chart')}</TabsTrigger>
        <TabsTrigger value="branch-health" className="flex-1 text-xs">{t('branch_rankings')}</TabsTrigger>
      </TabsList>

      <TabsContent value="charts">
        <DashboardFilters
          rangeType={rangeType}
          setRangeType={setRangeType}
          branch={branch}
          setBranch={setBranch}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
        />
        <DashboardChartsTab
          sales={filteredSales}
          purchases={filteredPurchases}
          expenses={filteredExpenses}
          waste={filteredWaste}
          branches={branches}
          currency={currency}
        />
      </TabsContent>

      <TabsContent value="branch-health">
        <BranchHealthDashboard />
      </TabsContent>

      <TabsContent value="overview">

      <DashboardFilters
        rangeType={rangeType}
        setRangeType={setRangeType}
        branch={branch}
        setBranch={setBranch}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
      />

      <SalesTrendsChart
        sales={filteredSales}
        purchases={filteredPurchases}
        currency={currency}
      />

      <FinancialKPIs branch={branch} />
      <ExecutiveSummaryBar />

      <SmartInsights
        sales={filteredSales}
        purchases={filteredPurchases}
        expenses={filteredExpenses}
        waste={filteredWaste}
        inventory={inventory}
        prevSales={prevSales}
        prevPurchases={prevPurchases}
        prevExpenses={prevExpenses}
      />

      {/* ── Real Daily Profit (cash-difference accounting) ── */}
      <RealDailyProfit
        walletTx={walletTx}
        allSales={allSales}
        allPurchases={allPurchases}
        allExpenses={allExpenses}
        allPayroll={allPayroll}
        targetDate={toStr}
        branch={branch}
        currency={currency}
      />

      {/* ── Sales & Profit KPIs (from actual transactions only) ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard label={t('total_sales')} value={formatCurrency(metrics.totalSales, currency)} sublabel={vsLabel(metrics.totalSales, prevMetrics.totalSales)} icon={DollarSign} />
        <KPICard label={t('total_purchase_cost')} value={formatCurrency(metrics.totalPurchaseCost, currency)} sublabel={vsLabel(metrics.totalPurchaseCost, prevMetrics.totalPurchaseCost)} icon={ShoppingCart} color="text-amber-500" />
        <KPICard label={t('profit')} value={formatCurrency(metrics.profit, currency)} sublabel={vsLabel(metrics.profit, prevMetrics.profit)} icon={metrics.profit >= 0 ? TrendingUp : TrendingDown} color={metrics.profit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
        <KPICard label={t('total_expenses')} value={formatCurrency(metrics.totalExpenses, currency)} icon={Receipt} color="text-destructive" />
        <KPICard label={t('net_profit')} value={formatCurrency(metrics.netProfit, currency)} sublabel={vsLabel(metrics.netProfit, prevMetrics.netProfit)} icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown} color={metrics.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
        <KPICard label={t('margin')} value={formatPct(metrics.margin)} icon={Percent} color="text-violet-500" />
      </div>

      {/* ── Treasury balances (separate section — NOT part of P&L) ── */}
      <Card className="p-3 mb-4 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-500" />
            <p className="text-xs font-semibold text-indigo-700">{t('treasury')}</p>
          </div>
          <Link to="/treasury?tab=settlement" className="text-xs text-indigo-500 flex items-center gap-0.5">
            <Scale className="w-3 h-3" /> {t('settlement')}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-background rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">{t('owner_network')}</p>
            <p className={`text-sm font-bold ${walletBalances.ownerNetwork >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatCurrency(walletBalances.ownerNetwork, currency)}
            </p>
          </div>
          <div className="bg-white dark:bg-background rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">{t('owner_cash')}</p>
            <p className={`text-sm font-bold ${walletBalances.ownerCash >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(walletBalances.ownerCash, currency)}
            </p>
          </div>
          <div className="bg-white dark:bg-background rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">{t('branch_cash')}</p>
            <p className={`text-sm font-bold ${walletBalances.totalBranchCash >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
              {formatCurrency(walletBalances.totalBranchCash, currency)}
            </p>
          </div>
          <div className={`rounded-lg p-2 text-center ${walletBalances.totalHeldByOwner >= 0 ? 'bg-violet-50 dark:bg-violet-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5"><Scale className="w-3 h-3" /> {t('settlement')}</p>
            <p className={`text-sm font-bold ${walletBalances.totalHeldByOwner >= 0 ? 'text-violet-600' : 'text-red-500'}`}>
              {formatCurrency(walletBalances.totalHeldByOwner, currency)}
            </p>
          </div>
        </div>
        <div className="text-center mt-1.5">
          <Link to="/treasury" className="text-xs text-indigo-500 underline">{t('treasury')} →</Link>
        </div>
      </Card>

      {/* ── Risk + Waste ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard label={t('credit_pct')} value={formatPct(metrics.creditPct)} icon={AlertTriangle} color="text-orange-500" />
        <KPICard label={t('waste_loss') || 'Waste Loss'} value={formatCurrency(totalWasteLoss, currency)} icon={Flame} color="text-red-500" />
        <div className="col-span-2 flex items-center justify-center bg-card rounded-xl border p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{t('risk')}</p>
            <RiskBadge creditPct={metrics.creditPct} />
          </div>
        </div>
      </div>

      <LowStockWidget />
      <AccountsPayableWidget />
      <PriceChangesWidget />

      {/* ── Upgraded Payment Mix + Charts ── */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('sales_dashboard')}</h2>
        <PaymentMixCharts
          salesData={filteredSales}
          purchasesData={filteredPurchases}
          expensesData={filteredExpenses}
          branches={branches}
        />
      </div>

      </TabsContent>
      </Tabs>

    </div>
  );
}