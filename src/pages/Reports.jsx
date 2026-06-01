import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDateRange, formatDate, formatCurrency, formatPct, computeDashboardMetrics, buildDailyProfitTrend } from '@/lib/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import AsyncPDFButton from '@/components/reports/AsyncPDFButton';
import { useTenant } from '@/lib/TenantContext';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const RANGES = ['week', 'month', 'year'];

export default function Reports() {
  const { t, currency } = useLanguage();
  const { ownerFilter, isManager, managerBranch, branches } = useTenant();
  const [rangeType, setRangeType] = useState('month');

  // enabled as long as we have any filter key (owner has created_by, manager has branch)
  const hasFilter = !!(ownerFilter.created_by || ownerFilter.branch);

  const { data: sales = [], isLoading: loadingSales, isError: errorSales } = useQuery({ queryKey: ['sales', ownerFilter], queryFn: () => base44.entities.DailySales.filter(ownerFilter, '-date', 10000), enabled: hasFilter });
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({ queryKey: ['purchases', ownerFilter], queryFn: () => base44.entities.Purchase.filter(ownerFilter, '-date', 10000), enabled: hasFilter });
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({ queryKey: ['expenses', ownerFilter], queryFn: () => base44.entities.Expense.filter(ownerFilter, '-date', 10000), enabled: hasFilter });

  const isLoading = loadingSales || loadingPurchases || loadingExpenses;

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

  const metrics = useMemo(() => computeDashboardMetrics(filtered(sales), filtered(purchases), filtered(expenses)), [sales, purchases, expenses, fromStr, toStr]);
  const prevMetrics = useMemo(() => computeDashboardMetrics(prevFiltered(sales), prevFiltered(purchases), prevFiltered(expenses)), [sales, purchases, expenses, prevFromStr, prevToStr]);

  // Branch comparison
  const branchData = useMemo(() => branches.map(b => {
    const bs = filtered(sales).filter(s => s.branch === b.key);
    const bp = filtered(purchases).filter(p => p.branch === b.key);
    const be = filtered(expenses).filter(e => e.branch === b.key || e.branch === 'all');
    const m = computeDashboardMetrics(bs, bp, be);
    return { name: b.label, sales: m.totalSales, profit: m.profit, creditPct: m.creditPct };
  }), [sales, purchases, expenses, fromStr, toStr, branches]);

  const profitTrend = useMemo(() => buildDailyProfitTrend(filtered(sales), filtered(purchases)), [sales, purchases, fromStr, toStr]);

  const paymentMix = useMemo(() => [
    { name: t('cash'), value: metrics.totalCash },
    { name: t('network'), value: metrics.totalNetwork },
    { name: t('credit'), value: metrics.totalCredit },
  ].filter(d => d.value > 0), [metrics]);

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
      <Card className="p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">{t('period_comparison')}</h3>
        <CompRow label={t('total_sales')} cur={metrics.totalSales} prev={prevMetrics.totalSales} />
        <CompRow label={t('total_purchase_cost')} cur={metrics.totalPurchaseCost} prev={prevMetrics.totalPurchaseCost} />
        <CompRow label={t('profit')} cur={metrics.profit} prev={prevMetrics.profit} />
        <CompRow label={t('total_expenses')} cur={metrics.totalExpenses} prev={prevMetrics.totalExpenses} />
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