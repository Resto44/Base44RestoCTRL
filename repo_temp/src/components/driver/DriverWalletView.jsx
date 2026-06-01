import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

const SETTLE_STATUS = {
  pending:  { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function DriverWalletView({ driver }) {
  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['my-settlements', driver?.id],
    queryFn: () => driver?.id ? base44.entities.DriverSettlement.filter({ driver_id: driver.id }, '-date', 30) : [],
    enabled: !!driver?.id,
    refetchInterval: 20000,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['my-debts', driver?.id],
    queryFn: () => driver?.id ? base44.entities.DriverDebt.filter({ driver_id: driver.id, status: 'open' }) : [],
    enabled: !!driver?.id,
  });

  const totalCashApproved = settlements.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.cash_handed_over || 0), 0);
  const totalNetworkApproved = settlements.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.network_verified || 0), 0);
  const pendingAmount = settlements.filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.total_collected || 0), 0);
  const totalDebt = debts.reduce((sum, d) => sum + (d.remaining_amount || d.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Balance Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 bg-green-50 rounded-xl">
            <Banknote className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-2xl font-black text-green-700">{totalCashApproved.toFixed(0)}</p>
            <p className="text-xs text-green-600">Cash (Approved)</p>
            <p className="text-[10px] text-green-500 mt-0.5">SAR</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 bg-blue-50 rounded-xl">
            <CreditCard className="w-5 h-5 text-blue-600 mb-2" />
            <p className="text-2xl font-black text-blue-700">{totalNetworkApproved.toFixed(0)}</p>
            <p className="text-xs text-blue-600">Network (Approved)</p>
            <p className="text-[10px] text-blue-500 mt-0.5">SAR</p>
          </CardContent>
        </Card>
        {pendingAmount > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 bg-amber-50 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600 mb-2" />
              <p className="text-2xl font-black text-amber-700">{pendingAmount.toFixed(0)}</p>
              <p className="text-xs text-amber-600">Pending Settlement</p>
              <p className="text-[10px] text-amber-500 mt-0.5">SAR</p>
            </CardContent>
          </Card>
        )}
        {totalDebt > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 bg-red-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
              <p className="text-2xl font-black text-red-700">{totalDebt.toFixed(0)}</p>
              <p className="text-xs text-red-600">Outstanding Debt</p>
              <p className="text-[10px] text-red-500 mt-0.5">SAR</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Debts */}
      {debts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Active Debts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {debts.map(d => (
              <div key={d.id} className="flex justify-between items-center text-sm bg-red-50 rounded-lg p-3">
                <div>
                  <p className="font-medium text-red-800">{d.type?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-red-600">{d.date}</p>
                </div>
                <p className="font-bold text-red-700">{(d.remaining_amount || d.amount || 0).toFixed(0)} SAR</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Settlement History */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Settlement History</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}
          {settlements.length === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">No settlements yet</p>
          )}
          {settlements.map(s => {
            const cfg = SETTLE_STATUS[s.status] || SETTLE_STATUS.pending;
            const Icon = cfg.icon;
            const variance = s.variance_cash || 0;
            return (
              <div key={s.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.date}</span>
                  <Badge className={`text-xs border ${cfg.color}`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-600">Cash</p>
                    <p className="font-bold text-green-700">{(s.cash_handed_over || 0).toFixed(0)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-blue-600">Network</p>
                    <p className="font-bold text-blue-700">{(s.network_verified || 0).toFixed(0)}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${Math.abs(variance) > 0.5 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <p className={Math.abs(variance) > 0.5 ? 'text-red-600' : 'text-slate-500'}>Variance</p>
                    <p className={`font-bold ${Math.abs(variance) > 0.5 ? 'text-red-700' : 'text-slate-600'}`}>{variance.toFixed(0)}</p>
                  </div>
                </div>
                {s.manager_notes && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">📝 {s.manager_notes}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}