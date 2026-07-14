import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, XCircle, Clock, Users, Building2, User,
  ChefHat, Truck, Package, UserCheck, Search, Filter,
  RefreshCw, AlertTriangle, ArrowLeft, Mail, Phone, GitBranch
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const ROLE_ICONS = {
  owner: Building2,
  general_manager: Users,
  manager: UserCheck,
  employee: User,
  kitchen: ChefHat,
  driver: Truck,
  supplier: Package,
};

const ROLE_COLORS = {
  owner: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  general_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manager: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  employee: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  kitchen: 'bg-red-500/20 text-red-400 border-red-500/30',
  driver: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  supplier: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_COLORS = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const TABS = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
];

function RegistrationCard({ reg, onApprove, onReject, loading }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const Icon = ROLE_ICONS[reg.role] || User;

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ROLE_COLORS[reg.role]?.replace('text-', 'bg-').replace('/20', '/10') || 'bg-slate-500/10'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-white font-bold text-sm">{reg.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                    <Mail className="w-3 h-3" />{reg.email}
                  </span>
                  {reg.phone && (
                    <span className="flex items-center gap-1 text-slate-500 text-xs">
                      <Phone className="w-3 h-3" />{reg.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`text-[10px] border ${ROLE_COLORS[reg.role] || ''} capitalize`}>
                  {reg.role?.replace('_', ' ')}
                </Badge>
                <Badge className={`text-[10px] border ${STATUS_COLORS[reg.status] || ''}`}>
                  {reg.status}
                </Badge>
              </div>
            </div>

            {reg.branch_id && (
              <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                <GitBranch className="w-3 h-3" />
                Branch assigned
              </div>
            )}

            {reg.metadata?.company_name && (
              <p className="text-slate-400 text-xs mt-1">
                Company: {reg.metadata.company_name}
              </p>
            )}

            <p className="text-slate-600 text-xs mt-1">
              Registered {reg.created_at ? format(new Date(reg.created_at), 'MMM d, yyyy HH:mm') : ''}
            </p>

            {reg.status === 'pending' && (
              <div className="flex items-center gap-2 mt-3">
                {!showRejectForm ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onApprove(reg.id)}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRejectForm(true)}
                      disabled={loading}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7 px-3"
                    >
                      <XCircle className="w-3 h-3 mr-1" />Reject
                    </Button>
                  </>
                ) : (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="bg-white/5 border-white/10 text-white text-xs h-7"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => { onReject(reg.id, rejectReason); setShowRejectForm(false); }}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-3"
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowRejectForm(false)}
                        className="text-slate-400 text-xs h-7"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ERPApprovalCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');

  const { data: registrations = [], isLoading, refetch } = useQuery({
    queryKey: ['erp-registrations', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('erp_registrations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (regId) => {
      const reg = registrations.find(r => r.id === regId);
      if (!reg) throw new Error('Registration not found');

      // Update erp_registration status
      const { error: regError } = await supabase
        .from('erp_registrations')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', regId);
      if (regError) throw regError;

      // Update profile approval_status
      if (reg.user_id) {
        await supabase
          .from('profiles')
          .update({ approval_status: 'approved' })
          .eq('id', reg.user_id);
      }
    },
    onSuccess: () => {
      toast.success('Registration approved successfully');
      qc.invalidateQueries({ queryKey: ['erp-registrations'] });
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ regId, reason }) => {
      const reg = registrations.find(r => r.id === regId);

      const { error: regError } = await supabase
        .from('erp_registrations')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
        })
        .eq('id', regId);
      if (regError) throw regError;

      if (reg?.user_id) {
        await supabase
          .from('profiles')
          .update({ approval_status: 'rejected', rejection_reason: reason || null })
          .eq('id', reg.user_id);
      }
    },
    onSuccess: () => {
      toast.success('Registration rejected');
      qc.invalidateQueries({ queryKey: ['erp-registrations'] });
    },
    onError: (err) => toast.error(`Rejection failed: ${err.message}`),
  });

  const filtered = registrations.filter(r =>
    !search ||
    r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.role?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-white font-bold text-sm">Approval Center</p>
              <p className="text-slate-500 text-xs">Manage ERP registrations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {pendingCount} pending
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const count = tab.id === 'all'
              ? registrations.length
              : registrations.filter(r => r.status === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />Loading registrations…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">No registrations found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(reg => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id, reason) => rejectMutation.mutate({ regId: id, reason })}
                loading={approveMutation.isPending || rejectMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
