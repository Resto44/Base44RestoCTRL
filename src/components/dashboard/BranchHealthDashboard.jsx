import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend
} from 'recharts';
import { AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];



const UI = {
  en: {
    subtitle: 'Based on the last 30 days across all modules.',
    ranking: 'Branch Health Score Ranking',
    comparison: 'Cost Efficiency Comparison',
    no_branches: 'No branches configured yet.',
    sales30: 'Sales (30d)', expenses: 'Expenses', waste: 'Waste Loss',
    health: 'Health Score', score: 'Score',
    excellent: 'Excellent', good: 'Good', average: 'Average', at_risk: 'At Risk',
    neg_cash: 'Negative cash balance', low_stock: 'low-stock items',
    high_waste: 'High waste rate', healthy: 'Healthy branch',
  },
  ar: {
    subtitle: 'بناءً على آخر 30 يوماً من جميع الوحدات.',
    ranking: 'تصنيف صحة الفروع',
    comparison: 'مقارنة الكفاءة التشغيلية',
    no_branches: 'لم يتم إضافة فروع بعد.',
    sales30: 'المبيعات (30 يوم)', expenses: 'المصاريف', waste: 'خسائر الهدر',
    health: 'درجة الصحة', score: 'النتيجة',
    excellent: 'ممتاز', good: 'جيد', average: 'متوسط', at_risk: 'في خطر',
    neg_cash: 'رصيد نقدي سلبي', low_stock: 'منتجات منخفضة',
    high_waste: 'هدر مرتفع', healthy: 'فرع صحي',
  },
  fa: {
    subtitle: 'بر اساس ۳۰ روز گذشته از تمام ماژول‌ها.',
    ranking: 'رتبه‌بندی سلامت شعب',
    comparison: 'مقایسه کارایی هزینه',
    no_branches: 'هنوز شعبه‌ای تنظیم نشده.',
    sales30: 'فروش (۳۰ روز)', expenses: 'هزینه‌ها', waste: 'ضرر اتلاف',
    health: 'امتیاز سلامت', score: 'امتیاز',
    excellent: 'عالی', good: 'خوب', average: 'متوسط', at_risk: 'در خطر',
    neg_cash: 'موجودی نقدی منفی', low_stock: 'کمبود موجودی',
    high_waste: 'اتلاف بالا', healthy: 'شعبه سالم',
  },
};

function scoreLabel(score, u) {
  if (score >= 80) return { label: u.excellent, color: 'text-emerald-600', bg: 'bg-emerald-100 border-emerald-300' };
  if (score >= 60) return { label: u.good,      color: 'text-blue-600',    bg: 'bg-blue-100 border-blue-300' };
  if (score >= 40) return { label: u.average,   color: 'text-amber-600',   bg: 'bg-amber-100 border-amber-300' };
  return                  { label: u.at_risk,   color: 'text-red-600',     bg: 'bg-red-100 border-red-300' };
}

export default function BranchHealthDashboard() {
  const { currency, lang } = useLanguage();
  const u = UI[lang] || UI.en;
  const { branches } = useTenant();

  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const { ownerFilter } = useTenant();
  const { data: sales = [] } = useQuery({ queryKey: ['sales', ownerFilter], queryFn: () => base44.entities.DailySales.filter(ownerFilter, '-date', 1000), staleTime: 120000, enabled: !!ownerFilter.created_by });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', ownerFilter], queryFn: () => base44.entities.Expense.filter(ownerFilter, '-date', 500), staleTime: 120000, enabled: !!ownerFilter.created_by });
  const { data: waste = [] } = useQuery({ queryKey: ['inventory_waste', ownerFilter], queryFn: () => base44.entities.InventoryWaste.filter(ownerFilter, '-date', 200), staleTime: 120000, enabled: !!ownerFilter.created_by });
  const { data: walletTx = [] } = useQuery({ queryKey: ['wallet_transactions', ownerFilter], queryFn: () => base44.entities.WalletTransaction.filter(ownerFilter, '-date', 500), staleTime: 120000, enabled: !!ownerFilter.created_by });
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory_dashboard', ownerFilter], queryFn: () => base44.entities.Inventory.filter(ownerFilter, 'product_name', 500), staleTime: 300000, enabled: !!ownerFilter.created_by });

  const branchMetrics = useMemo(() => {
    const recentSales = sales.filter(s => s.date >= thirtyDaysAgo);
    const recentExpenses = expenses.filter(e => e.date >= thirtyDaysAgo);
    const recentWaste = waste.filter(w => w.date >= thirtyDaysAgo);

    return branches.map(b => {
      const bSales = recentSales.filter(s => s.branch === b.key);
      const bExpenses = recentExpenses.filter(e => e.branch === b.key || e.branch === 'all');
      const bWaste = recentWaste.filter(w => w.branch === b.key);
      const bTx = walletTx.filter(tx => tx.branch === b.key && tx.wallet === 'branch_cash');
      const bInventory = inventory.filter(i => i.branch === b.key);

      const totalSales = bSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
      const totalCostOfGoods = 0; // purchases not linked per branch in this aggregation
      const totalExpenses = bExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalWasteLoss = bWaste.reduce((s, w) => s + (w.total_loss || 0), 0);
      const cashBalance = bTx.reduce((s, tx) => s + (tx.direction === 'in' ? tx.amount : -tx.amount), 0);

      const lowStockCount = bInventory.filter(i => (i.opening_stock || 0) <= (i.low_stock_threshold || 5)).length;

      // ── Scoring (0–100 each dimension, weighted) ──
      // 1. Sales Margin (sales vs expenses) — 30%
      const marginScore = totalSales > 0
        ? Math.min(100, Math.max(0, ((totalSales - totalExpenses) / totalSales) * 200))
        : 50;

      // 2. Cost Efficiency (expenses relative to sales) — 25%
      const costRatio = totalSales > 0 ? totalExpenses / totalSales : 0.5;
      const costScore = Math.min(100, Math.max(0, (1 - costRatio) * 100));

      // 3. Waste Control — 20%
      const wastePct = totalSales > 0 ? totalWasteLoss / totalSales : 0;
      const wasteScore = Math.min(100, Math.max(0, (1 - wastePct * 10) * 100));

      // 4. Cash Balance — 15%
      const cashScore = cashBalance >= 0 ? Math.min(100, 50 + cashBalance / 100) : Math.max(0, 50 + cashBalance / 100);

      // 5. Inventory Health — 10%
      const inventoryScore = bInventory.length > 0
        ? Math.max(0, 100 - (lowStockCount / bInventory.length) * 100)
        : 70;

      const composite = (marginScore * 0.30) + (costScore * 0.25) + (wasteScore * 0.20) + (cashScore * 0.15) + (inventoryScore * 0.10);

      return {
        key: b.key,
        label: b.label,
        totalSales,
        totalExpenses,
        totalWasteLoss,
        cashBalance,
        lowStockCount,
        inventoryTotal: bInventory.length,
        composite: Math.round(composite),
        dimensions: [
          { subject: 'Margin', score: Math.round(marginScore) },
          { subject: 'Cost Eff.', score: Math.round(costScore) },
          { subject: 'Waste Ctrl', score: Math.round(wasteScore) },
          { subject: 'Cash', score: Math.round(cashScore) },
          { subject: 'Inventory', score: Math.round(inventoryScore) },
        ],
      };
    }).sort((a, b) => b.composite - a.composite);
  }, [branches, sales, expenses, waste, walletTx, inventory, thirtyDaysAgo]);

  const rankingData = branchMetrics.map((b, i) => ({ name: b.label, score: b.composite, rank: i + 1 }));

  const costEffData = branchMetrics.map(b => ({
    name: b.label,
    [u.sales30]: Math.round(b.totalSales),
    [u.expenses]: Math.round(b.totalExpenses),
    [u.waste]: Math.round(b.totalWasteLoss),
  }));

  const fmt = v => formatCurrency(v, currency);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{u.subtitle}</p>

      {/* Branch Ranking */}
      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">{u.ranking}</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rankingData} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={v => [`${v}/100`, u.health]} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {rankingData.map((entry, i) => (
                <Cell key={i} fill={entry.score >= 80 ? '#10b981' : entry.score >= 60 ? '#6366f1' : entry.score >= 40 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Individual Branch Cards */}
      {branchMetrics.map((b, idx) => {
        const cfg = scoreLabel(b.composite, u);
        return (
          <Card key={b.key} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-bold">#{idx + 1}</span>
                  <p className="text-sm font-bold">{b.label}</p>
                </div>
                <Badge className={`text-xs border mt-1 ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${cfg.color}`}>{b.composite}</p>
                <p className="text-xs text-muted-foreground">/100</p>
              </div>
            </div>

            {/* Radar chart */}
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={b.dimensions} outerRadius={55}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar dataKey="score" stroke={COLORS[idx % COLORS.length]} fill={COLORS[idx % COLORS.length]} fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>

            {/* Key stats */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">{u.sales30}</p>
                <p className="text-xs font-bold">{fmt(b.totalSales)}</p>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">{u.expenses}</p>
                <p className="text-xs font-bold text-red-500">{fmt(b.totalExpenses)}</p>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">{u.waste}</p>
                <p className="text-xs font-bold text-orange-500">{fmt(b.totalWasteLoss)}</p>
              </div>
            </div>

            {/* Alerts */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {b.cashBalance < 0 && (
                <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {u.neg_cash}
                </div>
              )}
              {b.lowStockCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {b.lowStockCount} {u.low_stock}
                </div>
              )}
              {b.totalWasteLoss > b.totalSales * 0.05 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3" /> {u.high_waste}
                </div>
              )}
              {b.composite >= 75 && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> {u.healthy}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Comparison Chart */}
      {costEffData.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">{u.comparison}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costEffData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={u.sales30} fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey={u.expenses} fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey={u.waste} fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {branchMetrics.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{u.no_branches}</p>
        </div>
      )}
    </div>
  );
}