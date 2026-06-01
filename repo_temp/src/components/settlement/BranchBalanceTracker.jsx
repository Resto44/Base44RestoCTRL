/**
 * BranchBalanceTracker
 * Shows per-branch: network sent, received by sponsor, received by owner, spent back, remaining.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck, TrendingDown } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';

export default function BranchBalanceTracker() {
  const { currency } = useLanguage();
  const { ownerFilter } = useTenant();
  const fmt = v => formatCurrency(v, currency);

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['settlements_all', ownerFilter],
    queryFn: () => base44.entities.SettlementRecord.filter(ownerFilter, '-date', 500),
    staleTime: 30000,
    enabled: !!ownerFilter.created_by,
  });

  const branchData = useMemo(() => {
    const map = {};

    // MANAGER_TO_SPONSOR approved = received by sponsor
    settlements
      .filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && s.status === 'approved')
      .forEach(s => {
        const b = s.branch || 'Unknown';
        if (!map[b]) map[b] = { branch: b, sent: 0, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0 };
        map[b].sent += s.amount || 0;
        map[b].receivedBySponsor += s.amount || 0;
      });

    // SPONSOR_TO_OWNER — use branch field to attribute
    settlements
      .filter(s => s.flow_type === 'SPONSOR_TO_OWNER' && s.status !== 'rejected' && s.branch)
      .forEach(s => {
        const b = s.branch;
        if (!map[b]) map[b] = { branch: b, sent: 0, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0 };
        map[b].sentToOwner += s.amount || 0;
      });

    // OWNER_TO_BRANCH
    settlements
      .filter(s => s.flow_type === 'OWNER_TO_BRANCH' && s.status !== 'rejected' && s.branch)
      .forEach(s => {
        const b = s.branch;
        if (!map[b]) map[b] = { branch: b, sent: 0, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0 };
        map[b].ownerToBranch += s.amount || 0;
      });

    return Object.values(map).map(b => ({
      ...b,
      // The correct sponsor remaining formula
      sponsorRemaining: b.receivedBySponsor - b.sentToOwner,
      remaining: b.receivedBySponsor - b.sentToOwner, // kept for chart compat
      spentOnBranch: b.ownerToBranch,
    })).sort((a, b) => b.sent - a.sent);
  }, [settlements]);

  // Global totals
  const totals = useMemo(() => {
    const notRejected = settlements.filter(s => s.status !== 'rejected');
    const sponsorRemaining = branchData.reduce((a, b) => a + Math.max(0, b.sponsorRemaining), 0);
    return {
      totalSent: notRejected.filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && s.status === 'approved').reduce((a, s) => a + s.amount, 0),
      sponsorToOwner: notRejected.filter(s => s.flow_type === 'SPONSOR_TO_OWNER').reduce((a, s) => a + s.amount, 0),
      ownerToBranch: notRejected.filter(s => s.flow_type === 'OWNER_TO_BRANCH').reduce((a, s) => a + s.amount, 0),
      pendingCount: settlements.filter(s => s.status === 'pending').length,
      sponsorRemaining,
    };
  }, [settlements, branchData]);

  const chartData = branchData.map(b => ({
    name: b.branch.length > 10 ? b.branch.slice(0, 10) + '…' : b.branch,
    'Received': b.receivedBySponsor,
    'Sent to Owner': b.sentToOwner,
    'Remaining': Math.max(0, b.sponsorRemaining),
  }));

  return (
    <div className="space-y-4">
      {/* Global KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 font-medium">Total Sent to Sponsor</p>
          <p className="text-xl font-bold text-blue-700">{fmt(totals.totalSent)}</p>
          <p className="text-xs text-muted-foreground">Across all branches</p>
        </Card>
        <Card className="p-3 bg-violet-50 border-violet-200">
          <p className="text-xs text-violet-600 font-medium">Sponsor → Owner</p>
          <p className="text-xl font-bold text-violet-700">{fmt(totals.sponsorToOwner)}</p>
          <p className="text-xs text-muted-foreground">Total settled to owner</p>
        </Card>
        <Card className={`p-3 ${totals.sponsorRemaining > 0 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-xs font-medium ${totals.sponsorRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            Remaining w/ Sponsor
          </p>
          <p className={`text-xl font-bold ${totals.sponsorRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {fmt(totals.sponsorRemaining)}
          </p>
          <p className="text-xs text-muted-foreground">Not yet sent to owner</p>
        </Card>
        <Card className="p-3 bg-emerald-50 border-emerald-200">
          <p className="text-xs text-emerald-600 font-medium">Owner → Branches</p>
          <p className="text-xl font-bold text-emerald-700">{fmt(totals.ownerToBranch)}</p>
          <p className="text-xs text-muted-foreground">Total funded back</p>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Branch Settlement Overview</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Received" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="Sent to Owner" fill="#8b5cf6" radius={[3,3,0,0]} />
              <Bar dataKey="Remaining" fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-branch breakdown */}
      {isLoading ? (
        <p className="text-xs text-center text-muted-foreground py-6">Loading...</p>
      ) : branchData.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <p className="text-sm text-muted-foreground">No settlement data yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {branchData.map(b => (
            <Card key={b.branch} className={`p-4 ${b.sponsorRemaining > 0 ? 'border-amber-200' : 'border-emerald-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold">{b.branch}</p>
                <div className="flex items-center gap-1">
                  {b.sponsorRemaining > 500
                    ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                    : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  <Badge className={`text-xs border-0 ${b.sponsorRemaining > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {b.sponsorRemaining > 0 ? 'Partial' : 'Settled'}: {fmt(Math.max(0, b.sponsorRemaining))}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1 text-xs mb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received by Sponsor</span>
                  <span className="font-semibold text-blue-600">{fmt(b.receivedBySponsor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent to Owner</span>
                  <span className="font-semibold text-violet-600">− {fmt(b.sentToOwner)}</span>
                </div>
                <div className={`flex justify-between font-bold border-t border-border pt-1 ${b.sponsorRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span>Remaining w/ Sponsor</span>
                  <span>{fmt(Math.max(0, b.sponsorRemaining))}</span>
                </div>
                {b.ownerToBranch > 0 && (
                  <div className="flex justify-between text-emerald-600 pt-0.5">
                    <span className="text-muted-foreground">Owner → Branch</span>
                    <span className="font-semibold">{fmt(b.ownerToBranch)}</span>
                  </div>
                )}
              </div>
              {b.receivedBySponsor > 0 && (
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (b.sentToOwner / b.receivedBySponsor) * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {b.receivedBySponsor > 0
                  ? `${Math.round(Math.min(100, (b.sentToOwner / b.receivedBySponsor) * 100))}% transferred to owner`
                  : 'No settlements yet'}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}