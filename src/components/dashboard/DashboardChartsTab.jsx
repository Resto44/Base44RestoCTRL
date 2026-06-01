import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { format, parseISO, startOfMonth } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatK = (v) => {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v;
};

export default function DashboardChartsTab({ sales, purchases, expenses, waste, branches, currency }) {
  const { t } = useLanguage();

  // Monthly revenue trend
  const monthlyTrend = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const month = format(parseISO(s.date), 'MMM yy');
      if (!map[month]) map[month] = { month, sales: 0, cost: 0, profit: 0 };
      map[month].sales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    purchases.forEach(p => {
      const month = format(parseISO(p.date), 'MMM yy');
      if (!map[month]) map[month] = { month, sales: 0, cost: 0, profit: 0 };
      map[month].cost += (p.qty || 0) * (p.used_price || p.current_price || 0);
    });
    Object.values(map).forEach(m => { m.profit = m.sales - m.cost; });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-8);
  }, [sales, purchases]);

  // Branch breakdown
  const branchBreakdown = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const key = s.branch || 'Unknown';
      const label = branches.find(b => b.key === key)?.label || key;
      if (!map[label]) map[label] = { name: label, sales: 0 };
      map[label].sales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    return Object.values(map).sort((a, b) => b.sales - a.sales);
  }, [sales, branches]);

  // Payment method mix
  const paymentMix = useMemo(() => {
    let cash = 0, network = 0, credit = 0;
    sales.forEach(s => {
      cash += s.cash || 0;
      network += s.network || 0;
      credit += s.credit || 0;
    });
    const total = cash + network + credit;
    return [
      { name: 'Cash', value: cash, pct: total ? ((cash / total) * 100).toFixed(1) : 0 },
      { name: 'Network', value: network, pct: total ? ((network / total) * 100).toFixed(1) : 0 },
      { name: 'Credit', value: credit, pct: total ? ((credit / total) * 100).toFixed(1) : 0 },
    ].filter(d => d.value > 0);
  }, [sales]);

  // Expense category breakdown
  const expensePie = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      if (!map[cat]) map[cat] = { name: cat, value: 0 };
      map[cat].value += e.amount || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const totalSales = sales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs space-y-1">
        <p className="font-semibold text-foreground">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value, currency)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* Monthly Revenue vs Cost trend */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Monthly Revenue vs Cost</h3>
        {monthlyTrend.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="sales" name="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Payment Mix Pie */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Payment Mix</h3>
          {paymentMix.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentMix} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                    dataKey="value" paddingAngle={2}>
                    {paymentMix.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {paymentMix.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Expense breakdown Pie */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Expenses</h3>
          {expensePie.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={expensePie} cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                    dataKey="value" paddingAngle={2}>
                    {expensePie.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {expensePie.slice(0, 4).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{d.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(d.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Branch Sales Bar */}
      {branchBreakdown.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Sales by Branch</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={branchBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {branchBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-base font-bold text-blue-600">{formatCurrency(totalSales, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-base font-bold text-red-500">{formatCurrency(totalExpenses, currency)}</p>
        </Card>
      </div>
    </div>
  );
}