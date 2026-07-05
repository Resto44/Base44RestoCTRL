import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDateRange, formatDate, formatCurrency, formatPct, computeDashboardMetrics, buildDailyProfitTrend } from '@/lib/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import AsyncPDFButton from '@/components/reports/AsyncPDFButton';
import { useTenant } from '@/lib/TenantContext';
import { useSalesSources } from '@/hooks/useSalesSources';
import { format, startOfMonth } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const RANGES = ['week', 'month', 'year'];

export default function Reports() {
  const { t, currency } = useLanguage();
  const { ownerFilter, isManager, managerBranch, branches } = useTenant();
  const [rangeType, setRangeType] = useState('month');
  const { revenueSources, isLoading: loadingSources } = useSalesSources();

  // enabled as long as we have any filter key (owner has created_by, manager has branch)
  const hasFilter = !!(ownerFilter?.created_by || ownerFilter?.branch);

  const { data: sales = [], isLoading: loadingSales, isError: errorSales } = useQuery({ queryKey: ['sales', ownerFilter], queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 2000), staleTime: 120000, enabled: hasFilter });
  const { data: walletTransactions = [] } = useQuery({
    queryKey: ['wallet_transactions', ownerFilter],
    queryFn: () => base44.entities.WalletTransaction.filter(ownerFilter || {}, '-date', 500),
    enabled: hasFilter,
    staleTime: 60000,
  });
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({ 
    queryKey: ['purchases', ownerFilter], 
    queryFn: async () => {
      if (!ownerFilter?.created_by) return [];
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('created_by', ownerFilter.created_by)
        .in('approval_status', ['approved', 'auto_approved'])
        .order('date', { ascending: false })
        .limit(2000);
      if (error) return [];
      return data || [];
    }, 
    staleTime: 120000, 
    enabled: hasFilter 
  });
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({ queryKey: ['expenses', ownerFilter], queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 2000), staleTime: 120000, enabled: hasFilter });

  const isLoading = loadingSales || loadingPurchases || loadingExpenses || loadingSources;

  const dateRange = useMemo(() => getDateRange(rangeType), [rangeType]);
  const fromStr = formatDate(dateRange.from);
  const toStr = formatDate(dateRange.to);

  // Previous period
  const prevRange = useMemo(() => {
    const diffMs = dateRange.to - dateRange.from;
    return { from: new Date(dateRange.from - diffMs - 86400000), to: new Date(dateRange.from - 86400000) };
  }, [dateRange]);
  const prevFromStr = formatDate(prevRange.from);
  const prevToStr = formatDate(prevRange.to);

  const filtered = (arr) => arr.filter(r => r.date >= fromStr && r.date <= toStr);
  const prevFiltered = (arr) => arr.filter(r => r.date >= prevFromStr && r.date <= prevToStr);

  const metrics = useMemo(() => computeDashboardMetrics(filtered(sales), filtered(purchases), filtered(expenses), rangeType, revenueSources), [sales, purchases, expenses, fromStr, toStr, rangeType, revenueSources]);
  const prevMetrics = useMemo(() => computeDashboardMetrics(prevFiltered(sales), prevFiltered(purchases), prevFiltered(expenses), rangeType, revenueSources), [sales, purchases, expenses, prevFromStr, prevToStr, rangeType, revenueSources]);

  // Network balance calculation
  const networkMetrics = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    const todaySales = sales.filter(s => s.date === todayStr);
    const yesterdaySales = sales.filter(s => s.date === yesterdayStr);

    const todayNetwork = todaySales.reduce((s, r) => s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);
    const yesterdayNetwork = yesterdaySales.reduce((s, r) => s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);

    // Month-to-date balance (Total Network Sales - Settlements)
    const mtdStart = startOfMonth(new Date()).toISOString().split('T')[0];
    const mtdSales = (sales || []).filter(s => s && s.date >= mtdStart);
    const mtdNetworkSales = mtdSales.reduce((s, r) => s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);
    const mtdSettlements = (walletTransactions || [])
      .filter(t => t && t.date >= mtdStart && t.type === 'sent_to_owner')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return {
      today: todayNetwork,
      yesterday: yesterdayNetwork,
      balance: mtdNetworkSales - mtdSettlements,
    };
  }, [sales, walletTransactions]);

  // Branch comparison
  const branchData = useMemo(() => (branches || []).map(b => {
    if (!b) return { name: '', sales: 0, profit: 0, creditPct: 0 };
    const bs = filtered(sales || []).filter(s => s && s.branch === b.key);
    const bp = filtered(purchases || []).filter(p => p && p.branch === b.key);
    const be = filtered(expenses || []).filter(e => e && (e.branch === b.key || e.branch === 'all'));
    const m = computeDashboardMetrics(bs, bp, be, rangeType, revenueSources);
    return { name: b.label || '', sales: m.totalSales, profit: m.profit, creditPct: m.creditPct };
  }), [sales, purchases, expenses, fromStr, toStr, branches, rangeType, revenueSources]);

  const profitTrend = useMemo(() => buildDailyProfitTrend(filtered(sales), filtered(purchases), revenueSources), [sales, purchases, fromStr, toStr, revenueSources]);

  const paymentMix = useMemo(() => [
    { name: t('cash'), value: metrics?.totalCash || 0 },
    { name: t('network'), value: metrics?.totalNetwork || 0 },
    { name: t('credit'), value: metrics?.totalCredit || 0 },
    { name: t('additional_sources') || 'Additional', value: metrics?.totalAdditionalSources || 0 },
  ].filter(d => d.value > 0), [metrics, t]);

  const pct = (cur, prev) => {
    if (!prev || prev === 0) return null;
    const p = ((cur - prev) / Math.abs(prev) * 100).toFixed(1);
    return p;
  };

  const CompRow = ({ label, cur, prev }) => {
    const p = pct(cur, prev);
    return (
      <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="text-right">
          <span className="text-sm font-semibold">{formatCurrency(cur, currency)}</span>
          {p !== null && (
            <span className={`text-xs ms-2 ${Number(p) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {Number(p) >= 0 ? '+' : ''}{p}%
            </span>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('report_title')} />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (errorSales) {
    return (
      <div>
        <PageHeader title={t('report_title')} />
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <p className="text-muted-foreground">{t('error_loading') || 'Failed to load report data.'}</p>
          <Button onClick={() => window.location.reload()} size="sm">{t('retry') || 'Retry'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('report_title')}
        action={
          <AsyncPDFButton
            sales={sales}
            purchases={purchases}
            expenses={expenses}
            rangeType={rangeType}
            fromStr={fromStr}
            toStr={toStr}
          />
        }
      />

      {/* Range selector */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {RANGES.map(r => (
          <Button key={r} size="sm" variant={rangeType === r ? 'default' : 'outline'} onClick={() => setRangeType(r)} className="flex-shrink-0">
            {t(r)}
          </Button>
        ))}
      </div>

      {/* Period comparison KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t('period_comparison')}</h3>
          <CompRow label={t('total_sales')} cur={metrics.totalSales} prev={prevMetrics.totalSales} />
          <CompRow label={t('total_purchase_cost')} cur={metrics.totalPurchaseCost} prev={prevMetrics.totalPurchaseCost} />
          <CompRow label={t('profit')} cur={metrics.profit} prev={prevMetrics.profit} />
          <CompRow label={t('total_expenses')} cur={metrics.totalExpenses} prev={prevMetrics.totalExpenses} />
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t('network_balance') || 'Network Balance'}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('today_network') || 'Today Network'}</span>
              <span className="font-semibold">{formatCurrency(networkMetrics.today, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('yesterday_network') || 'Yesterday Network'}</span>
              <span className="font-semibold">{formatCurrency(networkMetrics.yesterday, currency)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">{t('mtd_balance') || 'MTD Balance (Net)'}</span>
              <span className="font-bold text-primary">{formatCurrency(networkMetrics.balance, currency)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Sales Sources */}
      <Card className="p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">{t('additional_sales_sources') || 'Additional Sales Sources'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('today')}</p>
            <p className="text-lg font-bold">{formatCurrency((sales || []).filter(s => s && s.date === format(new Date(), 'yyyy-MM-dd')).reduce((s, r) => s + (computeDashboardMetrics([r], [], [], 'day', revenueSources).totalAdditionalSources), 0), currency)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('yesterday')}</p>
            <p className="text-lg font-bold">{formatCurrency((sales || []).filter(s => s && s.date === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')).reduce((s, r) => s + (computeDashboardMetrics([r], [], [], 'day', revenueSources).totalAdditionalSources), 0), currency)}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('current_month')}</p>
            <p className="text-lg font-bold">{formatCurrency(filtered(sales || []).reduce((s, r) => s + (computeDashboardMetrics([r], [], [], 'day', revenueSources).totalAdditionalSources), 0), currency)}</p>
          </div>
        </div>
      </Card>

      {/* Profit trend chart */}
      {profitTrend.length > 1 && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">{t('profit_trend')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={profitTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => formatCurrency(v, currency)} />
              <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Branch comparison */}
      {branchData.some(b => b.sales > 0) && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">{t('branch_comparison')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={branchData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => formatCurrency(v, currency)} />
              <Bar dataKey="sales" fill="#2563eb" name={t('total_sales')} radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" fill="#10b981" name={t('profit')} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Payment mix */}
      {paymentMix.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">{t('payment_mix')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {paymentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => formatCurrency(v, currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Branch credit table */}
      <Card className="p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">{t('credit_pct')} {t('by_branch') || 'by Branch'}</h3>
        <div className="space-y-1">
          {branchData.map(b => (
            <div key={b.name} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{b.name}</span>
              <span className={`font-semibold ${b.creditPct > 30 ? 'text-red-500' : 'text-emerald-600'}`}>{formatPct(b.creditPct)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}