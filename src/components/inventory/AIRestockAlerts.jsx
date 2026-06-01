import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/helpers';
import { Sparkles, AlertTriangle, Clock, TrendingUp, Package, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * AIRestockAlerts
 * - Computes velocity trend per product (last 4 weeks vs prior 4 weeks)
 * - Calculates suggested lead time based on consumption rate
 * - Uses LLM to produce prioritized restock recommendations
 */
export default function AIRestockAlerts({ forecast, purchases, branches }) {
  const { currency } = useLanguage();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Velocity trend: last 4 weeks vs prior 4 weeks ──────────────────
  const velocityData = useMemo(() => {
    const today = new Date();
    const week4Ago = formatDate(new Date(today - 28 * 86400000));
    const week8Ago = formatDate(new Date(today - 56 * 86400000));
    const todayStr = formatDate(today);

    const recent = {};
    const prior = {};
    purchases.forEach(p => {
      if (!p.product_id) return;
      const key = p.product_id;
      if (p.date >= week4Ago && p.date <= todayStr) {
        recent[key] = (recent[key] || 0) + (p.qty || 0);
      } else if (p.date >= week8Ago && p.date < week4Ago) {
        prior[key] = (prior[key] || 0) + (p.qty || 0);
      }
    });

    return forecast.map(f => {
      const recentQty = recent[f.product_id] || 0;
      const priorQty = prior[f.product_id] || 0;
      const trend = priorQty > 0 ? ((recentQty - priorQty) / priorQty * 100) : 0;
      // Suggested lead time: if consumption is high relative to stock, order earlier
      const suggestedLeadDays = f.daysLeft !== null
        ? Math.max(1, Math.min(14, Math.ceil((f.daysLeft || 0) * 0.3)))
        : 3;
      return { ...f, recentQty, priorQty, trend: Math.round(trend), suggestedLeadDays };
    }).filter(f => f.needsReorder || f.daysLeft !== null);
  }, [forecast, purchases]);

  // ── Weekly trend sparkline per top product ─────────────────────────
  const sparklines = useMemo(() => {
    const top5 = velocityData.slice(0, 5);
    return top5.map(item => {
      const weeks = [];
      for (let w = 6; w >= 0; w--) {
        const weekStart = formatDate(new Date(Date.now() - (w + 1) * 7 * 86400000));
        const weekEnd = formatDate(new Date(Date.now() - w * 7 * 86400000));
        const qty = purchases
          .filter(p => p.product_id === item.product_id && p.date >= weekStart && p.date <= weekEnd)
          .reduce((s, p) => s + (p.qty || 0), 0);
        weeks.push({ w: `W-${w}`, qty });
      }
      return { ...item, weeks };
    });
  }, [velocityData, purchases]);

  const runAIAnalysis = async () => {
    setLoading(true);
    const critical = velocityData.filter(f => f.daysLeft !== null && f.daysLeft <= 7);
    const summary = critical.slice(0, 10).map(f =>
      `${f.product_name} (${f.branch}): ${f.daysLeft} days left, avg ${f.avgDaily} ${f.unit}/day, trend ${f.trend > 0 ? '+' : ''}${f.trend}%`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an inventory manager for a restaurant chain. Analyze these critical stock items and provide actionable restock recommendations:

${summary}

For each item provide:
1. Urgency level (CRITICAL/HIGH/MEDIUM)
2. Recommended reorder quantity (based on 14-day buffer)
3. Suggested order date (considering lead time)
4. Brief reason

Return structured JSON only.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_name: { type: 'string' },
                branch: { type: 'string' },
                urgency: { type: 'string' },
                reorder_qty: { type: 'number' },
                order_by_date: { type: 'string' },
                reason: { type: 'string' },
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });
    setAnalysis(result);
    setLoading(false);
  };

  const urgencyColor = (u) => {
    if (u === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200';
    if (u === 'HIGH') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const critical = velocityData.filter(f => f.daysLeft !== null && f.daysLeft <= 3);
  const warning = velocityData.filter(f => f.daysLeft !== null && f.daysLeft > 3 && f.daysLeft <= 7);

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
          <p className="text-xs text-red-700 font-semibold">{critical.length}</p>
          <p className="text-xs text-muted-foreground">Critical (≤3d)</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
          <p className="text-xs text-amber-700 font-semibold">{warning.length}</p>
          <p className="text-xs text-muted-foreground">Warning (≤7d)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
          <p className="text-xs text-blue-700 font-semibold">{velocityData.filter(f => f.trend > 10).length}</p>
          <p className="text-xs text-muted-foreground">Trend ↑</p>
        </div>
      </div>

      {/* Velocity sparklines */}
      {sparklines.length > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Consumption Velocity (7 weeks)
          </p>
          <div className="space-y-3">
            {sparklines.map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate max-w-28">{item.product_name}</span>
                    <Badge variant="outline" className="text-xs py-0">{item.branch}</Badge>
                    {item.trend !== 0 && (
                      <span className={`text-xs font-semibold ${item.trend > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {item.trend > 0 ? '↑' : '↓'}{Math.abs(item.trend)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Lead: {item.suggestedLeadDays}d</span>
                    <span className={`text-xs font-bold ${item.daysLeft !== null && item.daysLeft <= 3 ? 'text-red-500' : item.daysLeft !== null && item.daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {item.daysLeft !== null ? `${item.daysLeft}d left` : '—'}
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={36}>
                  <AreaChart data={item.weeks} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={item.daysLeft !== null && item.daysLeft <= 3 ? '#ef4444' : '#3b82f6'} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={item.daysLeft !== null && item.daysLeft <= 3 ? '#ef4444' : '#3b82f6'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="qty" stroke={item.daysLeft !== null && item.daysLeft <= 3 ? '#ef4444' : '#3b82f6'} fill={`url(#grad${i})`} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lead time table */}
      <Card className="p-3">
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-amber-500" /> Restock Schedule & Lead Times
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-1.5 text-left font-semibold">Product</th>
                <th className="pb-1.5 text-left font-semibold">Branch</th>
                <th className="pb-1.5 text-right font-semibold">Days Left</th>
                <th className="pb-1.5 text-right font-semibold">Lead Time</th>
                <th className="pb-1.5 text-right font-semibold">Order By</th>
                <th className="pb-1.5 text-right font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {velocityData.filter(f => f.daysLeft !== null && f.daysLeft <= 14).map((f, i) => {
                const orderByDate = f.daysLeft !== null
                  ? formatDate(new Date(Date.now() + Math.max(0, f.daysLeft - f.suggestedLeadDays) * 86400000))
                  : '—';
                return (
                  <tr key={i} className={`border-b border-border/40 last:border-0 ${f.daysLeft <= 3 ? 'bg-red-50/50' : f.daysLeft <= 7 ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-2 font-medium">{f.product_name}</td>
                    <td className="py-2 text-muted-foreground">{f.branch}</td>
                    <td className={`py-2 text-right font-bold ${f.daysLeft <= 3 ? 'text-red-500' : f.daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {f.daysLeft}d
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{f.suggestedLeadDays}d</td>
                    <td className="py-2 text-right font-semibold">{orderByDate}</td>
                    <td className={`py-2 text-right ${f.trend > 10 ? 'text-red-500' : f.trend < -10 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {f.trend > 0 ? '+' : ''}{f.trend}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {velocityData.filter(f => f.daysLeft !== null && f.daysLeft <= 14).length === 0 && (
            <p className="text-center text-muted-foreground py-4">All items have sufficient stock (&gt;14 days)</p>
          )}
        </div>
      </Card>

      {/* AI Analysis */}
      <Card className="p-3 border-violet-200 bg-violet-50 dark:bg-violet-950/20">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Restock Recommendations
          </p>
          <Button size="sm" variant="outline" onClick={runAIAnalysis} disabled={loading} className="h-7 text-xs border-violet-300">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>

        {!analysis && !loading && (
          <p className="text-xs text-muted-foreground">Click "Run Analysis" to get AI-powered restock prioritization based on current stock levels, consumption velocity, and lead times.</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3">
            <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
            <p className="text-xs text-muted-foreground">Analyzing inventory patterns...</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-2 mt-2">
            {analysis.summary && (
              <p className="text-xs text-violet-700 bg-white dark:bg-background rounded p-2 border border-violet-200">{analysis.summary}</p>
            )}
            {analysis.recommendations?.map((rec, i) => (
              <div key={i} className="bg-white dark:bg-background rounded-lg p-2.5 border border-violet-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{rec.product_name}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-xs py-0 ${urgencyColor(rec.urgency)}`}>{rec.urgency}</Badge>
                    <span className="text-xs text-muted-foreground">{rec.branch}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Order: <strong className="text-foreground">{rec.reorder_qty} units</strong></span>
                  <span>By: <strong className="text-foreground">{rec.order_by_date}</strong></span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}