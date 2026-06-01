import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  UserPlus, Users, Copy, MessageCircle, Mail,
  CheckCircle2, XCircle, Link, Loader2, UserRound, AlertTriangle
} from 'lucide-react';

const APP_URL = 'https://rest-ctrl-flow.base44.app';

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  revoked:  'bg-red-100 text-red-600 border-red-200',
  expired:  'bg-slate-100 text-slate-500 border-slate-200',
};

export default function EmployeeInvitePanel({ branch, branchLabel, restaurantName, restaurantId }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [createdLink, setCreatedLink] = useState(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['branch-employees', branch],
    queryFn: () => branch ? base44.entities.Employee.filter({ branch, is_active: true }) : [],
    enabled: !!branch,
  });

  const { data: invites = [], refetch: refetchInvites } = useQuery({
    queryKey: ['employee-invites', branch],
    queryFn: () => branch ? base44.entities.EmployeeInvite.filter({ branch_key: branch }) : [],
    enabled: !!branch,
  });

  const inviteMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('inviteEmployee', data),
    onSuccess: (res) => {
      const data = res?.data;
      if (data?.success) {
        setCreatedLink(`${APP_URL}/employee-invite?token=${data.token}`);
        refetchInvites();
        toast.success(data.email_sent ? 'Invitation sent by email!' : 'Invite link created!');
      } else {
        toast.error(data?.error || 'Failed to create invitation');
      }
    },
    onError: (e) => toast.error(e.message || 'Failed to invite employee'),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmployeeInvite.update(id, { status: 'revoked' }),
    onSuccess: () => { refetchInvites(); toast.success('Invite revoked'); },
  });

  function handleSendInvite() {
    if (!form.email) { toast.error('Email is required'); return; }
    inviteMutation.mutate({
      email: form.email,
      employee_name: form.name,
      phone: form.phone,
      position: form.position,
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
      `Hello${name ? ` ${name}` : ''}! 👋\n\nYou have been invited to join *${restaurantName || 'our restaurant'}* as a team member.\n\n✅ Open this link to activate your employee account:\n${link}\n\n_This link expires in 72 hours._`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function resetForm() {
    setForm({ name: '', email: '', phone: '', position: '' });
    setCreatedLink(null);
    setShowInvite(false);
  }

  const pendingInvites = invites.filter(i => i.status === 'pending');
  const acceptedInvites = invites.filter(i => i.status === 'accepted');

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-emerald-50 rounded-xl p-3">
          <p className="text-2xl font-black text-emerald-700">{employees.length}</p>
          <p className="text-xs text-emerald-600">Employees</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-2xl font-black text-amber-700">{pendingInvites.length}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-black text-blue-700">{acceptedInvites.length}</p>
          <p className="text-xs text-blue-600">Activated</p>
        </div>
      </div>

      {/* Invite button */}
      <Button className="w-full h-12 gap-2 text-base bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowInvite(true)}>
        <UserPlus className="w-5 h-5" /> Invite New Employee
      </Button>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Pending Invites</p>
          {pendingInvites.map(inv => {
            const link = `${APP_URL}/employee-invite?token=${inv.invite_token}`;
            const isExpired = inv.token_expires_at && new Date(inv.token_expires_at) < new Date();
            return (
              <Card key={inv.id} className="border-0 shadow-sm bg-amber-50/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{inv.employee_name || inv.email}</p>
                      <p className="text-xs text-muted-foreground">{inv.email} {inv.position && `· ${inv.position}`}</p>
                    </div>
                    <Badge className={`text-xs border ${isExpired ? STATUS_BADGE.expired : STATUS_BADGE.pending}`}>
                      {isExpired ? 'expired' : 'pending'}
                    </Badge>
                  </div>
                  {!isExpired && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => shareWhatsApp(link, inv.employee_name)}>
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

      {/* Active Employees */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Team Members</p>
        {isLoading && <p className="text-center text-sm text-muted-foreground py-4">Loading…</p>}
        {!isLoading && employees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No employees yet. Invite one above.
          </div>
        )}
        {employees.map(emp => (
          <Card key={emp.id} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-700 text-sm">
                  {emp.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {emp.position || 'Staff'} {emp.email && `· ${emp.email}`}
                  </p>
                </div>
                {!emp.email && (
                  <div title="No email — cannot log in">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                )}
                <Badge variant="outline" className="text-xs shrink-0">
                  {emp.is_active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => { if (!o) resetForm(); else setShowInvite(true); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="w-5 h-5 text-emerald-600" /> Invite Employee
            </DialogTitle>
          </DialogHeader>

          {!createdLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Full Name</Label>
                <Input placeholder="Sarah Johnson" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Email <span className="text-red-500">*</span></Label>
                <Input type="email" placeholder="sarah@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input placeholder="+966 5X XXX XXXX" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Position</Label>
                  <Input placeholder="Cashier, Chef…" value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="h-11" />
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700 space-y-1">
                <p className="font-semibold">How it works:</p>
                <p>1. Employee receives email + you get a shareable link</p>
                <p>2. Employee opens link → creates account → lands on Employee Portal</p>
                <p>3. Access is automatically restricted to their branch</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
                <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleSendInvite}
                  disabled={!form.email || inviteMutation.isPending}>
                  {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-bold text-slate-800">Invite Created!</p>
                <p className="text-sm text-muted-foreground mt-1">Share via any channel below</p>
              </div>
              <div className="bg-slate-50 border rounded-xl p-3 flex items-center gap-2">
                <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-500 truncate flex-1">{createdLink}</p>
              </div>
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
              <Button variant="ghost" className="w-full text-sm" onClick={resetForm}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}