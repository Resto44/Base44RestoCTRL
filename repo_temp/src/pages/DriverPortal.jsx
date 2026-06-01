import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, Package, Clock, Wallet, History, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DriverHome from '@/components/driver/DriverHome';
import DriverOrderCard from '@/components/driver/DriverOrderCard';
import DriverShiftPanel from '@/components/driver/DriverShiftPanel';
import DriverWalletView from '@/components/driver/DriverWalletView';
import DriverHistory from '@/components/driver/DriverHistory';
import useDriverLocation from '@/hooks/useDriverLocation';

export default function DriverPortal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('home');
  const today = new Date().toISOString().split('T')[0];

  // Find the Employee record linked to this user's email
  const { data: employees = [] } = useQuery({
    queryKey: ['my-employee', user?.email],
    queryFn: () => user?.email ? base44.entities.Employee.filter({ email: user.email }) : [],
    enabled: !!user?.email,
  });
  const driver = employees[0] || null;
  const branch = driver?.branch || '';

  // My assigned orders (today + active)
  const { data: myOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['my-orders', driver?.id, today],
    queryFn: () => driver?.id
      ? base44.entities.DeliveryOrder.filter({ driver_id: driver.id }, '-created_date', 100)
      : [],
    enabled: !!driver?.id,
    refetchInterval: 15000,
  });

  // My active shift
  const { data: myShifts = [], refetch: refetchShift } = useQuery({
    queryKey: ['driver-shift', driver?.id, today],
    queryFn: () => driver?.id
      ? base44.entities.DriverShift.filter({ driver_id: driver.id, date: today })
      : [],
    enabled: !!driver?.id,
    refetchInterval: 20000,
  });

  const activeShift = myShifts.find(s => s.status === 'open') || null;

  // GPS location tracking — auto-starts when on shift
  const { position: driverPosition, error: gpsError, watching: gpsWatching, startWatching, stopWatching } = useDriverLocation({
    shiftId: activeShift?.id,
    autoStart: false,
  });

  // Start GPS when shift starts, stop when it ends
  useEffect(() => {
    if (activeShift && !gpsWatching) startWatching();
    if (!activeShift && gpsWatching) stopWatching();
  }, [!!activeShift]);
  const todayOrders = myOrders.filter(o => o.created_date?.startsWith(today));
  const activeOrders = myOrders.filter(o => ['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status));

  const todayCash = todayOrders
    .filter(o => o.status === 'delivered' && o.payment_method === 'cash')
    .reduce((s, o) => s + (o.total_amount || 0), 0);
  const todayNetwork = todayOrders
    .filter(o => o.status === 'delivered' && o.payment_method === 'network')
    .reduce((s, o) => s + (o.total_amount || 0), 0);

  const { data: pendingSettlements = [] } = useQuery({
    queryKey: ['my-pending-settlements', driver?.id],
    queryFn: () => driver?.id
      ? base44.entities.DriverSettlement.filter({ driver_id: driver.id, status: 'pending' })
      : [],
    enabled: !!driver?.id,
  });
  const pendingSettlement = pendingSettlements.reduce((s, x) => s + (x.total_collected || 0), 0);

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.DeliveryOrder.update(id, {
      status,
      ...(status === 'delivered' ? { delivered_at: new Date().toISOString(), payment_collected: true, collected_at: new Date().toISOString() } : {}),
    }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'delivered' ? '✅ Order delivered!' : 'Order updated');
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['delivery-orders'] });
    },
  });

  if (!driver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🚴</div>
        <h2 className="text-xl font-bold mb-2">Driver Profile Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your employee profile hasn't been linked yet. Please ask your manager to set your email ({user?.email}) on your employee record.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">{driver.full_name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {branch} · {activeShift ? <span className="text-green-600 font-medium">🟢 On Shift</span> : <span>⚫ Off Shift</span>}
              {gpsWatching && <span className="flex items-center gap-0.5 text-blue-500"><Navigation className="w-3 h-3 animate-pulse" />GPS</span>}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { refetchOrders(); refetchShift(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full mb-4 h-12">
            <TabsTrigger value="home" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <Home className="w-4 h-4" />Home
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full relative">
              <Package className="w-4 h-4" />Orders
              {activeOrders.length > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                  {activeOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="shift" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <Clock className="w-4 h-4" />Shift
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <Wallet className="w-4 h-4" />Wallet
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <History className="w-4 h-4" />History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <DriverHome
              driver={driver}
              orders={todayOrders}
              activeShift={activeShift}
              todayCash={todayCash}
              todayNetwork={todayNetwork}
              pendingSettlement={pendingSettlement}
            />
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-3">
              {/* Active first */}
              {activeOrders.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No active orders</p>
                  <p className="text-xs text-muted-foreground mt-1">New orders will appear here automatically</p>
                </div>
              )}
              {/* Sort: pending first, then out_for_delivery, then others */}
              {[...activeOrders]
                .sort((a, b) => {
                  const order = ['pending', 'ready', 'preparing', 'out_for_delivery'];
                  return (order.indexOf(a.status) ?? 9) - (order.indexOf(b.status) ?? 9);
                })
                .map(o => (
                  <DriverOrderCard
                    key={o.id}
                    order={o}
                    onUpdateStatus={(id, status) => updateOrderMutation.mutate({ id, status })}
                    isUpdating={updateOrderMutation.isPending}
                    driverPosition={driverPosition}
                  />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="shift">
            <DriverShiftPanel
              driver={driver}
              activeShift={activeShift}
              todayOrders={todayOrders}
              branch={branch}
              today={today}
              onShiftChange={() => { refetchShift(); refetchOrders(); }}
            />
          </TabsContent>

          <TabsContent value="wallet">
            <DriverWalletView driver={driver} />
          </TabsContent>

          <TabsContent value="history">
            <DriverHistory driver={driver} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}