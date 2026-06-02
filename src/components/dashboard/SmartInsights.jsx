import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { analyzeBranchPerformance, detectExpenseSpikes, predictLowStock, generateDailySummary } from '@/lib/smartAnalytics';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Lightbulb, Flame, Package, ChevronDown, ChevronUp, Star } from 'lucide-react';

const severityColor = { critical: 'text-red-600 bg-red-50 border-red-200', warning: 'text-amber-600 bg-amber-50 border-amber-200', info: 'text-blue-600 bg-blue-50 border-blue-200' };
const severityIcon = { critical: AlertTriangle, warning: AlertTriangle, info: Lightbulb };

export default function SmartInsights({ sales, purchases, expenses, waste, inventory, prevSales, prevPurchases, prevExpenses }) {
  const { currency } = useLanguage();
  const { branches } = useTenant();
  const [expanded, setExpanded] = useState(true);

  const branchAnalysis = useMemo(() =>
    branches.length > 0 ? analyzeBranchPerformance(branches, sales, purchases, expenses, waste, prevSales || [], prevPurchases || []) : [],
    [branches, sales, purchases, expenses, waste, prevSales, prevPurchases]
  );

  const expenseSpikes = useMemo(() =>
    detectExpenseSpikes(expenses, prevExpenses || []),
    [expenses, prevExpenses]
  );

  const stockPredictions = useMemo(() =>
    predictLowStock(inventory || [], purchases),
    [inventory, purchases]
  );

  const dailySummary = useMemo(() =>
    generateDailySummary(branches, sales, purchases, expenses, waste),
    [branches, sales, purchases, expenses, waste]
  );

  const allInsights = useMemo(() => {
    const insights = [];

    // Daily summary alerts
    dailySummary.alerts.forEach(a => {
      insights.push({ id: `daily_${a.msg}`, severity: a.type, title: 'Today', message: a.msg, icon: AlertTriangle });
    });

    // Branch issues
    branchAnalysis.forEach(b => {
      b.issues.forEach(issue => {
        insights.push({
          id: `${b.key}_${issue.type}`,
          severity: issue.severity,
          title: `${b.label}: ${issue.label}`,
          message: issue.detail,
          icon: issue.type === 'high_waste' ? Flame : issue.type === 'low_sales' ? TrendingDown : AlertTriangle,
        });
      });
    });

    // Expense spikes
    expenseSpikes.forEach(spike => {
      insights.push({
        id: `spike_${spike.category}`,
        severity: spike.severity,
        title: `${spike.category} expenses up ${spike.pct}%`,
        message: `${currency}${spike.previous.toFixed(0)} → ${currency}${spike.current.toFixed(0)}`,
        icon: AlertTriangle,
      });
    });

    // Stock predictions
    stockPredictions.slice(0, 5).forEach(pred => {
      insights.push({
        id: `stock_${pred.product_name}_${pred.branch}`,
        severity: pred.severity,
        title: `Low stock: ${pred.product_name}`,
        message: `~${pred.daysLeft} day(s) left at current usage (${pred.branch})`,
        icon: Package,
      });
    });

    return insights.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] || 2) - (order[b.severity] || 2);
    });
  }, [branchAnalysis, expenseSpikes, stockPredictions, dailySummary, currency]);

  if (allInsights.length === 0 && branchAnalysis.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Branch Leaderboard */}
      {branchAnalysis.length > 1 && (
        <Card className="p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="font-semibold text-sm">Branch Rankings</p>
          </div>
          <div className="space-y-2">
            {branchAnalysis.map((b, idx) => (
              <div key={b.key} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : 'bg-orange-300 text-white'}`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{b.label}</p>
                    <p className="text-xs font-bold text-primary">{b.score}/100</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${b.score >= 70 ? 'bg-emerald-500' : b.score >= 40 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${b.score}%` }} />
                  </div>
                </div>
                {b.profitChange !== 0 && (
                  <div className={`text-xs font-semibold ${b.profitChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {b.profitChange >= 0 ? '+' : ''}{b.profitChange.toFixed(0)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Smart Insights */}
      {allInsights.length > 0 && (
        <Card className="p-3">
          <button
            className="flex items-center justify-between w-full mb-2"
            onClick={() => setExpanded(e => !e)}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <p className="font-semibold text-sm">Smart Insights</p>
              <Badge className="bg-amber-100 text-amber-700 text-xs">{allInsights.length}</Badge>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {expanded && (
            <div className="space-y-2">
              {allInsights.map(ins => {
                const Icon = ins.icon || Lightbulb;
                return (
                  <div key={ins.id} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${severityColor[ins.severity] || severityColor.info}`}>
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{ins.title}</p>
                      <p className="opacity-80">{ins.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}