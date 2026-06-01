import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/helpers';
import { format, parseISO, startOfWeek, eachDayOfInterval, subDays } from 'date-fns';

const formatK = (v) => {
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return v;
};

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{formatCurrency(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
};

export default function SalesTrendsChart({ sales, purchases, currency }) {
  // ── Daily trend (last 30 days) ───────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({ start: subDays(today, 29), end: today });
    const salesMap = {};
    const costMap = {};
    sales.forEach(s => {
      const d = s.date?.slice(0, 10);
      if (!salesMap[d]) salesMap[d] = 0;
      salesMap[d] += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    purchases.forEach(p => {
      const d = p.date?.slice(0, 10);
      if (!costMap[d]) costMap[d] = 0;
      costMap[d] += (p.qty || 0) * (p.used_price || p.current_price || 0);
    });
    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const rev = salesMap[key] || 0;
      const cost = costMap[key] || 0;
      return {
        date: format(day, 'dd MMM'),
        Revenue: rev,
        Cost: cost,
        Profit: rev - cost,
      };
    });
  }, [sales, purchases]);

  // ── Monthly trend ────────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const m = s.date ? format(parseISO(s.date), 'MMM yy') : null;
      if (!m) return;
      if (!map[m]) map[m] = { month: m, Revenue: 0, Cost: 0, Profit: 0 };
      map[m].Revenue += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    purchases.forEach(p => {
      const m = p.date ? format(parseISO(p.date), 'MMM yy') : null;
      if (!m) return;
      if (!map[m]) map[m] = { month: m, Revenue: 0, Cost: 0, Profit: 0 };
      map[m].Cost += (p.qty || 0) * (p.used_price || p.current_price || 0);
    });
    Object.values(map).forEach(m => { m.Profit = m.Revenue - m.Cost; });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [sales, purchases]);

  // ── KPI summary ──────────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
  const totalCost = purchases.reduce((s, p) => s + (p.qty || 0) * (p.used_price || p.current_price || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Sales & Profit Trends</h3>
        <div className="flex gap-3 text-xs">
          <span className="text-blue-500 font-medium">{formatCurrency(totalRevenue, currency)}</span>
          <span className="text-muted-foreground">rev</span>
          <span className={`font-medium ${totalProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {formatCurrency(totalProfit, currency)}
          </span>
          <span className="text-muted-foreground">profit</span>
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="w-full mb-3 h-7">
          <TabsTrigger value="daily" className="flex-1 text-xs h-6">Daily (30d)</TabsTrigger>
          <TabsTrigger value="monthly" className="flex-1 text-xs h-6">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          {dailyData.every(d => d.Revenue === 0 && d.Cost === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data in last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 9 }} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Profit" stroke="#10b981" fill="url(#profGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Cost" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </TabsContent>

        <TabsContent value="monthly">
          {monthlyData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No monthly data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 9 }} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Profit" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}