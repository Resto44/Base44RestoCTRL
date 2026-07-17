import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BranchSelector from '@/components/shared/BranchSelector';
import {
  Truck, MapPin, Clock, DollarSign, CheckCircle2, LogOut,
  GitBranch, RefreshCw, Navigation, Package, Home, History, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ORDER_STATUS = {
  assigned:   { label: 'Assigned', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  picked_up:  { label: 'Picked Up', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  delivered:  { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  failed:     { label: 'Failed', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function DriverDashboardERP() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [activeBranch, setActiveBranch] = useState(null);
  const [branchSelected, setBranchSelected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const id = sessionStorage.getItem('erp_active_branch_id');
    const name = sessionStorage.getItem('erp_active_branch_name');
    if (id && name) { setActiveBranch({ id, name }); setBranchSelected(true); }
  }, []);

  if (!branchSelected) return <BranchSelector onSelect={b => { setActiveBranch(b); setBranchSelected(true); }} />;

  const branchId = activeBranch?.id;

  // Driver profile — look up from 'drivers' table (created by erp_decide_membership on approval)
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.email],
    queryFn: async () => {
      // First try the drivers table (ERP approval flow)
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('*')
        .eq('email', user?.email)
        .limit(1)
        .maybeSingle();
      if (driverRow) return driverRow;
      // Fallback: legacy employees table
      const { data: empRow } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user?.email)
        .maybeSingle();
      return empRow || null;
    },
    enabled: !!user?.email,
  });

  // My active orders
  const { data: myOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['driver-orders', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      const { data, error } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverProfile?.id && !!branchId,
    refetchInterval: 20000,
  });

  // Today's earnings
  const { data: todayEarnings } = useQuery({
    queryKey: ['driver-earnings', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return { total: 0, deliveries: 0 };
      const { data } = await supabase
        .from('delivery_orders')
        .select('delivery_fee, tip_amount')
        .eq('driver_id', driverProfile.id)
        .eq('branch_id', branchId)
        .eq('status', 'delivered')
        .gte('delivered_at', `${today}T00:00:00`);
      if (!data) return { total: 0, deliveries: 0 };
      const total = data.reduce((s, o) => s + (o.delivery_fee || 0) + (o.tip_amount || 0), 0);
      return { total, deliveries: data.length };
    },
    enabled: !!driverProfile?.id && !!branchId,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }) => {
      const updates = { status };
      if (status === 'picked_up') updates.picked_up_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();
      const { error } = await supabase
        .from('delivery_orders')
        .update(updates)
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order updated!');
      qc.invalidateQueries({ queryKey: ['driver-orders'] });
      qc.invalidateQueries({ queryKey: ['driver-earnings'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const activeOrders = myOrders.filter(o => ['assigned', 'picked_up'].includes(o.status));
  const completedToday = myOrders.filter(o => o.status === 'delivered' && o.delivered_at?.startsWith(today));

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'history', label: 'History', icon: History },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{driverProfile?.full_name || user?.email}</p>
              <div className="flex items-center gap-1 text-slate-500 text-xs">
                <GitBranch className="w-3 h-3" />{activeBranch?.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetchOrders()} className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-sky-400">{activeOrders.length}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Active</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">{completedToday.length}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Done Today</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-amber-400">${(todayEarnings?.total || 0).toFixed(0)}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Earned</p>
                </CardContent>
              </Card>
            </div>

            {/* Active Orders */}
            {activeOrders.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-white font-medium">No active deliveries</p>
                  <p className="text-slate-500 text-sm mt-1">Waiting for new orders…</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <h3 className="text-white font-bold text-sm">Active Deliveries</h3>
                {activeOrders.map(order => (
                  <DeliveryCard
                    key={order.id}
                    order={order}
                    onUpdate={(status) => updateOrderMutation.mutate({ orderId: order.id, status })}
                    loading={updateOrderMutation.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h3 className="text-white font-bold">All Orders</h3>
            {myOrders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No orders yet.</p>
            ) : (
              myOrders.map(order => (
                <DeliveryCard
                  key={order.id}
                  order={order}
                  onUpdate={(status) => updateOrderMutation.mutate({ orderId: order.id, status })}
                  loading={updateOrderMutation.isPending}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <h3 className="text-white font-bold">Delivery History</h3>
            {completedToday.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No deliveries completed today.</p>
            ) : (
              completedToday.map(order => (
                <Card key={order.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">Order #{order.id?.slice(0, 8)}</p>
                        <p className="text-slate-500 text-xs">
                          {order.delivered_at ? format(new Date(order.delivered_at), 'h:mm a') : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 text-sm font-bold">
                          ${((order.delivery_fee || 0) + (order.tip_amount || 0)).toFixed(2)}
                        </p>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          Delivered
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-sky-600/20 to-blue-700/20 border-sky-500/30">
              <CardContent className="p-6 text-center">
                <p className="text-slate-400 text-sm mb-1">Today's Earnings</p>
                <p className="text-4xl font-black text-white">${(todayEarnings?.total || 0).toFixed(2)}</p>
                <p className="text-sky-400 text-sm mt-2">{todayEarnings?.deliveries || 0} deliveries completed</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur border-t border-white/10 z-40">
        <div className="max-w-2xl mx-auto px-4 flex">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  activeTab === tab.id ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function DeliveryCard({ order, onUpdate, loading }) {
  const statusConf = ORDER_STATUS[order.status] || ORDER_STATUS.assigned;
  const nextAction = order.status === 'assigned'
    ? { label: 'Picked Up', status: 'picked_up', color: 'bg-blue-600 hover:bg-blue-700' }
    : order.status === 'picked_up'
    ? { label: 'Mark Delivered', status: 'delivered', color: 'bg-emerald-600 hover:bg-emerald-700' }
    : null;

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-white font-bold text-sm">Order #{order.id?.slice(0, 8)}</p>
            <p className="text-slate-500 text-xs">
              {order.created_at ? format(new Date(order.created_at), 'h:mm a') : ''}
            </p>
          </div>
          <Badge className={`text-[10px] border ${statusConf.color}`}>{statusConf.label}</Badge>
        </div>

        {order.delivery_address && (
          <div className="flex items-start gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-slate-300 text-xs">{order.delivery_address}</p>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-xs">Delivery fee</span>
          <span className="text-emerald-400 text-sm font-bold">
            ${((order.delivery_fee || 0) + (order.tip_amount || 0)).toFixed(2)}
          </span>
        </div>

        {nextAction && (
          <Button
            size="sm"
            onClick={() => onUpdate(nextAction.status)}
            disabled={loading}
            className={`w-full ${nextAction.color} text-white text-xs h-8`}
          >
            {nextAction.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
