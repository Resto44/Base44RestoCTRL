import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency, formatPct, getDateRange, formatDate } from '@/lib/helpers';
import { getBranchPerformanceRankings } from '@/services/analytics/branchAnalytics';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function EnhancedBranchRankings() {
  const { ownerFilter, branches } = useTenant();
  const { t, currency } = useLanguage();
  const [rangeType, setRangeType] = React.useState('month');

  const dateRange = useMemo(() => getDateRange(rangeType), [rangeType]);
  const fromStr = formatDate(dateRange.from);
  const toStr = formatDate(dateRange.to);

  // Fetch branch performance rankings
  const { data: branchRankings = [], isLoading } = useQuery({
    queryKey: ['branch_rankings', ownerFilter, fromStr, toStr],
    queryFn: () => getBranchPerformanceRankings(ownerFilter, branches, fromStr, toStr),
    enabled: !!ownerFilter?.created_by && branches.length > 0,
    staleTime: 120000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const topBranch = branchRankings[0];
  const bottomBranch = branchRankings[branchRankings.length - 1];

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['today', 'week', 'month', 'quarter', 'year'].map(period => (
          <button
            key={period}
            onClick={() => setRangeType(period)}
            className={`px-3 py-1 text-xs rounded whitespace-nowrap transition ${rangeType === period ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
          >
            {t(period)}
          </button>
        ))}
      </div>

      {/* Top Performer Highlight */}
      {topBranch && (
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-amber-200">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-bold text-amber-900">{t('top_performer')}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t('branch')}</p>
              <p className="text-sm font-bold">{topBranch.branchLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('revenue')}</p>
              <p className="text-sm font-bold text-blue-600">{formatCurrency(topBranch.totalSales, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('net_profit')}</p>
              <p className="text-sm font-bold text-emerald-600">{formatCurrency(topBranch.netProfit, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('score')}</p>
              <p className="text-sm font-bold text-amber-600">{topBranch.score.toFixed(0)}/100</p>
            </div>
          </div>
        </Card>
      )}

      {/* Branch Rankings Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t('rank')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('branch')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('revenue')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('profit')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('margin')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {branchRankings.map((branch, idx) => {
                const isTopPerformer = idx === 0;
                const isBottomPerformer = idx === branchRankings.length - 1;
                const rowClass = isTopPerformer ? 'bg-emerald-50 dark:bg-emerald-950' : isBottomPerformer ? 'bg-red-50 dark:bg-red-950' : '';

                return (
                  <tr key={branch.branchKey} className={`${rowClass} hover:bg-slate-50 dark:hover:bg-slate-800 transition`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{idx + 1}</span>
                        {isTopPerformer && <Trophy className="w-4 h-4 text-amber-600" />}
                        {isBottomPerformer && <AlertTriangle className="w-4 h-4 text-red-600" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{branch.branchLabel}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(branch.totalSales, currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={branch.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {formatCurrency(branch.netProfit, currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={branch.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {formatPct(branch.profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={branch.score >= 80 ? 'default' : branch.score >= 60 ? 'secondary' : 'destructive'}>
                        {branch.score.toFixed(0)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Performance Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">{t('performance_insights')}</h4>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{t('top_branch')}: {topBranch?.branchLabel} ({formatPct(topBranch?.score)})</span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingDown className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{t('needs_attention')}: {bottomBranch?.branchLabel} ({formatPct(bottomBranch?.score)})</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold flex-shrink-0">{t('avg_score')}:</span>
              <span>{(branchRankings.reduce((sum, b) => sum + b.score, 0) / branchRankings.length).toFixed(0)}/100</span>
            </li>
          </ul>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">{t('key_metrics')}</h4>
          <ul className="space-y-2 text-xs">
            <li className="flex justify-between">
              <span>{t('total_revenue')}:</span>
              <span className="font-bold">{formatCurrency(branchRankings.reduce((sum, b) => sum + b.totalSales, 0), currency)}</span>
            </li>
            <li className="flex justify-between">
              <span>{t('combined_profit')}:</span>
              <span className="font-bold text-emerald-600">{formatCurrency(branchRankings.reduce((sum, b) => sum + b.netProfit, 0), currency)}</span>
            </li>
            <li className="flex justify-between">
              <span>{t('total_waste')}:</span>
              <span className="font-bold text-red-600">{formatCurrency(branchRankings.reduce((sum, b) => sum + b.totalWasteLoss, 0), currency)}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
