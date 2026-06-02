/**
 * SponsorLedger
 * The critical tracking component:
 * Per-branch: Total Received by Sponsor - Total Sent to Owner = Remaining with Sponsor
 *
 * FORMULA:
 *   SponsorRemaining = SUM(MANAGER_TO_SPONSOR approved) - SUM(SPONSOR_TO_OWNER approved)
 *
 * SPONSOR_TO_OWNER transfers are linked back to branches via parent_settlement_id OR
 * attributed pro-rata when no link exists (with clear indication).
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import { createNotification } from '@/lib/notificationEngine';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, ShieldCheck,
  Clock, CheckCircle2, AlertCircle, Bell, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];

// Settlement status based on remaining balance
function getSettlementStatus(received, sentToOwner) {
  if (received === 0) return { label: 'No Activity', cls: 'bg-muted text-muted-foreground', icon: Clock };
  const remaining = received - sentToOwner;
  if (remaining <= 0) return { label: 'Fully Settled', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
  if (sentToOwner > 0 && remaining > 0) return { label: 'Partial Transfer', cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
  return { label: 'Pending Transfer', cls: 'bg-red-100 text-red-600', icon: AlertCircle };
}

export default function SponsorLedger() {
  const { currency } = useLanguage();
  const { orgId } = useTenant();
  const fmt = v => formatCurrency(v, currency);
  const [notifying, setNotifying] = useState(false);

  const { data: settlements = [], isLoading, refetch } = useQuery({
    queryKey: ['settlements_all', orgId],
    queryFn: () => base44.entities.SettlementRecord.filter({ created_by: orgId }, '-date', 500),
    staleTime: 20000,
    enabled: !!orgId,
  });

  // ── Core Ledger Computation ──────────────────────────────────────────────
  const { branchLedger, totals, pendingByBranch } = useMemo(() => {
    const map = {};

    // Step 1: All approved MANAGER_TO_SPONSOR = what Sponsor received, per branch
    settlements
      .filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && s.status === 'approved')
      .forEach(s => {
        const b = s.branch || 'Unknown';
        if (!map[b]) map[b] = { branch: b, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0, records: [] };
        map[b].receivedBySponsor += s.amount || 0;
        map[b].records.push(s);
      });

    // Step 2: SPONSOR_TO_OWNER — attribute to branch via parent_settlement_id or branch field
    const sponsorToOwner = settlements.filter(s =>
      s.flow_type === 'SPONSOR_TO_OWNER' && s.status !== 'rejected'
    );

    sponsorToOwner.forEach(s => {
      // If a branch is explicitly set on the SPONSOR_TO_OWNER record, use it
      if (s.branch && map[s.branch]) {
        map[s.branch].sentToOwner += s.amount || 0;
      } else if (s.branch) {
        // Branch exists in SPONSOR_TO_OWNER but not in receivedBySponsor yet
        if (!map[s.branch]) map[s.branch] = { branch: s.branch, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0, records: [] };
        map[s.branch].sentToOwner += s.amount || 0;
      } else {
        // No branch specified — attribute to a special "Unattributed" bucket
        const b = 'Unattributed';
        if (!map[b]) map[b] = { branch: b, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0, records: [] };
        map[b].sentToOwner += s.amount || 0;
      }
    });

    // Step 3: OWNER_TO_BRANCH per branch
    settlements
      .filter(s => s.flow_type === 'OWNER_TO_BRANCH' && s.status !== 'rejected' && s.branch)
      .forEach(s => {
        const b = s.branch;
        if (!map[b]) map[b] = { branch: b, receivedBySponsor: 0, sentToOwner: 0, ownerToBranch: 0, records: [] };
        map[b].ownerToBranch += s.amount || 0;
      });

    const branchLedger = Object.values(map).map(b => {
      const sponsorRemaining = b.receivedBySponsor - b.sentToOwner;
      const settlePct = b.receivedBySponsor > 0 ? Math.round((b.sentToOwner / b.receivedBySponsor) * 100) : 0;
      const status = getSettlementStatus(b.receivedBySponsor, b.sentToOwner);
      return { ...b, sponsorRemaining, settlePct, status };
    }).sort((a, b) => b.sponsorRemaining - a.sponsorRemaining);

    // Pending (not yet approved) by branch
    const pendingByBranch = {};
    settlements
      .filter(s => s.flow_type === 'MANAGER_TO_SPONSOR' && (s.status === 'pending' || s.status === 'verified'))
      .forEach(s => {
        const b = s.branch || 'Unknown';
        pendingByBranch[b] = (pendingByBranch[b] || 0) + (s.amount || 0);
      });

    const totals = {
      totalReceivedBySponsor: branchLedger.reduce((a, b) => a + b.receivedBySponsor, 0),
      totalSentToOwner: branchLedger.reduce((a, b) => a + b.sentToOwner, 0),
      totalSponsorRemaining: branchLedger.reduce((a, b) => a + Math.max(0, b.sponsorRemaining), 0),
      totalOwnerToBranch: branchLedger.reduce((a, b) => a + b.ownerToBranch, 0),
      pendingCount: settlements.filter(s => s.status === 'pending').length,
      branchesWithBalance: branchLedger.filter(b => b.sponsorRemaining > 0).length,
    };

    return { branchLedger, totals, pendingByBranch };
  }, [settlements]);

  // Pie chart data
  const pieData = [
    { name: 'Sent to Owner', value: totals.totalSentToOwner },
    { name: 'Remaining w/ Sponsor', value: totals.totalSponsorRemaining },
  ].filter(d => d.value > 0);

  // Bar chart data
  const barData = branchLedger
    .filter(b => b.branch !== 'Unattributed')
    .map(b => ({
      name: b.branch.length > 10 ? b.branch.slice(0, 10) + '…' : b.branch,
      fullName: b.branch,
      'Received': b.receivedBySponsor,
      'Sent to Owner': b.sentToOwner,
      'Remaining': Math.max(0, b.sponsorRemaining),
    }));

  // Notify owner about branches with outstanding sponsor balances
  const handleNotifyOwner = async () => {
    setNotifying(true);
    const outstanding = branchLedger.filter(b => b.sponsorRemaining > 100);
    for (const b of outstanding) {
      await createNotification({
        orgId,
        type: 'transfer',
        severity: b.sponsorRemaining > 5000 ? 'critical' : 'warning',
        targetRole: 'owner',
        title: `⚠️ Sponsor Balance Outstanding — ${b.branch}`,
        message: `الكفيل لا يزال يحتفظ بـ ${currency} ${Number(b.sponsorRemaining).toLocaleString()} من ${b.branch}. إجمالي استلام: ${fmt(b.receivedBySponsor)} | محوّل للمالك: ${fmt(b.sentToOwner)}`,
        amount: b.sponsorRemaining,
        branch: b.branch,
        actorEmail: 'system',
        actorName: 'Sponsor Ledger System',
      });
    }
    setNotifying(false);
    alert(`Notified owner about ${outstanding.length} branch(es) with outstanding sponsor balances.`);
  };

  if (isLoading) {
    return <p className="text-xs text-center text-muted-foreground py-10">Loading sponsor ledger...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Sponsor Balance Ledger</h3>
          <p className="text-xs text-muted-foreground">Received by Sponsor − Sent to Owner = Remaining with Sponsor</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          {totals.branchesWithBalance > 0 && (
            <Button size="sm" variant="outline" onClick={handleNotifyOwner} disabled={notifying}
              className="h-7 text-xs text-amber-700 border-amber-300">
              <Bell className="w-3 h-3 mr-1" />
              {notifying ? 'Sending...' : `Alert Owner (${totals.branchesWithBalance})`}
            </Button>
          )}
        </div>
      </div>

      {/* Critical KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 font-medium">Total Received by Sponsor</p>
          <p className="text-lg font-bold text-blue-700">{fmt(totals.totalReceivedBySponsor)}</p>
          <p className="text-xs text-muted-foreground">All branches, approved</p>
        </Card>
        <Card className="p-3 bg-violet-50 border-violet-200">
          <p className="text-xs text-violet-600 font-medium">Sponsor → Owner Sent</p>
          <p className="text-lg font-bold text-violet-700">{fmt(totals.totalSentToOwner)}</p>
          <p className="text-xs text-muted-foreground">Total transferred to owner</p>
        </Card>
        <Card className={`p-3 col-span-2 ${totals.totalSponsorRemaining > 0 ? 'bg-amber-50 border-amber-300 border-2' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold ${totals.totalSponsorRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {totals.totalSponsorRemaining > 0 ? '⚠️ Remaining Held by Sponsor' : '✅ Fully Settled'}
              </p>
              <p className={`text-2xl font-extrabold ${totals.totalSponsorRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmt(totals.totalSponsorRemaining)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.branchesWithBalance} branch{totals.branchesWithBalance !== 1 ? 'es' : ''} with outstanding balance
              </p>
            </div>
            {totals.totalSponsorRemaining > 0
              ? <AlertTriangle className="w-8 h-8 text-amber-400 opacity-60" />
              : <ShieldCheck className="w-8 h-8 text-emerald-400 opacity-60" />
            }
          </div>
          {totals.totalReceivedBySponsor > 0 && (
            <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totals.totalSentToOwner / totals.totalReceivedBySponsor) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {totals.totalReceivedBySponsor > 0
              ? `${Math.round((totals.totalSentToOwner / totals.totalReceivedBySponsor) * 100)}% transferred to owner`
              : 'No data'}
          </p>
        </Card>
      </div>

      {/* Pending amounts */}
      {Object.keys(pendingByBranch).length > 0 && (
        <Card className="p-3 border-amber-200 bg-amber-50/30">
          <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Approval (not yet in ledger)
          </p>
          <div className="space-y-1">
            {Object.entries(pendingByBranch).map(([branch, amt]) => (
              <div key={branch} className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{branch}</span>
                <span className="font-semibold text-amber-600">{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Charts */}
      {barData.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">Branch Sponsor Ledger</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v, name, props) => [fmt(v), name]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Received" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Sent to Owner" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Remaining" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {pieData.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold mb-1">Total Sponsor Holdings Split</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={['#8b5cf6', '#f59e0b'][i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#8b5cf6', '#f59e0b'][i] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-bold">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Per-Branch Sponsor Cards */}
      <div>
        <p className="text-sm font-semibold mb-2">Branch-by-Branch Sponsor Ledger</p>
        {branchLedger.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <p className="text-sm text-muted-foreground">No settlement data yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {branchLedger.map(b => {
              const StatusIcon = b.status.icon;
              const isOutstanding = b.sponsorRemaining > 0;
              return (
                <Card key={b.branch} className={`p-4 ${
                  isOutstanding
                    ? b.sponsorRemaining > 5000 ? 'border-red-300 bg-red-50/20' : 'border-amber-300 bg-amber-50/20'
                    : 'border-emerald-200 bg-emerald-50/10'
                }`}>
                  {/* Branch header */}
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm font-bold">{b.branch}</p>
                    <Badge className={`text-xs border-0 flex items-center gap-1 ${b.status.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {b.status.label}
                    </Badge>
                  </div>

                  {/* Core 3-line ledger */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                        دريافت كفيل (Received by Sponsor)
                      </span>
                      <span className="font-bold text-blue-600">{fmt(b.receivedBySponsor)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                        ارسال به اونر (Sent to Owner)
                      </span>
                      <span className="font-bold text-violet-600">− {fmt(b.sentToOwner)}</span>
                    </div>
                    <div className={`flex justify-between items-center text-sm font-bold border-t pt-1.5 ${
                      b.sponsorRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      <span className="flex items-center gap-1">
                        {b.sponsorRemaining > 0
                          ? <AlertTriangle className="w-3.5 h-3.5" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />}
                        باقي‌مانده نزد كفيل (Remaining w/ Sponsor)
                      </span>
                      <span>{fmt(Math.max(0, b.sponsorRemaining))}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {b.receivedBySponsor > 0 && (
                    <>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, b.settlePct)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{b.settlePct}% transferred to owner</p>
                    </>
                  )}

                  {/* Owner→Branch info */}
                  {b.ownerToBranch > 0 && (
                    <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-border">
                      <span className="text-muted-foreground">Owner → Branch Funded</span>
                      <span className="font-semibold text-emerald-600">{fmt(b.ownerToBranch)}</span>
                    </div>
                  )}

                  {/* Warning if large outstanding */}
                  {b.sponsorRemaining > 5000 && (
                    <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600">Large balance held by sponsor — follow up required</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}