import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const COLORS = {
  cash: '#10b981',
  network: '#3b82f6',
  credit: '#f59e0b',
  sales: '#6366f1',
  cost: '#ef4444',
  profit: '#10b981',
};

const fmt = (v, currency) => `${currency}${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function PaymentMixCharts({ salesData, purchasesData, expensesData = [], branches = [] }) {
  const { t, currency } = useLanguage();
  const [drillLevel, setDrillLevel] = useState('org'); // org | branch
  const [activeBranch, setActiveBranch] = useState(null);

  // ── Org-level aggregates ──────────────────────────────────────────────
  const orgMetrics = useMemo(() => {
    const totalSales = salesData.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
    const totalCash = salesData.reduce((s, r) => s + (r.cash || 0), 0);
    const totalNetwork = salesData.reduce((s, r) => s + (r.network || 0), 0);
    const totalCredit = salesData.reduce((s, r) => s + (r.credit || 0), 0);
    const totalCost = purchasesData.reduce((s, p) => s + (p.qty || 0) * (p.used_price || p.current_price || 0), 0);
    const totalExpenses = expensesData.reduce((s, e) => s + (e.amount || 0), 0);
    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpenses;
    return { totalSales, totalCash, totalNetwork, totalCredit, totalCost, totalExpenses, grossProfit, netProfit };
  }, [salesData, purchasesData, expensesData]);

  // ── Branch-level breakdown ────────────────────────────────────────────
  const branchData = useMemo(() => {
    const keys = branches.length
      ? branches.map(b => b.key)
      : [...new Set(salesData.map(s => s.branch))];
    return keys.map(key => {
      const bLabel = branches.find(b => b.key === key)?.label || key;
      const bs = salesData.filter(s => s.branch === key);
      const bp = purchasesData.filter(p => p.branch === key);
      const be = expensesData.filter(e => e.branch === key || e.branch === 'all');
      const sales = bs.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
      const cost = bp.reduce((s, p) => s + (p.qty || 0) * (p.used_price || p.current_price || 0), 0);
      const expenses = be.reduce((s, e) => s + (e.amount || 0), 0);
      const cash = bs.reduce((s, r) => s + (r.cash || 0), 0);
      const network = bs.reduce((s, r) => s + (r.network || 0), 0);
      const credit = bs.reduce((s, r) => s + (r.credit || 0), 0);
      return { key, name: bLabel, sales, cost, expenses, profit: sales - cost - expenses, cash, network, credit };
    }).filter(b => b.sales > 0 || b.cost > 0);
  }, [salesData, purchasesData, expensesData, branches]);

  // ── Profit trend (daily) ──────────────────────────────────────────────
  const profitTrend = useMemo(() => {
    const map = {};
    const src = activeBranch ? salesData.filter(s => s.branch === activeBranch) : salesData;
    const psrc = activeBranch ? purchasesData.filter(p => p.branch === activeBranch) : purchasesData;
    src.forEach(s => {
      const d = s.date;
      if (!map[d]) map[d] = { date: d, sales: 0, cost: 0 };
      map[d].sales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    psrc.forEach(p => {
      const d = p.date;
      if (!map[d]) map[d] = { date: d, sales: 0, cost: 0 };
      map[d].cost += (p.qty || 0) * (p.used_price || p.current_price || 0);
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, profit: d.sales - d.cost, label: d.date?.slice(5) }));
  }, [salesData, purchasesData, activeBranch]);

  // ── Payment mix pie ───────────────────────────────────────────────────
  const paymentMix = useMemo(() => {
    const src = activeBranch ? salesData.filter(s => s.branch === activeBranch) : salesData;
    const cash = src.reduce((s, r) => s + (r.cash || 0), 0);
    const network = src.reduce((s, r) => s + (r.network || 0), 0);
    const credit = src.reduce((s, r) => s + (r.credit || 0), 0);
    return [
      { name: t('cash') || 'Cash', value: cash, color: COLORS.cash },
      { name: t('network') || 'Network', value: network, color: COLORS.network },
      { name: t('credit') || 'Credit', value: credit, color: COLORS.credit },
    ].filter(d => d.value > 0);
  }, [salesData, activeBranch, t]);

  const displayMetrics = activeBranch
    ? branchData.find(b => b.key === activeBranch) || orgMetrics
    : orgMetrics;

  const isBranchLevel = drillLevel === 'branch' && activeBranch;

  return (
    <div className="space-y-3">
      {/* Drill-down header */}
      {isBranchLevel && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setDrillLevel('org'); setActiveBranch(null); }}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> All Branches
          </Button>
          <span className="text-sm font-semibold">{branchData.find(b => b.key === activeBranch)?.name || activeBranch}</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('total_sales') || 'Sales', value: displayMetrics.totalSales ?? displayMetrics.sales, color: 'text-indigo-600' },
          { label: t('total_purchase_cost') || 'Cost', value: displayMetrics.totalCost ?? displayMetrics.cost, color: 'text-red-500' },
          { label: t('profit') || 'Profit', value: displayMetrics.grossProfit ?? displayMetrics.profit, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-3 text-center">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${color}`}>{fmt(value, currency)}</p>
          </Card>
        ))}
      </div>

      {/* Branch comparison stacked bar */}
      {branchData.length > 0 && !isBranchLevel && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t('branch_comparison') || 'Branch Comparison'}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={branchData} onClick={(d) => { if (d?.activePayload) { setDrillLevel('branch'); setActiveBranch(d.activePayload[0]?.payload?.key); } }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v, currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sales" name={t('total_sales') || 'Sales'} fill={COLORS.sales} radius={[3,3,0,0]} />
              <Bar dataKey="cost" name={t('total_purchase_cost') || 'Cost'} fill={COLORS.cost} radius={[3,3,0,0]} />
              <Bar dataKey="profit" name={t('profit') || 'Profit'} fill={COLORS.profit} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-1">Tap a bar to drill into that branch</p>
        </Card>
      )}

      {/* Payment mix donut */}
      {paymentMix.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t('payment_mix') || 'Payment Mix'}</h3>
          <div className="flex items-center gap-4">
            <div style={{ width: 140, height: 140 }}>
              <PieChart width={140} height={140}>
                <Pie data={paymentMix} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={32} paddingAngle={3}>
                  {paymentMix.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v, currency)} />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2">
              {paymentMix.map(({ name, value, color }) => {
                const total = paymentMix.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{pct}%</span>
                      <span className="text-muted-foreground ml-1">{fmt(value, currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Profit trend line */}
      {profitTrend.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">
            {t('profit_trend') || 'Profit Trend'}
            {activeBranch && ` — ${branchData.find(b => b.key === activeBranch)?.name || activeBranch}`}
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={profitTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v, currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sales" name={t('total_sales') || 'Sales'} stroke={COLORS.sales} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name={t('profit') || 'Profit'} stroke={COLORS.profit} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cost" name={t('total_purchase_cost') || 'Cost'} stroke={COLORS.cost} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}