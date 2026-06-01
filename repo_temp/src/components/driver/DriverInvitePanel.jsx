import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  UserPlus, Bike, Clock, AlertTriangle, Copy, MessageCircle, Mail,
  CheckCircle2, XCircle, RotateCcw, Link, Loader2
} from 'lucide-react';

const APP_URL = 'https://rest-ctrl-flow.base44.app';

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  revoked:  'bg-red-100 text-red-600 border-red-200',
  expired:  'bg-slate-100 text-slate-500 border-slate-200',
};

const DRIVER_STATUS_BADGE = {
  active:    'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
  off_duty:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function DriverInvitePanel({ branch, branchLabel, restaurantName, restaurantId, today }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [createdLink, setCreatedLink] = useState(null);

  // Load active driver employees
  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers-emp', branch],
    queryFn: () => branch ? base44.entities.Employee.filter({ branch, is_driver: true }) : [],
    enabled: !!branch,
  });

  // Load driver invites for this branch
  const { data: invites = [], refetch: refetchInvites } = useQuery({
    queryKey: ['driver-invites', branch],
    queryFn: () => branch ? base44.entities.DriverInvite.filter({ branch_key: branch }) : [],
    enabled: !!branch,
  });

  const { data: activeShifts = [] } = useQuery({
    queryKey: ['active-shifts-mgr', branch, today],
    queryFn: () => branch ? base44.entities.DriverShift.filter({ branch, date: today, status: 'open' }) : [],
    enabled: !!branch,
  });

  const { data: pendingSettlements = [] } = useQuery({
    queryKey: ['pending-settlements-mgr', branch],
    queryFn: () => branch ? base44.entities.DriverSettlement.filter({ branch, status: 'pending' }) : [],
    enabled: !!branch,
  });

  const { data: todayOrders = [] } = useQuery({
    queryKey: ['today-orders-mgr', branch, today],
    queryFn: () => branch ? base44.entities.DeliveryOrder.filter({ branch }, '-created_date', 200) : [],
    enabled: !!branch,
  });

  const inviteMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('inviteDriver', data),
    onSuccess: (res) => {
      const data = res?.data;
      if (data?.success) {
        const link = `${APP_URL}/driver-invite?token=${data.token}`;
        setCreatedLink(link);
        refetchInvites();
        toast.success(data.email_sent ? 'Invitation sent by email!' : 'Invite link created!');
      } else {
        toast.error(data?.error || 'Failed to create invitation');
      }
    },
    onError: (e) => toast.error(e.message || 'Failed to invite driver'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Employee.update(id, { driver_status: status }),
    onSuccess: () => { toast.success('Driver status updated'); qc.invalidateQueries({ queryKey: ['drivers-emp'] }); },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id) => base44.entities.DriverInvite.update(id, { status: 'revoked' }),
    onSuccess: () => { refetchInvites(); toast.success('Invite revoked'); },
  });

  function handleSendInvite() {
    if (!form.email) { toast.error('Email is required'); return; }
    inviteMutation.mutate({
      email: form.email,
      driver_name: form.name,
      phone: form.phone,
      branch_key: branch,
      branch_label: branchLabel || branch,
      restaurant_name: restaurantName || '',
      restaurant_id: restaurantId || '',
    });
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link).then(() => toast.success('Link copied!'));
  }

  function shareWhatsApp(link, name) {
    const msg = encodeURIComponent(
      `Hello${name ? ` ${name}` : ''}! 👋\n\nYou have been invited as a Delivery Driver at *${restaurantName || 'our restaurant'}*.\n\n🚴 Open this link to activate your driver account:\n${link}\n\n_This link expires in 72 hours._`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function resetInviteForm() {
    setForm({ name: '', email: '', phone: '' });
    setCreatedLink(null);
    setShowInvite(false);
  }

  const driversOnShift = drivers.filter(d => activeShifts.some(s => s.driver_id === d.id));
  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-black text-blue-700">{drivers.length}</p>
          <p className="text-xs text-blue-600">Drivers</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-2xl font-black text-green-700">{driversOnShift.length}</p>
          <p className="text-xs text-green-600">On Shift</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-2xl font-black text-amber-700">{pendingSettlements.length}</p>
          <p className="text-xs text-amber-600">Settlements</p>
        </div>
      </div>

      {/* Invite button */}
      <Button className="w-full h-12 gap-2 text-base" onClick={() => setShowInvite(true)}>
        <UserPlus className="w-5 h-5" /> Invite New Driver
      </Button>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Pending Invites</p>
          {pendingInvites.map(inv => {
            const link = `${APP_URL}/driver-invite?token=${inv.invite_token}`;
            const isExpired = inv.token_expires_at && new Date(inv.token_expires_at) < new Date();
            return (
              <Card key={inv.id} className="border-0 shadow-sm bg-amber-50/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{inv.driver_name || inv.email}</p>
                      <p className="text-xs text-muted-foreground">{inv.email}</p>
                    </div>
                    <Badge className={`text-xs border ${isExpired ? STATUS_BADGE.expired : STATUS_BADGE.pending}`}>
                      {isExpired ? 'expired' : 'pending'}
                    </Badge>
                  </div>
                  {!isExpired && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => shareWhatsApp(link, inv.driver_name)}>
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs gap-1"
                        onClick={() => copyLink(link)}>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50 px-2"
                        onClick={() => revokeInviteMutation.mutate(inv.id)}>
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Drivers */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Active Drivers</p>
        {loadingDrivers && <p className="text-center text-sm text-muted-foreground py-4">Loading…</p>}
        {!loadingDrivers && drivers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Bike className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No drivers yet. Invite one above.
          </div>
        )}
        {drivers.map(d => {
          const isOnShift = activeShifts.some(s => s.driver_id === d.id);
          const driverOrders = todayOrders.filter(o => o.driver_id === d.id && o.status === 'delivered');
          const cash = driverOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
          const net = driverOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);
          const hasPending = pendingSettlements.some(s => s.driver_id === d.id);
          const status = d.driver_status || 'active';

          return (
            <Card key={d.id} className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${isOnShift ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {d.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {d.full_name}
                        {isOnShift && <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{d.email || 'No email'}</div>
                    </div>
                  </div>
                  <Badge className={`text-xs border ${DRIVER_STATUS_BADGE[status]}`}>{status}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <p className="text-muted-foreground">Orders</p>
                    <p className="font-bold">{driverOrders.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-600">Cash</p>
                    <p className="font-bold text-green-700">{cash.toFixed(0)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-blue-600">Net</p>
                    <p className="font-bold text-blue-700">{net.toFixed(0)}</p>
                  </div>
                </div>

                {hasPending && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                    <Clock className="w-3.5 h-3.5" /> Pending settlement
                  </div>
                )}
                {!d.email && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> No email — cannot log in
                  </div>
                )}

                <div className="flex gap-2">
                  {status !== 'suspended' ? (
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
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => { if (!o) resetInviteForm(); else setShowInvite(true); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" /> Invite Driver
            </DialogTitle>
          </DialogHeader>

          {!createdLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Driver Name</Label>
                <Input placeholder="Ahmed Al-Rashid" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Email <span className="text-red-500">*</span></Label>
                <Input type="email" placeholder="driver@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Phone (optional)</Label>
                <Input placeholder="+966 5X XXX XXXX" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-11" />
              </div>

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">How it works:</p>
                <p>1. Driver receives email + you get a shareable link</p>
                <p>2. Driver opens link → creates account → lands on Driver Portal</p>
                <p>3. Role is automatically set to Driver</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetInviteForm}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={handleSendInvite}
                  disabled={!form.email || inviteMutation.isPending}>
                  {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </Button>
              </div>
            </div>
          ) : (
            /* Link created — show share options */
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-bold text-slate-800">Invite Created!</p>
                <p className="text-sm text-muted-foreground mt-1">Share via any channel below</p>
              </div>

              {/* Link preview */}
              <div className="bg-slate-50 border rounded-xl p-3 flex items-center gap-2">
                <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-500 truncate flex-1">{createdLink}</p>
              </div>

              {/* Share buttons */}
              <div className="space-y-2">
                <Button className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => shareWhatsApp(createdLink, form.name)}>
                  <MessageCircle className="w-5 h-5" /> Share via WhatsApp
                </Button>
                <Button variant="outline" className="w-full h-11 gap-2"
                  onClick={() => copyLink(createdLink)}>
                  <Copy className="w-5 h-5" /> Copy Invite Link
                </Button>
              </div>

              <Button variant="ghost" className="w-full text-sm" onClick={resetInviteForm}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}