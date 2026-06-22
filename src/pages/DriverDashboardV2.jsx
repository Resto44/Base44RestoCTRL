/**
 * Driver Dashboard V2 — Online Ordering V2
 * Smart Restaurant ERP — Integrated Module
 * Real-time order assignment, GPS tracking, navigation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import {
  Navigation, Phone, MessageCircle, MapPin, CheckCircle2, Package,
  Bike, Clock, AlertTriangle, RefreshCw, ChevronRight, X, Truck,
  Home, DollarSign, Star, History
} from 'lucide-react';
import {
  useDriverOrders, useDriverActions, useDriverLocationUpdate
} from '@/hooks/useOnlineOrdering';
import { ORDER_STATUS, PAYMENT_METHODS } from '@/lib/onlineOrderingService';

// ── Active Order Card ──────────────────────────────────────────────────────
function ActiveOrderCard({ order, onStatusUpdate, isUpdating, isTracking, onStartTracking, onStopTracking }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (order.items_json) {
      try { setItems(JSON.parse(order.items_json)); } catch { setItems([]); }
    }
  }, [order.items_json]);

  const ageMinutes = differenceInMinutes(new Date(), new Date(order.created_date || order.created_at));

  const nextAction = {
    [ORDER_STATUS.ASSIGNED]:   { label: 'Mark Picked Up', status: ORDER_STATUS.PICKED_UP, color: 'bg-blue-600' },
    [ORDER_STATUS.PICKED_UP]:  { label: 'On the Way', status: ORDER_STATUS.ON_THE_WAY, color: 'bg-indigo-600' },
    [ORDER_STATUS.ON_THE_WAY]: { label: 'Arrived', status: ORDER_STATUS.ARRIVED, color: 'bg-purple-600' },
    [ORDER_STATUS.ARRIVED]:    { label: 'Mark Delivered', status: ORDER_STATUS.DELIVERED, color: 'bg-green-600' },
  };

  const action = nextAction[order.status];

  return (
    <Card className="border-primary/30 shadow-md">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{order.order_number || `#${order.id?.slice(-4)}`}</h3>
            <p className="text-xs text-muted-foreground">{ageMinutes}m ago</p>
          </div>
          <Badge className={`${
            order.status === ORDER_STATUS.DELIVERED ? 'bg-green-500' :
            order.status === ORDER_STATUS.ON_THE_WAY ? 'bg-blue-500' : 'bg-amber-500'
          } text-white`}>
            {order.status?.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Customer Info */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {(order.customer_name || 'C')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{order.customer_name || 'Customer'}</p>
              <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
            </div>
            <div className="flex gap-2">
              {order.customer_phone && (
                <a href={`tel:${order.customer_phone}`}>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              {order.customer_phone && (
                <a href={`https://wa.me/${order.customer_phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-green-600">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm">{order.customer_address || 'Address not available'}</p>
          </div>
          {order.customer_notes && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{order.customer_notes}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.qty}× {item.name}</span>
              <span className="text-muted-foreground">{(item.unit_price * item.qty)?.toFixed(2)} SAR</span>
            </div>
          ))}
        </div>

        {/* Payment */}
        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {PAYMENT_METHODS.find(p => p.id === order.payment_method)?.label_en || order.payment_method}
            </span>
          </div>
          <span className="font-bold text-primary">{order.total_amount?.toFixed(2)} SAR</span>
        </div>

        {/* GPS Tracking Toggle */}
        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Navigation className={`w-4 h-4 ${isTracking ? 'text-blue-600 animate-pulse' : 'text-gray-400'}`} />
            <span className="text-sm">{isTracking ? 'GPS Active' : 'GPS Inactive'}</span>
          </div>
          <Button
            size="sm"
            variant={isTracking ? 'destructive' : 'default'}
            onClick={isTracking ? onStopTracking : onStartTracking}
          >
            {isTracking ? 'Stop' : 'Start GPS'}
          </Button>
        </div>

        {/* Navigation Button */}
        {order.customer_address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full">
              <Navigation className="w-4 h-4 mr-2" />
              Open in Maps
            </Button>
          </a>
        )}

        {/* Action Button */}
        {action && (
          <Button
            className={`w-full text-white ${action.color}`}
            onClick={() => onStatusUpdate(order.id, action.status)}
            disabled={isUpdating}
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Driver Dashboard V2 ───────────────────────────────────────────────
export default function DriverDashboardV2() {
  const { user } = useAuth?.() || {};
  const { restaurant } = useTenant?.() || {};
  const qc = useQueryClient();

  const [view, setView] = useState('active'); // 'active' | 'history'
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const { data: activeOrders = [], isLoading } = useDriverOrders(user?.id);
  const driverActions = useDriverActions(user?.email, restaurant?.id);

  const activeOrder = activeOrders[0] || null;
  const { isTracking, startTracking, stopTracking } = useDriverLocationUpdate(user?.id, activeOrder?.id);

  // Load completed orders for history
  const { data: allOrders = [] } = useQuery({
    queryKey: ['driver_all_orders', user?.id],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ driver_id: user?.id });
      return orders.filter(o => o.status === ORDER_STATUS.DELIVERED);
    },
    enabled: !!user?.id,
  });

  const handleStatusUpdate = useCallback((orderId, status) => {
    driverActions.mutate(
      { orderId, status, actorId: user?.id },
      {
        onSuccess: () => {
          toast.success(`Order marked as ${status.replace(/_/g, ' ')}`);
          if (status === ORDER_STATUS.DELIVERED) stopTracking();
          qc.invalidateQueries({ queryKey: ['driver_orders'] });
        },
        onError: () => toast.error('Failed to update order status'),
      }
    );
  }, [driverActions, user?.id, stopTracking, qc]);

  // Stats
  const todayDeliveries = allOrders.filter(o => {
    const d = new Date(o.actual_delivery_time || o.updated_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const todayEarnings = allOrders
    .filter(o => {
      const d = new Date(o.actual_delivery_time || o.updated_date);
      return d.toDateString() === new Date().toDateString();
    })
    .reduce((s, o) => s + (o.delivery_fee || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bike className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base">Driver Portal</h1>
              <p className="text-xs text-muted-foreground">{user?.full_name || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView(v => v === 'active' ? 'history' : 'active')}
              className="p-2 rounded-full hover:bg-muted">
              {view === 'active' ? <History className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
            </button>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['driver_orders'] })}
              className="p-2 rounded-full hover:bg-muted">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{todayDeliveries}</p>
              <p className="text-xs text-muted-foreground">Today's Deliveries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{todayEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Today's Earnings (SAR)</p>
            </CardContent>
          </Card>
        </div>

        {view === 'active' ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Bike className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No Active Orders</p>
                <p className="text-sm">New orders will appear here when assigned</p>
              </div>
            ) : (
              activeOrders.map(order => (
                <ActiveOrderCard
                  key={order.id}
                  order={order}
                  onStatusUpdate={handleStatusUpdate}
                  isUpdating={driverActions.isPending}
                  isTracking={isTracking && activeOrder?.id === order.id}
                  onStartTracking={startTracking}
                  onStopTracking={stopTracking}
                />
              ))
            )}
          </>
        ) : (
          <>
            <h2 className="font-bold text-lg">Delivery History</h2>
            {allOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No completed deliveries yet</p>
              </div>
            ) : (
              allOrders.slice(0, 30).map(order => (
                <Card key={order.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customer_name} · {format(new Date(order.actual_delivery_time || order.updated_date), 'MMM d, HH:mm')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{order.delivery_fee?.toFixed(2)} SAR</p>
                        <Badge className="bg-green-100 text-green-700 text-xs">Delivered</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </main>
    </div>
  );
}
