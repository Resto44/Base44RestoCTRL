import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Bike, Mail, Phone, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

const STATUS_COLOR = {
  active:    'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
  off_duty:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function DriverManagementPanel({ branch, today }) {
  const qc = useQueryClient();
  const [editingDriver, setEditingDriver] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['all-drivers', branch],
    queryFn: () => branch
      ? base44.entities.Employee.filter({ branch, position: 'driver' })
      : [],
    enabled: !!branch,
  });

  const { data: activeShifts = [] } = useQuery({
    queryKey: ['active-shifts-mgr', branch, today],
    queryFn: () => branch
      ? base44.entities.DriverShift.filter({ branch, date: today, status: 'open' })
      : [],
    enabled: !!branch,
  });

  const { data: todayOrders = [] } = useQuery({
    queryKey: ['today-orders-mgr', branch, today],
    queryFn: () => branch
      ? base44.entities.DeliveryOrder.filter({ branch }, '-created_date', 200)
      : [],
    enabled: !!branch,
  });

  const { data: pendingSettlements = [] } = useQuery({
    queryKey: ['pending-settlements-mgr', branch],
    queryFn: () => branch
      ? base44.entities.DriverSettlement.filter({ branch, status: 'pending' })
      : [],
    enabled: !!branch,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Employee.update(id, { driver_status: status }),
    onSuccess: () => { toast.success('Driver status updated'); qc.invalidateQueries({ queryKey: ['all-drivers'] }); },
  });

  const inviteMutation = useMutation({
    mutationFn: (email) => base44.users.inviteUser(email, 'driver'),
    onSuccess: () => { toast.success('Driver invited! They can now log in.'); setShowInvite(false); setInviteEmail(''); },
    onError: (e) => toast.error(e.message || 'Failed to invite driver'),
  });

  const driversOnShift = drivers.filter(d => activeShifts.some(s => s.driver_id === d.id));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-black text-blue-700">{drivers.length}</p>
          <p className="text-xs text-blue-600">Total Drivers</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-2xl font-black text-green-700">{driversOnShift.length}</p>
          <p className="text-xs text-green-600">On Shift</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-2xl font-black text-amber-700">{pendingSettlements.length}</p>
          <p className="text-xs text-amber-600">Pending Settlement</p>
        </div>
      </div>

      <Button onClick={() => setShowInvite(true)} className="w-full gap-2">
        <UserPlus className="w-4 h-4" /> Invite Driver
      </Button>

      {/* Driver Cards */}
      {isLoading && <p className="text-center text-sm text-muted-foreground py-6">Loading drivers…</p>}
      {drivers.map(d => {
        const isOnShift = activeShifts.some(s => s.driver_id === d.id);
        const driverOrders = todayOrders.filter(o => o.driver_id === d.id && o.status === 'delivered');
        const driverCash = driverOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
        const driverNet = driverOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);
        const hasPending = pendingSettlements.some(s => s.driver_id === d.id);

        return (
          <Card key={d.id} className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isOnShift ? 'bg-green-100' : 'bg-slate-100'}`}>
                    {d.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {d.full_name}
                      {isOnShift && <span className="w-2 h-2 rounded-full bg-green-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.email || 'No email set'}</div>
                  </div>
                </div>
                <Badge className={`text-xs border ${STATUS_COLOR[d.driver_status || 'active']}`}>
                  {d.driver_status || 'active'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-muted-foreground">Orders</p>
                  <p className="font-bold">{driverOrders.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-green-600">Cash</p>
                  <p className="font-bold text-green-700">{driverCash.toFixed(0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-blue-600">Network</p>
                  <p className="font-bold text-blue-700">{driverNet.toFixed(0)}</p>
                </div>
              </div>

              {hasPending && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                  <Clock className="w-3.5 h-3.5" /> Pending settlement waiting for approval
                </div>
              )}

              {!d.email && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> No email — driver cannot log in to portal
                </div>
              )}

              <div className="flex gap-2">
                {d.driver_status !== 'suspended' ? (
                  <Button size="sm" variant="outline" className="flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => updateStatusMutation.mutate({ id: d.id, status: 'suspended' })}>
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 text-xs border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => updateStatusMutation.mutate({ id: d.id, status: 'active' })}>
                    Reactivate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {drivers.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Bike className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No drivers found for this branch.
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite Driver</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the driver's email. They'll receive an invite and log in with the <strong>driver</strong> role.
            </p>
            <div>
              <Label className="text-xs">Driver Email</Label>
              <Input type="email" placeholder="driver@example.com"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="h-11" />
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ After inviting, go to the driver's Employee record and set their email to match so the portal can link their account.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => inviteMutation.mutate(inviteEmail)}
                disabled={!inviteEmail || inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Inviting…' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}