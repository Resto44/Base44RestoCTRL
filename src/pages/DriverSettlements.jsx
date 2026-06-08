import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/TenantContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  approved: { label: 'Approved',       color: 'bg-green-100 text-green-700 border-green-200',  icon: CheckCircle2 },
  disputed: { label: 'Disputed',       color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  rejected: { label: 'Rejected',       color: 'bg-red-100 text-red-700 border-red-200',         icon: XCircle },
};

function SettlementCard({ settlement, onApprove, onDispute, isOwner }) {
  const cfg = STATUS_CONFIG[settlement.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const variance = settlement.variance_cash || 0;

  return (
    <Card className={`${Math.abs(variance) > 0.5 ? 'border-amber-300' : ''}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{settlement.driver_name}</div>
            <div className="text-xs text-muted-foreground">{settlement.date} · {settlement.branch}</div>
          </div>
          <Badge className={`border text-xs ${cfg.color}`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-green-50 rounded p-2 text-center">
            <div className="text-xs text-green-600 mb-0.5">Cash Handed</div>
            <div className="font-bold text-green-700">{(settlement.cash_handed_over || 0).toFixed(2)}</div>
          </div>
          <div className="bg-blue-50 rounded p-2 text-center">
            <div className="text-xs text-blue-600 mb-0.5">Network</div>
            <div className="font-bold text-blue-700">{(settlement.network_verified || 0).toFixed(2)}</div>
          </div>
          <div className={`rounded p-2 text-center ${Math.abs(variance) > 0.5 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <div className={`text-xs mb-0.5 ${Math.abs(variance) > 0.5 ? 'text-red-600' : 'text-slate-500'}`}>Variance</div>
            <div className={`font-bold ${Math.abs(variance) > 0.5 ? 'text-red-700' : 'text-slate-600'}`}>{variance.toFixed(2)}</div>
          </div>
        </div>

        {settlement.debt_deducted > 0 && (
          <div className="text-xs bg-orange-50 border border-orange-200 rounded p-2 flex justify-between">
            <span className="text-orange-600">Debt deducted</span>
            <span className="font-semibold text-orange-700">{settlement.debt_deducted.toFixed(2)} SAR</span>
          </div>
        )}

        {settlement.manager_notes && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">📝 {settlement.manager_notes}</div>
        )}

        {settlement.status === 'pending' && isOwner && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => onApprove(settlement)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-orange-300 text-orange-600"
              onClick={() => onDispute(settlement)}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Dispute
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DriverSettlements() {
  const { branches, managerBranch, isManager } = useTenant();
  const { role } = useRole();
  const qc = useQueryClient();
  const isOwner = role === ROLES.OWNER;
  const defaultBranch = isManager ? (managerBranch || '') : (branches[0]?.key || '');
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [filterStatus, setFilterStatus] = useState('all');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [disputingId, setDisputingId] = useState(null);

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['driver-settlements', selectedBranch],
    queryFn: () => selectedBranch ? base44.entities.DriverSettlement.filter({ branch: selectedBranch }, '-date', 200) : [],
    enabled: !!selectedBranch,
  });

  const approveMutation = useMutation({
    mutationFn: (s) => base44.entities.DriverSettlement.update(s.id, {
      status: 'approved', approved_at: new Date().toISOString()
    }),
    onSuccess: () => { toast.success('Settlement approved!'); qc.invalidateQueries({ queryKey: ['driver-settlements'] }); },
  });

  const disputeMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.DriverSettlement.update(id, { status: 'disputed', manager_notes: notes }),
    onSuccess: () => { toast.warning('Marked as disputed'); setDisputingId(null); qc.invalidateQueries({ queryKey: ['driver-settlements'] }); },
  });

  const filtered = filterStatus === 'all' ? settlements : settlements.filter(s => s.status === filterStatus);

  const totals = settlements.filter(s => s.status === 'approved').reduce((acc, s) => ({
    cash: acc.cash + (s.cash_handed_over || 0),
    network: acc.network + (s.network_verified || 0),
  }), { cash: 0, network: 0 });

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Driver Settlements</h1>
        <div className="text-xs text-muted-foreground text-right">
          <div>Approved cash: <span className="font-bold text-green-600">{totals.cash.toFixed(0)} SAR</span></div>
          <div>Approved network: <span className="font-bold text-blue-600">{totals.network.toFixed(0)} SAR</span></div>
        </div>
      </div>

      <BranchSelect value={selectedBranch} onChange={setSelectedBranch} disabled={isManager} />

      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'disputed', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && settlements.filter(x => x.status === 'pending').length > 0 && (
              <span className="ml-1 bg-amber-500 text-white rounded-full px-1">{settlements.filter(x => x.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>}

      <div className="space-y-3">
        {filtered.map(s => (
          <SettlementCard key={s.id} settlement={s} isOwner={isOwner}
            onApprove={(s) => approveMutation.mutate(s)}
            onDispute={(s) => setDisputingId(s.id)}
          />
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-10 text-muted-foreground text-sm">No settlements found.</div>
        )}
      </div>

      <Dialog open={!!disputingId} onOpenChange={() => setDisputingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dispute Settlement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Reason / Notes</Label>
              <Input value={disputeNotes} onChange={e => setDisputeNotes(e.target.value)} placeholder="Describe the issue…" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDisputingId(null)}>Cancel</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => disputeMutation.mutate({ id: disputingId, notes: disputeNotes })}>
                Confirm Dispute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}