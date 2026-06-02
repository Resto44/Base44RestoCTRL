import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { toast } from 'sonner';

function getElapsed(createdDate) {
  if (!createdDate) return 0;
  return Math.floor((Date.now() - new Date(createdDate).getTime()) / 60000);
}

function KitchenTicket({ order, onUpdate, isUpdating }) {
  const [, forceUpdate] = useState(0);
  const items = (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })();
  const elapsed = getElapsed(order.created_date);
  const urgency = elapsed > 20 ? 'urgent' : elapsed > 10 ? 'warning' : 'normal';

  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const borderColor = urgency === 'urgent' ? 'border-red-400 shadow-red-100 shadow-md' : urgency === 'warning' ? 'border-amber-400' : 'border-emerald-200';
  const barColor   = urgency === 'urgent' ? 'bg-red-500' : urgency === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';
  const timeColor  = urgency === 'urgent' ? 'text-red-600' : urgency === 'warning' ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <Card className={`overflow-hidden transition-all ${borderColor}`}>
      <div className={`h-1.5 ${barColor}`} />
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-base">{order.order_number || `#${order.id?.slice(-4)}`}</p>
            {order.customer_name && <p className="text-xs text-muted-foreground">👤 {order.customer_name}</p>}
            {order.driver_name && <p className="text-xs text-muted-foreground">🚴 {order.driver_name}</p>}
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 text-sm font-bold ${timeColor}`}>
              {urgency === 'urgent' && <AlertCircle className="w-4 h-4" />}
              <Clock className="w-4 h-4" />{elapsed}m
            </div>
            <Badge className={`text-xs mt-1 ${order.status === 'preparing' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
              {order.status === 'preparing' ? '🍳 Preparing' : '🕐 Pending'}
            </Badge>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1.5 bg-slate-50 rounded-lg p-3">
          {items.length === 0 && <p className="text-xs text-muted-foreground italic">No items</p>}
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
                {item.qty}
              </span>
              <span className="text-sm font-semibold">{item.name}</span>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
            📝 {order.notes}
          </div>
        )}

        {/* Action */}
        {order.status === 'pending' && (
          <Button
            className="w-full h-11 text-sm font-bold bg-amber-500 hover:bg-amber-600 rounded-xl"
            onClick={() => onUpdate(order.id, 'preparing')}
            disabled={isUpdating}
          >
            <ChefHat className="w-4 h-4 mr-1.5" /> Start Preparing
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            className="w-full h-11 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            onClick={() => onUpdate(order.id, 'ready')}
            disabled={isUpdating}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Ready
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function KitchenDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [branch, setBranch] = useState('');
  const today = new Date().toISOString().split('T')[0];

  // Find employee record to get the branch
  const { data: employees = [] } = useQuery({
    queryKey: ['kitchen-emp', user?.email],
    queryFn: () => user?.email ? base44.entities.Employee.filter({ email: user.email }) : [],
    enabled: !!user?.email,
  });
  const emp = employees[0] || null;

  useEffect(() => {
    if (emp?.branch && !branch) setBranch(emp.branch);
  }, [emp?.branch]);

  // Active kitchen orders — auto-refresh every 10s
  const { data: allOrders = [], refetch, isLoading } = useQuery({
    queryKey: ['kitchen-orders', branch],
    queryFn: () => branch
      ? base44.entities.DeliveryOrder.filter({ branch }, '-created_date', 200)
      : base44.entities.DeliveryOrder.filter({}, '-created_date', 200),
    refetchInterval: 10000,
  });

  const kitchenOrders = allOrders
    .filter(o => ['pending', 'preparing'].includes(o.status))
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  const readyOrders = allOrders
    .filter(o => o.status === 'ready')
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
    .slice(0, 10);

  const pending   = kitchenOrders.filter(o => o.status === 'pending');
  const preparing = kitchenOrders.filter(o => o.status === 'preparing');

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.DeliveryOrder.update(id, { status }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'ready' ? '✅ Order marked ready!' : '🍳 Started preparing');
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });

  const handleUpdate = (id, status) => updateMutation.mutate({ id, status });

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black">Kitchen Display</h1>
              <p className="text-xs text-slate-400">
                {branch || 'All Branches'} · Live
                {isLoading && ' · Refreshing…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => base44.auth.logout('/')}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-5xl mx-auto space-y-6">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-slate-200">{pending.length}</p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <div className="bg-amber-900/60 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-amber-300">{preparing.length}</p>
            <p className="text-xs text-amber-400">Preparing</p>
          </div>
          <div className="bg-emerald-900/60 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-300">{readyOrders.length}</p>
            <p className="text-xs text-emerald-400">Ready</p>
          </div>
        </div>

        {/* Active kitchen orders */}
        {kitchenOrders.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-bold text-slate-400">Kitchen is clear!</p>
            <p className="text-sm text-slate-600 mt-1">No pending or active orders</p>
          </div>
        ) : (
          <>
            {/* Pending section */}
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">
                    Pending — {pending.length} order{pending.length !== 1 ? 's' : ''}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pending.map(o => (
                    <KitchenTicket key={o.id} order={o} onUpdate={handleUpdate} isUpdating={updateMutation.isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* Preparing section */}
            {preparing.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ChefHat className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                    Preparing — {preparing.length} order{preparing.length !== 1 ? 's' : ''}
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {preparing.map(o => (
                    <KitchenTicket key={o.id} order={o} onUpdate={handleUpdate} isUpdating={updateMutation.isPending} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Ready orders — just completed */}
        {readyOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">
                Ready for Pickup — {readyOrders.length}
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {readyOrders.map(o => (
                <div key={o.id} className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-emerald-200">{o.order_number || `#${o.id?.slice(-4)}`}</p>
                    {o.driver_name && <p className="text-xs text-emerald-400">🚴 {o.driver_name}</p>}
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}