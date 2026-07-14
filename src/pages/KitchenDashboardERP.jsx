import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BranchSelector from '@/components/shared/BranchSelector';
import {
  ChefHat, Clock, CheckCircle2, AlertCircle, LogOut, GitBranch,
  RefreshCw, Flame, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:    { label: 'New', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  preparing:  { label: 'Preparing', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  ready:      { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  delivered:  { label: 'Delivered', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
};

export default function KitchenDashboardERP() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [activeBranch, setActiveBranch] = useState(null);
  const [branchSelected, setBranchSelected] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem('erp_active_branch_id');
    const name = sessionStorage.getItem('erp_active_branch_name');
    if (id && name) { setActiveBranch({ id, name }); setBranchSelected(true); }
  }, []);

  if (!branchSelected) return <BranchSelector onSelect={b => { setActiveBranch(b); setBranchSelected(true); }} />;

  const branchId = activeBranch?.id;

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['kitchen-orders', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from('kitchen_queues')
        .select('*, order_items(*, products(name))')
        .eq('branch_id', branchId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }) => {
      const { error } = await supabase
        .from('kitchen_queues')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Kitchen Display</p>
              <div className="flex items-center gap-1 text-slate-500 text-xs">
                <GitBranch className="w-3 h-3" />{activeBranch?.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-amber-400">
                <div className="w-2 h-2 rounded-full bg-amber-400" />{pending.length} new
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <div className="w-2 h-2 rounded-full bg-blue-400" />{preparing.length} prep
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />{ready.length} ready
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <RefreshCw className="w-5 h-5 animate-spin" />Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-bold text-lg">Kitchen Clear!</p>
            <p className="text-slate-500 text-sm mt-1">No active orders right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* New Orders */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-amber-400 font-bold text-sm">NEW ORDERS ({pending.length})</h2>
              </div>
              <div className="space-y-3">
                {pending.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={() => updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' })}
                    actionLabel="Start Preparing"
                    actionColor="bg-blue-600 hover:bg-blue-700"
                    loading={updateStatusMutation.isPending}
                  />
                ))}
              </div>
            </div>

            {/* Preparing */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-3 h-3 text-blue-400" />
                <h2 className="text-blue-400 font-bold text-sm">PREPARING ({preparing.length})</h2>
              </div>
              <div className="space-y-3">
                {preparing.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={() => updateStatusMutation.mutate({ orderId: order.id, status: 'ready' })}
                    actionLabel="Mark Ready"
                    actionColor="bg-emerald-600 hover:bg-emerald-700"
                    loading={updateStatusMutation.isPending}
                  />
                ))}
              </div>
            </div>

            {/* Ready */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <h2 className="text-emerald-400 font-bold text-sm">READY ({ready.length})</h2>
              </div>
              <div className="space-y-3">
                {ready.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={() => updateStatusMutation.mutate({ orderId: order.id, status: 'delivered' })}
                    actionLabel="Mark Delivered"
                    actionColor="bg-slate-600 hover:bg-slate-700"
                    loading={updateStatusMutation.isPending}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order, onAction, actionLabel, actionColor, loading }) {
  const elapsed = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
    : 0;
  const isUrgent = elapsed > 15;

  return (
    <Card className={`border ${isUrgent ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-white/5'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Order #{order.id?.slice(0, 6)}</p>
            <div className={`flex items-center gap-1 text-xs mt-0.5 ${isUrgent ? 'text-red-400' : 'text-slate-500'}`}>
              <Clock className="w-3 h-3" />
              {elapsed}m ago{isUrgent && ' ⚠️'}
            </div>
          </div>
          {order.table_number && (
            <Badge className="bg-white/10 text-slate-300 border-white/10 text-xs">
              Table {order.table_number}
            </Badge>
          )}
        </div>

        {order.order_items?.length > 0 && (
          <div className="space-y-1 mb-3">
            {order.order_items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{item.products?.name || 'Item'}</span>
                <span className="text-white font-bold">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        {order.notes && (
          <p className="text-amber-300 text-xs bg-amber-500/10 rounded-lg px-2 py-1 mb-3">
            📝 {order.notes}
          </p>
        )}

        <Button
          size="sm"
          onClick={onAction}
          disabled={loading}
          className={`w-full ${actionColor} text-white text-xs h-8`}
        >
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
