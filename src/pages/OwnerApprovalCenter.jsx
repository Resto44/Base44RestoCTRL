import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { ROLES } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, Search, Filter, CheckCircle2, XCircle, ShieldOff, ShieldCheck,
  GitBranch, Clock, RefreshCw, ChevronDown, ChevronUp, Eye,
  Building2, User, ChefHat, Truck, Package, UserCheck, History,
  AlertCircle, Loader2, Settings, Bell, SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ── Role meta ─────────────────────────────────────────────────────────────────
const ROLE_META = {
  owner:           { label: 'Owner',           color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', icon: Building2 },
  general_manager: { label: 'General Manager', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     icon: Users },
  manager:         { label: 'Branch Manager',  color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: UserCheck },
  employee:        { label: 'Employee',        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   icon: User },
  kitchen:         { label: 'Kitchen',         color: 'bg-red-500/20 text-red-300 border-red-500/30',         icon: ChefHat },
  driver:          { label: 'Driver',          color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',         icon: Truck },
  supplier:        { label: 'Supplier',        color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',   icon: Package },
};

const STATUS_META = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   icon: Clock },
  approved:  { label: 'Approved',  color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/20 text-red-300 border-red-500/30',         icon: XCircle },
  suspended: { label: 'Suspended', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: ShieldOff },
};

const ALL_PERMISSIONS = [
  { key: 'view_reports',    label: 'View Reports' },
  { key: 'manage_sales',    label: 'Manage Sales' },
  { key: 'manage_expenses', label: 'Manage Expenses' },
  { key: 'manage_inventory',label: 'Manage Inventory' },
  { key: 'manage_employees',label: 'Manage Employees' },
  { key: 'manage_suppliers',label: 'Manage Suppliers' },
  { key: 'manage_products', label: 'Manage Products' },
  { key: 'view_cash',       label: 'View Cash' },
  { key: 'manage_cash',     label: 'Manage Cash' },
  { key: 'export_data',     label: 'Export Data' },
];

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || { label: role, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: User };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
}

// ── Approval Action Modal ─────────────────────────────────────────────────────
function ActionModal({ registration, action, branches, onConfirm, onClose, loading }) {
  const [notes, setNotes] = useState('');
  const [branchId, setBranchId] = useState(registration?.branch_id || '');
  const [permissions, setPermissions] = useState(registration?.assigned_permissions || {});

  const togglePerm = (key) => setPermissions(p => ({ ...p, [key]: !p[key] }));

  const actionMeta = {
    approved:    { label: 'Approve',     color: 'bg-emerald-600 hover:bg-emerald-700', icon: CheckCircle2 },
    rejected:    { label: 'Reject',      color: 'bg-red-600 hover:bg-red-700',         icon: XCircle },
    suspended:   { label: 'Suspend',     color: 'bg-orange-600 hover:bg-orange-700',   icon: ShieldOff },
    reactivated: { label: 'Reactivate',  color: 'bg-blue-600 hover:bg-blue-700',       icon: ShieldCheck },
  };
  const meta = actionMeta[action] || actionMeta.approved;
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{meta.label} User</h3>
            <p className="text-slate-400 text-sm">{registration?.full_name} · {registration?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Branch assignment for approve/reactivate */}
          {(action === 'approved' || action === 'reactivated') && (
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5">
                <GitBranch className="w-3.5 h-3.5 inline mr-1.5" />Assign Branch
              </label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
                <option value="">— No specific branch —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Permission assignment for approve/reactivate */}
          {(action === 'approved' || action === 'reactivated') && (
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">
                <Settings className="w-3.5 h-3.5 inline mr-1.5" />Assign Permissions
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!permissions[p.key]} onChange={() => togglePerm(p.key)}
                      className="w-3.5 h-3.5 accent-violet-500" />
                    <span className="text-slate-300 text-xs">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">
              Notes {action === 'rejected' ? '(reason) *' : '(optional)'}
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={action === 'rejected' ? 'Reason for rejection…' : 'Optional notes…'}
              rows={3} className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-slate-300 hover:bg-white/5">
            Cancel
          </Button>
          <Button onClick={() => onConfirm({ notes, branchId: branchId || null, permissions })}
            disabled={loading || (action === 'rejected' && !notes.trim())}
            className={`flex-1 ${meta.color} text-white font-bold`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Icon className="w-4 h-4 mr-1.5" />{meta.label}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ registrationId, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('approval_history')
        .select('*')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .limit(50);
      setHistory(data || []);
      setLoading(false);
    };
    load();
  }, [registrationId]);

  const actionColor = {
    approved: 'text-emerald-400', rejected: 'text-red-400',
    suspended: 'text-orange-400', reactivated: 'text-blue-400',
    branch_assigned: 'text-violet-400', permissions_updated: 'text-cyan-400',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-violet-400" /> Approval History
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No history records yet.</p>
          ) : history.map(h => (
            <div key={h.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold capitalize ${actionColor[h.action] || 'text-slate-300'}`}>
                  {h.action.replace('_', ' ')}
                </span>
                <span className="text-slate-500 text-xs">
                  {h.created_at ? format(new Date(h.created_at), 'MMM d, yyyy HH:mm') : '—'}
                </span>
              </div>
              {h.old_status && h.new_status && (
                <p className="text-slate-400 text-xs mb-1">
                  Status: <span className="text-slate-300">{h.old_status}</span> → <span className="text-slate-300">{h.new_status}</span>
                </p>
              )}
              {h.notes && <p className="text-slate-400 text-xs italic">"{h.notes}"</p>}
              {h.performed_by_email && (
                <p className="text-slate-600 text-xs mt-1">By: {h.performed_by_email}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OwnerApprovalCenter() {
  const { user } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterBranch, setFilterBranch] = useState('all');

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { registration, action }
  const [historyPanel, setHistoryPanel] = useState(null); // registrationId

  // Stats
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, suspended: 0 });

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      // Load registrations
      const { data: regs, error } = await supabase
        .from('erp_registrations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[ApprovalCenter] Load error:', error);
        toast.error('Failed to load registrations');
      } else {
        setRegistrations(regs || []);
        const counts = { pending: 0, approved: 0, rejected: 0, suspended: 0 };
        (regs || []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
        setStats(counts);
      }

      // Load branches for this org
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name, location, restaurant_id')
        .eq('is_active', true)
        .order('name');
      setBranches(branchData || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async ({ notes, branchId, permissions }) => {
    if (!actionModal) return;
    setActionLoading(true);

    try {
      const { data, error } = await supabase.rpc('process_registration_approval', {
        p_registration_id: actionModal.registration.id,
        p_action: actionModal.action,
        p_performed_by: user?.id,
        p_notes: notes || null,
        p_branch_id: branchId || null,
        p_permissions: Object.keys(permissions).length > 0 ? permissions : null,
      });

      if (error) {
        console.error('[ApprovalCenter] Action error:', error);
        toast.error(`Action failed: ${error.message}`);
      } else {
        const actionLabels = {
          approved: 'approved', rejected: 'rejected',
          suspended: 'suspended', reactivated: 'reactivated',
        };
        toast.success(`User ${actionLabels[actionModal.action] || actionModal.action} successfully`);
        setActionModal(null);
        await loadData(true);
      }
    } catch (err) {
      console.error('[ApprovalCenter]', err);
      toast.error('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick action without modal (for simple approve/reject from list)
  const quickAction = async (registration, action) => {
    setActionModal({ registration, action });
  };

  // Filter registrations
  const filtered = registrations.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterRole !== 'all' && r.role !== filterRole) return false;
    if (filterBranch !== 'all' && r.branch_id !== filterBranch) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.full_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const StatCard = ({ label, count, color, icon: Icon, onClick, active }) => (
    <button onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${active ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{count}</p>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            Approval Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage user registration requests and access control</p>
        </div>
        <Button onClick={() => loadData(true)} disabled={refreshing} variant="outline"
          className="border-white/10 text-slate-300 hover:bg-white/5 gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pending" count={stats.pending} color="bg-amber-500/80" icon={Clock}
          onClick={() => setFilterStatus('pending')} active={filterStatus === 'pending'} />
        <StatCard label="Approved" count={stats.approved} color="bg-emerald-500/80" icon={CheckCircle2}
          onClick={() => setFilterStatus('approved')} active={filterStatus === 'approved'} />
        <StatCard label="Rejected" count={stats.rejected} color="bg-red-500/80" icon={XCircle}
          onClick={() => setFilterStatus('rejected')} active={filterStatus === 'rejected'} />
        <StatCard label="Suspended" count={stats.suspended} color="bg-orange-500/80" icon={ShieldOff}
          onClick={() => setFilterStatus('suspended')} active={filterStatus === 'suspended'} />
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500" />
          </div>

          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>

          {/* Role filter */}
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
            <option value="all">All Roles</option>
            {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {/* Branch filter */}
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500">
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Registration List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No registrations found</p>
            <p className="text-slate-600 text-sm mt-1">
              {filterStatus === 'pending' ? 'No pending requests at this time.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : filtered.map(reg => {
          const isExpanded = expandedId === reg.id;
          const branch = branches.find(b => b.id === reg.branch_id);

          return (
            <div key={reg.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all">
              {/* Row header */}
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {reg.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm">{reg.full_name}</p>
                    <RoleBadge role={reg.role} />
                    <StatusBadge status={reg.status} />
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{reg.email}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {branch && (
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />{branch.name}
                      </span>
                    )}
                    <span className="text-slate-600 text-xs">
                      {reg.created_at ? format(new Date(reg.created_at), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {reg.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => quickAction(reg, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />Approve
                      </Button>
                      <Button size="sm" onClick={() => quickAction(reg, 'rejected')}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-3 gap-1">
                        <XCircle className="w-3.5 h-3.5" />Reject
                      </Button>
                    </>
                  )}
                  {reg.status === 'approved' && (
                    <Button size="sm" onClick={() => quickAction(reg, 'suspended')}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 px-3 gap-1">
                      <ShieldOff className="w-3.5 h-3.5" />Suspend
                    </Button>
                  )}
                  {(reg.status === 'suspended' || reg.status === 'rejected') && (
                    <Button size="sm" onClick={() => quickAction(reg, 'reactivated')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />Reactivate
                    </Button>
                  )}
                  <button onClick={() => setHistoryPanel(reg.id)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 bg-white/3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Phone</p>
                      <p className="text-slate-300">{reg.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Role</p>
                      <RoleBadge role={reg.role} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Status</p>
                      <StatusBadge status={reg.status} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Submitted</p>
                      <p className="text-slate-300">{reg.created_at ? format(new Date(reg.created_at), 'PPpp') : '—'}</p>
                    </div>
                    {reg.approved_at && (
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Approved At</p>
                        <p className="text-slate-300">{format(new Date(reg.approved_at), 'PPpp')}</p>
                      </div>
                    )}
                    {reg.rejection_reason && (
                      <div className="col-span-2">
                        <p className="text-slate-500 text-xs mb-1">Rejection Reason</p>
                        <p className="text-red-300 text-xs italic">"{reg.rejection_reason}"</p>
                      </div>
                    )}
                    {reg.metadata && Object.keys(reg.metadata).length > 0 && (
                      <div className="col-span-3">
                        <p className="text-slate-500 text-xs mb-1">Additional Info</p>
                        <div className="bg-white/5 rounded-lg p-2 text-xs text-slate-400">
                          {Object.entries(reg.metadata).map(([k, v]) => v && (
                            <p key={k}><span className="text-slate-500 capitalize">{k.replace('_', ' ')}:</span> {String(v)}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {reg.assigned_permissions && Object.keys(reg.assigned_permissions).length > 0 && (
                      <div className="col-span-3">
                        <p className="text-slate-500 text-xs mb-1">Assigned Permissions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(reg.assigned_permissions)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                {k.replace('_', ' ')}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons in expanded view */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                    {reg.status !== 'approved' && (
                      <Button size="sm" onClick={() => quickAction(reg, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />Approve & Assign Branch
                      </Button>
                    )}
                    {reg.status !== 'rejected' && (
                      <Button size="sm" onClick={() => quickAction(reg, 'rejected')}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1">
                        <XCircle className="w-3.5 h-3.5" />Reject
                      </Button>
                    )}
                    {reg.status !== 'suspended' && reg.status === 'approved' && (
                      <Button size="sm" onClick={() => quickAction(reg, 'suspended')}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1">
                        <ShieldOff className="w-3.5 h-3.5" />Suspend
                      </Button>
                    )}
                    {(reg.status === 'suspended' || reg.status === 'rejected') && (
                      <Button size="sm" onClick={() => quickAction(reg, 'reactivated')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />Reactivate
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setHistoryPanel(reg.id)}
                      variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 text-xs gap-1">
                      <History className="w-3.5 h-3.5" />View History
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-slate-600 text-xs text-center">
          Showing {filtered.length} of {registrations.length} registrations
        </p>
      )}

      {/* Action Modal */}
      {actionModal && (
        <ActionModal
          registration={actionModal.registration}
          action={actionModal.action}
          branches={branches}
          onConfirm={handleAction}
          onClose={() => setActionModal(null)}
          loading={actionLoading}
        />
      )}

      {/* History Panel */}
      {historyPanel && (
        <HistoryPanel
          registrationId={historyPanel}
          onClose={() => setHistoryPanel(null)}
        />
      )}
    </div>
  );
}
