import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Building2, Truck, UserCircle, Clock, CheckCircle2,
  XCircle, Search, Filter, RefreshCw, AlertCircle, ChevronDown,
  Mail, Phone, Package, Calendar, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TABS = [
  { id: 'all',      label: 'All Requests',  icon: Clock },
  { id: 'supplier', label: 'Suppliers',     icon: Building2 },
  { id: 'manager',  label: 'Managers',      icon: Users },
  { id: 'employee', label: 'Employees',     icon: UserCircle },
  { id: 'driver',   label: 'Drivers',       icon: Truck },
];

const STATUS_COLORS = {
  pending:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  suspended:'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// ── Supplier Request Card ─────────────────────────────────────────────────────
function SupplierCard({ invite, onApprove, onReject, loading }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-sm">{invite.supplier_name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[invite.status]}`}>
                  {invite.status}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">{invite.contact_name}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-slate-500 text-xs">
                  <Mail className="w-3 h-3" />{invite.email}
                </span>
                {invite.phone && (
                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                    <Phone className="w-3 h-3" />{invite.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-600 text-xs hidden sm:block">
              {invite.created_at ? format(new Date(invite.created_at), 'MMM d, yyyy') : ''}
            </span>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Products */}
        {invite.products && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Package className="w-3.5 h-3.5 text-slate-500" />
            {invite.products.split(',').slice(0, 4).map(p => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                {p.trim()}
              </span>
            ))}
            {invite.products.split(',').length > 4 && (
              <span className="text-[10px] text-slate-500">+{invite.products.split(',').length - 4} more</span>
            )}
          </div>
        )}

        {/* Expanded notes */}
        {expanded && invite.notes && (
          <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-slate-400 font-medium mb-1">Notes:</p>
            <p className="text-sm text-slate-300">{invite.notes}</p>
          </div>
        )}

        {/* Rejection reason form */}
        {showRejectForm && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-sm min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectForm(false)}
                className="border-white/20 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => { onReject(invite.id, rejectReason); setShowRejectForm(false); }}
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 text-white border-none"
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {invite.status === 'pending' && !showRejectForm && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(invite.id)}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-none text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectForm(true)}
              disabled={loading}
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Staff Request Card (Manager / Employee / Driver) ──────────────────────────
function StaffCard({ invite, type, onApprove, onReject, loading }) {
  const iconMap = { manager: Users, employee: UserCircle, driver: Truck };
  const colorMap = {
    manager:  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    employee: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    driver:   { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  };
  const Icon = iconMap[type] || UserCircle;
  const colors = colorMap[type] || colorMap.employee;

  return (
    <Card className="bg-white/5 border-white/10">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-sm">{invite.full_name || invite.name || invite.email}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[invite.status || 'pending']}`}>
                  {invite.status || 'pending'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-400 capitalize">
                  {type}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                <Mail className="w-3 h-3" />{invite.email}
              </div>
              {invite.branch && (
                <p className="text-xs text-slate-500 mt-0.5">Branch: {invite.branch}</p>
              )}
            </div>
          </div>
          <span className="text-slate-600 text-xs shrink-0 hidden sm:block">
            {invite.created_at ? format(new Date(invite.created_at), 'MMM d, yyyy') : ''}
          </span>
        </div>

        {(invite.status === 'pending' || !invite.status) && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(invite.id, type)}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-none text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(invite.id, type, '')}
              disabled={loading}
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OwnerApprovalCenter() {
  const { user } = useAuth();
  const { restaurant } = useTenant();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch supplier invites ──
  const { data: supplierInvites = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['supplier_invites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase
        .from('supplier_invites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.warn('[ApprovalCenter] supplier_invites:', error.message); return []; }
      return data || [];
    },
    enabled: !!restaurant?.id,
  });

  // ── Fetch manager invites ──
  const { data: managerInvites = [], isLoading: loadingManagers } = useQuery({
    queryKey: ['manager_invites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase
        .from('manager_invites')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });
      if (error) { console.warn('[ApprovalCenter] manager_invites:', error.message); return []; }
      return data || [];
    },
    enabled: !!restaurant?.id,
  });

  // ── Fetch employee invites ──
  const { data: employeeInvites = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employee_invites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase
        .from('employee_invites')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });
      if (error) { console.warn('[ApprovalCenter] employee_invites:', error.message); return []; }
      return data || [];
    },
    enabled: !!restaurant?.id,
  });

  // ── Fetch driver invites ──
  const { data: driverInvites = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['driver_invites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant?.id) return [];
      const { data, error } = await supabase
        .from('driver_invites')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });
      if (error) { console.warn('[ApprovalCenter] driver_invites:', error.message); return []; }
      return data || [];
    },
    enabled: !!restaurant?.id,
  });

  // ── Approve supplier ──
  const approveSupplier = async (id) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_invites')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.email })
        .eq('id', id);
      if (error) throw error;
      toast.success('Supplier approved successfully');
      qc.invalidateQueries({ queryKey: ['supplier_invites'] });
    } catch (e) {
      toast.error(e.message || 'Failed to approve supplier');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject supplier ──
  const rejectSupplier = async (id, reason) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('supplier_invites')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw error;
      toast.success('Supplier rejected');
      qc.invalidateQueries({ queryKey: ['supplier_invites'] });
    } catch (e) {
      toast.error(e.message || 'Failed to reject supplier');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Approve staff (manager/employee/driver) ──
  const approveStaff = async (id, type) => {
    setActionLoading(true);
    const tableMap = { manager: 'manager_invites', employee: 'employee_invites', driver: 'driver_invites' };
    const table = tableMap[type];
    try {
      const { error } = await supabase
        .from(table)
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} approved`);
      qc.invalidateQueries({ queryKey: [`${type}_invites`] });
    } catch (e) {
      toast.error(e.message || `Failed to approve ${type}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject staff ──
  const rejectStaff = async (id, type, reason) => {
    setActionLoading(true);
    const tableMap = { manager: 'manager_invites', employee: 'employee_invites', driver: 'driver_invites' };
    const table = tableMap[type];
    try {
      const { error } = await supabase
        .from(table)
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw error;
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} rejected`);
      qc.invalidateQueries({ queryKey: [`${type}_invites`] });
    } catch (e) {
      toast.error(e.message || `Failed to reject ${type}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Combine all for "all" tab ──
  const allItems = [
    ...supplierInvites.map(i => ({ ...i, _type: 'supplier' })),
    ...managerInvites.map(i => ({ ...i, _type: 'manager' })),
    ...employeeInvites.map(i => ({ ...i, _type: 'employee' })),
    ...driverInvites.map(i => ({ ...i, _type: 'driver' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const pendingCount = allItems.filter(i => !i.status || i.status === 'pending').length;

  // ── Filter by tab and search ──
  const getFilteredItems = () => {
    let items = activeTab === 'all' ? allItems : allItems.filter(i => i._type === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.supplier_name || i.full_name || i.name || i.email || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q)
      );
    }
    return items;
  };

  const filteredItems = getFilteredItems();
  const isLoading = loadingSuppliers || loadingManagers || loadingEmployees || loadingDrivers;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" />
            Approval Center
            {pendingCount > 0 && (
              <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review and approve registration requests from suppliers, managers, employees, and drivers.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries()}
          className="border-white/20 text-slate-300 hover:bg-white/5 shrink-0"
        >
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Suppliers', count: supplierInvites.filter(i => i.status === 'pending').length, icon: Building2, color: 'text-amber-400' },
          { label: 'Managers',  count: managerInvites.filter(i => !i.status || i.status === 'pending').length,  icon: Users,      color: 'text-purple-400' },
          { label: 'Employees', count: employeeInvites.filter(i => !i.status || i.status === 'pending').length, icon: UserCircle, color: 'text-emerald-400' },
          { label: 'Drivers',   count: driverInvites.filter(i => !i.status || i.status === 'pending').length,   icon: Truck,      color: 'text-rose-400' },
        ].map(stat => (
          <Card key={stat.label} className="p-3 bg-white/5 border-white/10">
            <div className="flex items-center gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-slate-400 text-xs">{stat.label}</span>
            </div>
            <p className={`text-2xl font-black mt-1 ${stat.count > 0 ? stat.color : 'text-slate-600'}`}>
              {stat.count}
            </p>
            <p className="text-[10px] text-slate-600">pending</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No requests found</p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? 'Try a different search term' : 'All caught up! No pending approvals.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            if (item._type === 'supplier') {
              return (
                <SupplierCard
                  key={`supplier-${item.id}`}
                  invite={item}
                  onApprove={approveSupplier}
                  onReject={rejectSupplier}
                  loading={actionLoading}
                />
              );
            }
            return (
              <StaffCard
                key={`${item._type}-${item.id}`}
                invite={item}
                type={item._type}
                onApprove={approveStaff}
                onReject={rejectStaff}
                loading={actionLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
