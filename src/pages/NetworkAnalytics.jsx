import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import BranchSelect from '@/components/shared/BranchSelect';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Wifi, TrendingUp, AlertCircle, CheckCircle2, Clock, Smartphone } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function NetworkAnalytics() {
  const { currency } = useLanguage();
  const { ownerFilter } = useTenant();
  const fmt = v => formatCurrency(v, currency);
  const [filterBranch, setFilterBranch] = useState('all');

  const { data: accounts = [] } = useQuery({
    queryKey: ['network_accounts', ownerFilter],
    queryFn: () => base44.entities.NetworkAccount.filter(ownerFilter, '-created_date', 500),
    staleTime: 30000,
    enabled: !!ownerFilter.created_by,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter, '-date', 10000),
    staleTime: 30000,
    enabled: !!ownerFilter.created_by,
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements_all', ownerFilter],
    queryFn: () => base44.entities.SettlementRecord.filter({ ...ownerFilter, flow_type: 'MANAGER_TO_SPONSOR' }, '-date', 500),
    staleTime: 30000,
    enabled: !!ownerFilter.created_by,
  });

  const accountMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  const filteredAccounts = filterBranch === 'all' ? accounts : accounts.filter(a => a.branch === filterBranch);
  const filteredSales = filterBranch === 'all' ? sales : sales.filter(s => s.branch === filterBranch);
  const filteredSettlements = filterBranch === 'all' ? settlements : settlements.filter(s => s.branch === filterBranch);

  // Per-account sales aggregation
  const accountStats = useMemo(() => {
    const stats = {};
    filteredSales.forEach(s => {
      const accId = s.network_account_id;
      if (!accId) return;
      if (!stats[accId]) stats[accId] = { totalSales: 0, count: 0 };
      stats[accId].totalSales += (s.network || 0);
      stats[accId].count += 1;
    });
    return stats;
  }, [filteredSales]);

  // Per-account settlement aggregation
  const settlementStats = useMemo(() => {
    const stats = {};
    filteredSettlements.forEach(s => {
      const accId = s.network_account_id;
      if (!accId) return;
      if (!stats[accId]) stats[accId] = { totalSettled: 0, pending: 0, approved: 0, rejected: 0 };
      stats[accId].totalSettled += (s.amount || 0);
      stats[accId][s.status] = (stats[accId][s.status] || 0) + 1;
    });
    return stats;
  }, [filteredSettlements]);

  // Top devices chart data
  const deviceChartData = useMemo(() => {
    return filteredAccounts
      .map(a => ({
        name: a.account_name.length > 20 ? a.account_name.substring(0, 18) + '…' : a.account_name,
        fullName: a.account_name,
        sales: accountStats[a.id]?.totalSales || 0,
        settled: settlementStats[a.id]?.totalSettled || 0,
        txCount: accountStats[a.id]?.count || 0,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [filteredAccounts, accountStats, settlementStats]);

  // Branch comparison pie
  const branchPieData = useMemo(() => {
    const byBranch = {};
    filteredSales.forEach(s => {
      if (!s.network_account_id) return;
      const acc = accountMap[s.network_account_id];
      if (!acc) return;
      const b = acc.branch || 'Unknown';
      if (!byBranch[b]) byBranch[b] = 0;
      byBranch[b] += (s.network || 0);
    });
    return Object.entries(byBranch).map(([name, value]) => ({ name, value }));
  }, [filteredSales, accountMap]);

  // Settlement completion rate per account
  const completionData = useMemo(() => {
    return filteredAccounts
      .filter(a => settlementStats[a.id])
      .map(a => {
        const st = settlementStats[a.id];
        const total = (st.pending || 0) + (st.approved || 0) + (st.rejected || 0);
        const rate = total > 0 ? Math.round(((st.approved || 0) / total) * 100) : 0;
        return { name: a.account_name, rate, total };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [filteredAccounts, settlementStats]);

  // Totals
  const totalNetworkSalesWithAccount = filteredSales
    .filter(s => s.network_account_id)
    .reduce((sum, s) => sum + (s.network || 0), 0);

  const totalNetworkSalesWithoutAccount = filteredSales
    .filter(s => !s.network_account_id && (s.network || 0) > 0)
    .reduce((sum, s) => sum + (s.network || 0), 0);

  return (
    <div>
      <PageHeader title="Network Analytics" />

      <div className="mb-4">
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Tracked Sales</p>
          <p className="text-lg font-bold text-emerald-600">{fmt(totalNetworkSalesWithAccount)}</p>
          <p className="text-[10px] text-muted-foreground">with account ID</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Active Devices</p>
          <p className="text-lg font-bold">{filteredAccounts.filter(a => a.is_active).length}</p>
          <p className="text-[10px] text-muted-foreground">of {filteredAccounts.length} total</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Untracked Sales</p>
          <p className="text-lg font-bold text-amber-600">{fmt(totalNetworkSalesWithoutAccount)}</p>
          <p className="text-[10px] text-muted-foreground">no account assigned</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Settlements</p>
          <p className="text-lg font-bold text-blue-600">{filteredSettlements.length}</p>
          <p className="text-[10px] text-muted-foreground">this period</p>
        </Card>
      </div>

      {/* Top performing devices bar chart */}
      {deviceChartData.length > 0 && (
        <Card className="p-4 mb-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />Top Devices by Sales
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deviceChartData} layout="vertical" margin={{ left: 8, right: 12, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="sales" fill="#3b82f6" name="Network Sales" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Branch comparison pie */}
      {branchPieData.length > 1 && (
        <Card className="p-4 mb-4">
          <p className="text-sm font-semibold mb-3">Sales by Branch (Network)</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={branchPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {branchPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-account summary table */}
      <Card className="p-4 mb-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />Account Summary
        </p>
        {filteredAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No accounts found</p>
        ) : (
          <div className="space-y-2">
            {filteredAccounts.map((a, i) => {
              const st = accountStats[a.id] || {};
              const ss = settlementStats[a.id] || {};
              const pending = (ss.pending || 0);
              return (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${a.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{a.account_name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.branch} · {a.network_provider || 'N/A'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">{fmt(st.totalSales || 0)}</p>
                    {pending > 0 && (
                      <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-0">{pending} pending</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Settlement completion rates */}
      {completionData.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />Settlement Completion Rates
          </p>
          <div className="space-y-2">
            {completionData.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground w-28 truncate">{d.name}</p>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${d.rate >= 80 ? 'bg-emerald-500' : d.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${d.rate}%` }}
                  />
                </div>
                <span className="text-xs font-bold w-10 text-right">{d.rate}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}