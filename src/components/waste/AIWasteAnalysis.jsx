import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend
} from 'recharts';
import { Brain, Flame, TrendingDown, Lightbulb, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

export default function AIWasteAnalysis() {
  const { currency } = useLanguage();
  const { branches } = useTenant();
  const [filterBranch, setFilterBranch] = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const ninetyAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');

  const { data: waste = [] } = useQuery({
    queryKey: ['inventory_waste'],
    queryFn: () => base44.entities.InventoryWaste.list('-date', 500),
    staleTime: 120000,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.DailySales.list('-date', 500),
    staleTime: 120000,
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('name', 500),
    staleTime: 300000,
  });

  const fmt = v => formatCurrency(v, currency);

  // Filter by branch
  const filteredWaste = useMemo(() =>
    waste.filter(w => (filterBranch === 'all' || w.branch === filterBranch) && w.date >= ninetyAgo),
    [waste, filterBranch, ninetyAgo]
  );
  const filteredSales = useMemo(() =>
    sales.filter(s => (filterBranch === 'all' || s.branch === filterBranch) && s.date >= ninetyAgo),
    [sales, filterBranch, ninetyAgo]
  );

  // ── Waste by product ──────────────────────────────────────────────────
  const wasteByProduct = useMemo(() => {
    const map = {};
    filteredWaste.forEach(w => {
      if (!map[w.product_name]) map[w.product_name] = { name: w.product_name, totalQty: 0, totalLoss: 0, records: [] };
      map[w.product_name].totalQty += w.qty || 0;
      map[w.product_name].totalLoss += w.total_loss || 0;
      map[w.product_name].records.push(w);
    });
    return Object.values(map).sort((a, b) => b.totalLoss - a.totalLoss).slice(0, 10);
  }, [filteredWaste]);

  // ── Waste vs Sales correlation (weekly) ──────────────────────────────
  const weeklyCorrData = useMemo(() => {
    const weeks = {};
    filteredWaste.forEach(w => {
      const d = new Date(w.date);
      const weekNum = Math.floor((new Date(today) - d) / (7 * 86400000));
      const wk = `W-${weekNum}`;
      if (!weeks[wk]) weeks[wk] = { week: wk, waste: 0, sales: 0, order: weekNum };
      weeks[wk].waste += w.total_loss || 0;
    });
    filteredSales.forEach(s => {
      const d = new Date(s.date);
      const weekNum = Math.floor((new Date(today) - d) / (7 * 86400000));
      const wk = `W-${weekNum}`;
      if (!weeks[wk]) weeks[wk] = { week: wk, waste: 0, sales: 0, order: weekNum };
      weeks[wk].sales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    return Object.values(weeks)
      .sort((a, b) => b.order - a.order)
      .slice(0, 12)
      .reverse()
      .map(w => ({ ...w, waste: Math.round(w.waste), sales: Math.round(w.sales) }));
  }, [filteredWaste, filteredSales, today]);

  // ── Waste by day of week ───────────────────────────────────────────────
  const wasteByDow = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = {};
    days.forEach(d => map[d] = { day: d, waste: 0, count: 0 });
    filteredWaste.forEach(w => {
      const dow = days[new Date(w.date).getDay()];
      map[dow].waste += w.total_loss || 0;
      map[dow].count += 1;
    });
    const salesMap = {};
    days.forEach(d => salesMap[d] = 0);
    filteredSales.forEach(s => {
      const dow = days[new Date(s.date).getDay()];
      salesMap[dow] += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    });
    return days.map(d => ({
      day: d,
      waste: Math.round(map[d].waste),
      wasteRate: salesMap[d] > 0 ? ((map[d].waste / salesMap[d]) * 100).toFixed(1) : '0',
    }));
  }, [filteredWaste, filteredSales]);

  // ── AI Prep Recommendations ───────────────────────────────────────────
  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiResult(null);

    const topWastedItems = wasteByProduct.slice(0, 8).map(p => ({
      product: p.name,
      avg_daily_loss: (p.totalLoss / 90).toFixed(2),
      total_qty_wasted: p.totalQty.toFixed(1),
      total_loss_value: p.totalLoss.toFixed(2),
    }));

    const avgDailySales = filteredSales.length > 0
      ? (filteredSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0) / 90).toFixed(2)
      : 0;

    const highWasteDay = wasteByDow.reduce((max, d) => parseFloat(d.wasteRate) > parseFloat(max.wasteRate) ? d : max, wasteByDow[0]);
    const lowWasteDay = wasteByDow.reduce((min, d) => parseFloat(d.wasteRate) < parseFloat(min.wasteRate) ? d : min, wasteByDow[0]);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a restaurant operations analyst. Analyze inventory waste data and provide prep quantity recommendations.

Branch: ${filterBranch === 'all' ? 'All branches' : filterBranch}
Analysis period: Last 90 days

TOP WASTED ITEMS (by loss value):
${JSON.stringify(topWastedItems, null, 2)}

SALES & WASTE CONTEXT:
- Average daily sales: ${currency}${avgDailySales}
- Highest waste day: ${highWasteDay?.day} (${highWasteDay?.wasteRate}% waste rate)
- Lowest waste day: ${lowWasteDay?.day} (${lowWasteDay?.wasteRate}% waste rate)

TASK: For each top wasted item, provide:
1. Root cause analysis (overprep, demand mismatch, storage issue, etc.)
2. Recommended daily prep quantity (as a % reduction from current)
3. Day-specific adjustments (prep less on low-sales days)
4. One specific action to reduce waste

Be concise and actionable. Focus on reducing spoilage without impacting service levels.`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          total_waste_reduction_potential: { type: 'string' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product: { type: 'string' },
                root_cause: { type: 'string' },
                prep_reduction_pct: { type: 'number' },
                day_adjustments: { type: 'string' },
                action: { type: 'string' },
                priority: { type: 'string' },
              },
            },
          },
          general_tips: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    setAiResult(result);
    setAiLoading(false);
  };

  const totalWasteLoss = filteredWaste.reduce((s, w) => s + (w.total_loss || 0), 0);
  const avgDailySales = filteredSales.length > 0
    ? filteredSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0) / 90
    : 0;
  const wasteRatePct = avgDailySales * 90 > 0 ? ((totalWasteLoss / (avgDailySales * 90)) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {/* Filter */}
      <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center bg-red-50 border-red-200">
          <p className="text-lg font-bold text-red-600">{fmt(totalWasteLoss)}</p>
          <p className="text-xs text-muted-foreground">Total Loss (90d)</p>
        </Card>
        <Card className="p-3 text-center bg-amber-50 border-amber-200">
          <p className="text-lg font-bold text-amber-600">{wasteRatePct}%</p>
          <p className="text-xs text-muted-foreground">Waste/Sales Ratio</p>
        </Card>
        <Card className="p-3 text-center bg-orange-50 border-orange-200">
          <p className="text-lg font-bold text-orange-600">{filteredWaste.length}</p>
          <p className="text-xs text-muted-foreground">Waste Events</p>
        </Card>
      </div>

      {/* Top wasted items */}
      {wasteByProduct.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Top Wasted Items (by cost)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={wasteByProduct.slice(0, 7)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${currency}${v.toFixed(0)}`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="totalLoss" fill="#ef4444" radius={[0, 4, 4, 0]} name="Loss Value" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Waste vs Sales correlation */}
      {weeklyCorrData.length > 1 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-1">Waste vs Sales Correlation (Weekly)</p>
          <p className="text-xs text-muted-foreground mb-3">High waste weeks with low sales = overprep problem</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weeklyCorrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={v => `${currency}${(v/1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={v => `${currency}${v.toFixed(0)}`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} dot={false} name="Sales" />
              <Line yAxisId="right" type="monotone" dataKey="waste" stroke="#ef4444" strokeWidth={2} dot={false} name="Waste Loss" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Waste by day of week */}
      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">Waste Rate by Day of Week</p>
        <div className="grid grid-cols-7 gap-1">
          {wasteByDow.map(d => {
            const rate = parseFloat(d.wasteRate);
            const intensity = rate > 5 ? 'bg-red-500' : rate > 2 ? 'bg-amber-400' : rate > 0 ? 'bg-emerald-400' : 'bg-muted';
            return (
              <div key={d.day} className="text-center">
                <div className={`h-12 rounded-lg ${intensity} flex items-end justify-center pb-1`} style={{ opacity: Math.max(0.2, Math.min(1, rate / 8)) }}>
                </div>
                <p className="text-xs font-medium mt-1">{d.day}</p>
                <p className="text-xs text-muted-foreground">{d.wasteRate}%</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Red = high waste rate relative to sales</p>
      </Card>

      {/* AI Analysis button */}
      <Card className="p-4 border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">AI Prep Quantity Optimizer</p>
            <p className="text-xs text-muted-foreground">Analyzes waste + sales patterns to suggest daily prep levels</p>
          </div>
        </div>
        <Button className="w-full" onClick={handleAIAnalysis} disabled={aiLoading || filteredWaste.length === 0}>
          {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Brain className="w-4 h-4 mr-2" /> Generate Prep Recommendations</>}
        </Button>
        {filteredWaste.length === 0 && <p className="text-xs text-muted-foreground text-center mt-2">No waste data to analyze yet</p>}
      </Card>

      {/* AI Results */}
      {aiResult && (
        <div className="space-y-3">
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">AI Analysis Summary</p>
                <p className="text-sm mt-1">{aiResult.summary}</p>
                {aiResult.total_waste_reduction_potential && (
                  <Badge className="mt-2 bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Potential: {aiResult.total_waste_reduction_potential}
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {aiResult.recommendations?.map((rec, i) => (
            <Card key={i} className={`p-4 ${rec.priority === 'high' ? 'border-red-200' : rec.priority === 'medium' ? 'border-amber-200' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-bold">{rec.product}</p>
                <div className="flex items-center gap-1">
                  {rec.prep_reduction_pct > 0 && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <TrendingDown className="w-3 h-3 mr-0.5" /> -{rec.prep_reduction_pct}% prep
                    </Badge>
                  )}
                  {rec.priority && (
                    <Badge className={`text-xs border ${rec.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-muted text-muted-foreground'}`}>
                      {rec.priority}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {rec.root_cause && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <span><span className="font-medium">Root cause:</span> {rec.root_cause}</span>
                  </div>
                )}
                {rec.day_adjustments && (
                  <div className="flex items-start gap-1.5">
                    <Flame className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                    <span><span className="font-medium">Day adjustments:</span> {rec.day_adjustments}</span>
                  </div>
                )}
                {rec.action && (
                  <div className="flex items-start gap-1.5 bg-primary/5 rounded p-2">
                    <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    <span><span className="font-medium">Action:</span> {rec.action}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {aiResult.general_tips?.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold mb-2">General Tips</p>
              <ul className="space-y-1.5">
                {aiResult.general_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}