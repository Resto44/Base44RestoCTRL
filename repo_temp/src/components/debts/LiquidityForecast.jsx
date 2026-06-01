import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Shield, AlertTriangle, Droplets } from 'lucide-react';
import { addDays, format, parseISO, isWithinInterval, startOfDay } from 'date-fns';

function liquidityScore(net30, net60, net90) {
  // Score based on expected net position
  const scores = [net30, net60, net90].map(n => {
    if (n > 50000) return 100;
    if (n > 20000) return 80;
    if (n > 5000) return 60;
    if (n > 0) return 40;
    if (n > -10000) return 20;
    return 0;
  });
  return Math.round((scores[0] * 0.5 + scores[1] * 0.3 + scores[2] * 0.2));
}

function ScoreGauge({ score }) {
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const bg = score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const label = score >= 70 ? 'سيولة ممتازة' : score >= 40 ? 'سيولة متوسطة' : 'سيولة ضعيفة';
  const Icon = score >= 70 ? Shield : score >= 40 ? Droplets : AlertTriangle;

  return (
    <div className={`rounded-xl border p-4 text-center ${bg}`}>
      <Icon className={`w-6 h-6 mx-auto mb-1 ${color}`} />
      <div className={`text-4xl font-black ${color}`}>{score}</div>
      <div className={`text-xs font-semibold ${color}`}>{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">مؤشر السيولة / 100</div>
    </div>
  );
}

export default function LiquidityForecast({ debts }) {
  const today = startOfDay(new Date());

  const forecast = useMemo(() => {
    const receivables = debts.filter(d => d.type === 'receivable' && d.status !== 'paid' && d.status !== 'written_off');
    const liabilities = debts.filter(d => d.type === 'liability' && d.status !== 'paid' && d.status !== 'written_off');

    // Build daily cash flow projection for next 90 days
    const dailyMap = {};
    const initDay = (key) => { if (!dailyMap[key]) dailyMap[key] = { date: key, inflow: 0, outflow: 0, net: 0 }; };

    receivables.forEach(d => {
      if (!d.due_date) return;
      const dueDate = parseISO(d.due_date);
      if (dueDate >= today && dueDate <= addDays(today, 90)) {
        const key = format(dueDate, 'yyyy-MM-dd');
        initDay(key);
        dailyMap[key].inflow += d.remaining_amount || 0;
      }
    });

    liabilities.forEach(d => {
      if (!d.due_date) return;
      const dueDate = parseISO(d.due_date);
      if (dueDate >= today && dueDate <= addDays(today, 90)) {
        const key = format(dueDate, 'yyyy-MM-dd');
        initDay(key);
        dailyMap[key].outflow += d.remaining_amount || 0;
      }
    });

    // Build cumulative chart data (weekly buckets)
    const weeks = [];
    let cumulative = 0;
    for (let w = 0; w < 13; w++) {
      const weekStart = addDays(today, w * 7);
      const weekEnd = addDays(today, (w + 1) * 7 - 1);
      let inflow = 0, outflow = 0;
      Object.values(dailyMap).forEach(d => {
        const dt = parseISO(d.date);
        if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
          inflow += d.inflow;
          outflow += d.outflow;
        }
      });
      cumulative += inflow - outflow;
      weeks.push({
        label: `W${w + 1}`,
        inflow: Math.round(inflow),
        outflow: Math.round(outflow),
        net: Math.round(inflow - outflow),
        cumulative: Math.round(cumulative),
      });
    }

    // 30/60/90 day buckets
    const bucket = (days) => {
      const end = addDays(today, days);
      let inflow = 0, outflow = 0;
      Object.values(dailyMap).forEach(d => {
        const dt = parseISO(d.date);
        if (dt >= today && dt <= end) {
          inflow += d.inflow;
          outflow += d.outflow;
        }
      });
      return { inflow: Math.round(inflow), outflow: Math.round(outflow), net: Math.round(inflow - outflow) };
    };

    const b30 = bucket(30), b60 = bucket(60), b90 = bucket(90);
    const score = liquidityScore(b30.net, b60.net, b90.net);

    // Upcoming items
    const upcoming = [
      ...receivables
        .filter(d => d.due_date && parseISO(d.due_date) >= today && parseISO(d.due_date) <= addDays(today, 30))
        .map(d => ({ ...d, direction: 'in' })),
      ...liabilities
        .filter(d => d.due_date && parseISO(d.due_date) >= today && parseISO(d.due_date) <= addDays(today, 30))
        .map(d => ({ ...d, direction: 'out' })),
    ].sort((a, b) => a.due_date.localeCompare(b.due_date));

    return { weeks, b30, b60, b90, score, upcoming };
  }, [debts]);

  return (
    <div className="space-y-4">
      {/* Liquidity Score */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreGauge score={forecast.score} />
        <div className="space-y-2">
          {[
            { label: '30 يوم', data: forecast.b30, color: 'blue' },
            { label: '60 يوم', data: forecast.b60, color: 'indigo' },
            { label: '90 يوم', data: forecast.b90, color: 'violet' },
          ].map(({ label, data, color }) => (
            <div key={label} className={`rounded-lg p-2 bg-${color}-50 border border-${color}-100`}>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-semibold text-${color}-700`}>{label}</span>
                <span className={`text-xs font-bold ${data.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.net >= 0 ? '+' : ''}{data.net.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                <span>↑{data.inflow.toLocaleString()}</span>
                <span>↓{data.outflow.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cumulative Chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">توقع التدفق النقدي التراكمي (13 أسبوع)</CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={forecast.weeks}>
              <defs>
                <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => [`${v.toLocaleString()} ر.س`, name === 'cumulative' ? 'تراكمي' : name === 'inflow' ? 'واردات' : 'مدفوعات']} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fill="url(#gradPos)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Upcoming 30d */}
      {forecast.upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">📅 استحقاقات الـ 30 يوم القادمة</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {forecast.upcoming.slice(0, 8).map(d => (
              <div key={d.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${d.direction === 'in' ? 'bg-green-50' : 'bg-red-50'}`}>
                <div>
                  <div className="text-xs font-semibold">{d.party_name}</div>
                  <div className="text-[10px] text-muted-foreground">{d.due_date}</div>
                </div>
                <div className={`text-sm font-bold ${d.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {d.direction === 'in' ? '+' : '-'}{(d.remaining_amount || 0).toLocaleString()} ر.س
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}