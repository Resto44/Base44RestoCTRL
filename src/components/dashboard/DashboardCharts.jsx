import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

const COLORS = ['hsl(172, 66%, 50%)', 'hsl(217, 91%, 50%)', 'hsl(0, 84%, 60%)'];

export default function DashboardCharts({ salesData, purchasesData, metrics }) {
  const { t, currency } = useLanguage();

  // Build profit by day
  const dailyMap = {};
  salesData.forEach(s => {
    const d = s.date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, cost: 0 };
    dailyMap[d].sales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
  });
  purchasesData.forEach(p => {
    const d = p.date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, cost: 0 };
    dailyMap[d].cost += (p.qty || 0) * (p.used_price || p.current_price || 0);
  });
  const profitTrend = Object.values(dailyMap)
    .map(d => ({ ...d, profit: d.sales - d.cost, label: d.date?.slice(5) }))
    .sort((a, b) => a.date?.localeCompare(b.date));

  const paymentMix = [
    { name: t('cash'), value: metrics.totalCash || 0 },
    { name: t('network'), value: metrics.totalNetwork || 0 },
    { name: t('credit'), value: metrics.totalCredit || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {profitTrend.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('profit_trend')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={profitTrend}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${currency}${Number(v).toLocaleString()}`} />
              <Line type="monotone" dataKey="profit" stroke="hsl(217, 91%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {paymentMix.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('payment_mix')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                {paymentMix.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${currency}${Number(v).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}