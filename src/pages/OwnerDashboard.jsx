import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Users, Truck, Building2, AlertTriangle, Zap, BarChart3,
  ArrowUpRight, ArrowDownRight, Plus, CreditCard, Wallet,
  Receipt, Target, Award, Star, ChevronRight, RefreshCw,
  Activity, PieChart, Clock, CheckCircle2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import SalesForm from '@/components/sales/SalesForm';
import PurchaseForm from '@/components/purchases/PurchaseForm';

// ── KPI Card Component ────────────────────────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', onClick }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950',   icon: 'text-blue-600',   border: 'border-blue-100 dark:border-blue-900' },
    green:  { bg: 'bg-emerald-50 dark:bg-emerald-950', icon: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-900' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-950',  icon: 'text-amber-600',  border: 'border-amber-100 dark:border-amber-900' },
    red:    { bg: 'bg-red-50 dark:bg-red-950',      icon: 'text-red-600',    border: 'border-red-100 dark:border-red-900' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950',icon: 'text-purple-600', border: 'border-purple-100 dark:border-purple-900' },
    cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-950',    icon: 'text-cyan-600',   border: 'border-cyan-100 dark:border-cyan-900' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <Card
      className={`border ${c.border} cursor-pointer hover:shadow-md transition-all active:scale-[0.98]`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trendValue ?? trend)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickActionBtn({ icon: Icon, label, color, onClick }) {
  const colorMap = {
    blue:   'bg-blue-500 hover:bg-blue-600',
    green:  'bg-emerald-500 hover:bg-emerald-600',
    amber:  'bg-amber-500 hover:bg-amber-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    red:    'bg-red-500 hover:bg-red-600',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-white ${colorMap[color] || colorMap.blue} transition-colors active:scale-95 shadow-sm`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}

// ── Branch Ranking Card ───────────────────────────────────────────────────────
function BranchRankCard({ rank, name, revenue, profit, trend, currency }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <span className="text-lg w-7 text-center">{medals[rank - 1] || `#${rank}`}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{currency}{revenue?.toLocaleString()}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {profit >= 0 ? '+' : ''}{currency}{profit?.toLocaleString()}
        </p>
        <div className={`flex items-center gap-0.5 justify-end text-[10px] ${trend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { t, currency, lang } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('overview');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  // Data queries
  const { data: allSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales_dashboard', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allPurchases = [] } = useQuery({
    queryKey: ['purchases_dashboard', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses_dashboard', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees_count', ownerFilter],
    queryFn: () => base44.entities.Employee.filter(ownerFilter || {}),
    staleTime: 300000,
    enabled: !!ownerFilter?.created_by,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory_count', ownerFilter],
    queryFn: () => base44.entities.Inventory.filter(ownerFilter || {}),
    staleTime: 300000,
    enabled: !!ownerFilter?.created_by,
  });

  // Computed KPIs
  const kpis = useMemo(() => {
    const todaySales = allSales.filter(s => s.date === today);
    const monthSales = allSales.filter(s => s.date >= monthStart);
    const monthPurchases = allPurchases.filter(p => p.date >= monthStart);
    const monthExpenses = allExpenses.filter(e => e.date >= monthStart);

    const revenueToday = todaySales.reduce((s, r) => s + (r.total_sales || 0), 0);
    const revenueMonth = monthSales.reduce((s, r) => s + (r.total_sales || 0), 0);
    const purchaseCost = monthPurchases.reduce((s, r) => s + (r.total_amount || 0), 0);
    const expenseCost = monthExpenses.reduce((s, r) => s + (r.amount || 0), 0);
    const netProfit = revenueMonth - purchaseCost - expenseCost;
    const profitMargin = revenueMonth > 0 ? ((netProfit / revenueMonth) * 100).toFixed(1) : 0;
    const cashSales = monthSales.reduce((s, r) => s + (r.cash || 0), 0);
    const creditSales = monthSales.reduce((s, r) => s + (r.credit || 0), 0);
    const inventoryValue = inventory.reduce((s, i) => s + ((i.quantity || 0) * (i.cost_price || 0)), 0);
    const activeEmployees = employees.filter(e => e.is_active !== false).length;
    const activeDrivers = employees.filter(e => e.position?.toLowerCase().includes('driver') && e.is_active !== false).length;

    return {
      revenueToday, revenueMonth, netProfit, profitMargin,
      cashBalance: cashSales, creditSales, purchaseCost, expenseCost,
      inventoryValue, activeEmployees, activeDrivers,
    };
  }, [allSales, allPurchases, allExpenses, employees, inventory, today, monthStart]);

  // Branch rankings
  const branchRankings = useMemo(() => {
    const monthSales = allSales.filter(s => s.date >= monthStart);
    const monthPurchases = allPurchases.filter(p => p.date >= monthStart);
    const monthExpenses = allExpenses.filter(e => e.date >= monthStart);
    const branchMap = {};
    monthSales.forEach(s => {
      if (!branchMap[s.branch]) branchMap[s.branch] = { revenue: 0, purchases: 0, expenses: 0 };
      branchMap[s.branch].revenue += s.total_sales || 0;
    });
    monthPurchases.forEach(p => {
      if (!branchMap[p.branch]) branchMap[p.branch] = { revenue: 0, purchases: 0, expenses: 0 };
      branchMap[p.branch].purchases += p.total_amount || 0;
    });
    monthExpenses.forEach(e => {
      const b = e.branch || 'all';
      if (!branchMap[b]) branchMap[b] = { revenue: 0, purchases: 0, expenses: 0 };
      branchMap[b].expenses += e.amount || 0;
    });
    return Object.entries(branchMap)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        profit: data.revenue - data.purchases - data.expenses,
        trend: Math.floor(Math.random() * 20) - 5, // placeholder
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [allSales, allPurchases, allExpenses, monthStart]);

  // Chart data - last 7 days
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const dayLabel = format(subDays(new Date(), 6 - i), 'MM/dd');
      const daySales = allSales.filter(s => s.date === d);
      const dayPurchases = allPurchases.filter(p => p.date === d);
      const revenue = daySales.reduce((s, r) => s + (r.total_sales || 0), 0);
      const cost = dayPurchases.reduce((s, r) => s + (r.total_amount || 0), 0);
      return { date: dayLabel, revenue, cost, profit: revenue - cost };
    });
  }, [allSales, allPurchases]);

  const fmt = (n) => `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const isLoading = loadingSales;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('executive_command_center')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
        </div>
        <Badge variant="outline" className="text-xs capitalize">{role}</Badge>
      </div>

      {/* Quick Actions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">{t('quick_actions')}</p>
          <div className="grid grid-cols-5 gap-2">
            <QuickActionBtn icon={Plus}        label={t('add_sale')}           color="green"  onClick={() => setShowSaleModal(true)} />
            <QuickActionBtn icon={ShoppingCart} label={t('add_purchase')}      color="blue"   onClick={() => setShowPurchaseModal(true)} />
            <QuickActionBtn icon={Receipt}      label={t('add_expense')}        color="amber"  onClick={() => {}} />
            <QuickActionBtn icon={CreditCard}   label={t('customer_collection')} color="purple" onClick={() => {}} />
            <QuickActionBtn icon={Wallet}       label={t('supplier_payment')}  color="red"    onClick={() => {}} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="overview" className="text-xs">{t('overview')}</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs">{t('financial_summary')}</TabsTrigger>
          <TabsTrigger value="branches" className="text-xs">{t('branch_rankings')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-3 mt-3">
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard title={t('revenue_today')}    value={fmt(kpis.revenueToday)}  icon={DollarSign} color="green"  trend={5}  />
            <KPICard title={t('revenue_this_month')} value={fmt(kpis.revenueMonth)} icon={TrendingUp}  color="blue"   trend={8}  />
            <KPICard title={t('net_profit')}        value={fmt(kpis.netProfit)}     icon={Target}     color={kpis.netProfit >= 0 ? 'green' : 'red'} trend={kpis.netProfit >= 0 ? 3 : -3} />
            <KPICard title={t('profit_margin')}     value={`${kpis.profitMargin}%`} icon={PieChart}   color="purple" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard title={t('cash_balance')}      value={fmt(kpis.cashBalance)}   icon={Wallet}     color="cyan"   />
            <KPICard title={t('inventory_value')}   value={fmt(kpis.inventoryValue)} icon={Package}   color="amber"  />
            <KPICard title={t('active_employees')}  value={kpis.activeEmployees}    icon={Users}      color="blue"   />
            <KPICard title={t('active_drivers')}    value={kpis.activeDrivers}      icon={Truck}      color="purple" />
          </div>

          {/* Sales Trend Chart */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('sales_overview')} — {t('last_7_days')}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v) => [`${currency}${v.toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} name={t('total_sales')} />
                  <Area type="monotone" dataKey="profit"  stroke="#10b981" fill="url(#profGrad)" strokeWidth={2} name={t('profit')} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <KPICard title={t('receivables')}   value={fmt(kpis.creditSales)}    icon={ArrowUpRight}   color="amber"  />
            <KPICard title={t('payables')}       value={fmt(kpis.purchaseCost)}   icon={ArrowDownRight} color="red"    />
            <KPICard title={t('cash_balance')}   value={fmt(kpis.cashBalance)}    icon={Wallet}         color="green"  />
            <KPICard title={t('bank_balance')}   value={fmt(0)}                   icon={CreditCard}     color="blue"   />
          </div>
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('financial_summary')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { label: t('revenue_this_month'), value: kpis.revenueMonth, color: 'text-blue-600' },
                { label: t('total_purchase_cost'), value: kpis.purchaseCost, color: 'text-amber-600' },
                { label: t('total_expenses'), value: kpis.expenseCost, color: 'text-red-500' },
                { label: t('net_profit'), value: kpis.netProfit, color: kpis.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{fmt(row.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch Rankings Tab */}
        <TabsContent value="branches" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                {t('branch_rankings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {branchRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('no_data')}</p>
              ) : (
                branchRankings.map((b, i) => (
                  <BranchRankCard key={b.name} rank={i + 1} {...b} currency={currency} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Branch comparison bar chart */}
          {branchRankings.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">{t('branch_comparison')}</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={branchRankings} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v) => [`${currency}${v.toLocaleString()}`, '']}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('total_sales')} />
                    <Bar dataKey="profit"  fill="#10b981" radius={[4, 4, 0, 0]} name={t('profit')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Sale Modal */}
      <Dialog open={showSaleModal} onOpenChange={setShowSaleModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('add_sale')}</DialogTitle>
          </DialogHeader>
          <SalesForm onSuccess={() => setShowSaleModal(false)} onCancel={() => setShowSaleModal(false)} />
        </DialogContent>
      </Dialog>

      {/* Add Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('add_purchase')}</DialogTitle>
          </DialogHeader>
          <PurchaseForm onSuccess={() => setShowPurchaseModal(false)} onCancel={() => setShowPurchaseModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
