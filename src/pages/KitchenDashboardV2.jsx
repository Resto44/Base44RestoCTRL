/**
 * Kitchen Dashboard V2 — Online Ordering V2
 * Smart Restaurant ERP — Integrated Module
 * Real-time order queue, priority management, station workflow.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import {
  ChefHat, Clock, CheckCircle2, X, Flame, Package, AlertTriangle,
  Volume2, VolumeX, RefreshCw, ArrowUp, Timer, Zap, Bell, Filter
} from 'lucide-react';
import { useKitchenOrders, useKitchenActions } from '@/hooks/useOnlineOrdering';
import { KITCHEN_STATUS, ORDER_STATUS } from '@/lib/onlineOrderingService';

// ── Kitchen Ticket Component ───────────────────────────────────────────────
function KitchenTicket({ order, onAction, isUpdating }) {
  const [items, setItems] = useState([]);
  const ageMinutes = differenceInMinutes(new Date(), new Date(order.created_date || order.created_at));
  const isUrgent = ageMinutes > 15;
  const isWarning = ageMinutes > 10;

  useEffect(() => {
    if (order.items_json) {
      try { setItems(JSON.parse(order.items_json)); } catch { setItems([]); }
    }
  }, [order.items_json]);

  const statusConfig = {
    [ORDER_STATUS.PENDING]:   { label: 'New Order', color: 'border-blue-500 bg-blue-50', badge: 'bg-blue-500' },
    [ORDER_STATUS.ACCEPTED]:  { label: 'Accepted',  color: 'border-amber-500 bg-amber-50', badge: 'bg-amber-500' },
    [ORDER_STATUS.PREPARING]: { label: 'Preparing', color: 'border-orange-500 bg-orange-50', badge: 'bg-orange-500' },
    [ORDER_STATUS.COOKING]:   { label: 'Cooking',   color: 'border-red-500 bg-red-50', badge: 'bg-red-500' },
    [ORDER_STATUS.READY]:     { label: 'Ready',     color: 'border-green-500 bg-green-50', badge: 'bg-green-500' },
  };
  const cfg = statusConfig[order.status] || statusConfig[ORDER_STATUS.PENDING];

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${cfg.color} ${isUrgent ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{order.order_number || `#${order.id?.slice(-4)}`}</span>
            {order.priority === 'urgent' && (
              <Badge className="bg-red-500 text-white text-xs animate-pulse">URGENT</Badge>
            )}
            {order.priority === 'high' && (
              <Badge className="bg-orange-500 text-white text-xs">HIGH</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {order.customer_name || 'Customer'} · {order.order_type || 'delivery'}
          </p>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 text-sm font-bold ${isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-muted-foreground'}`}>
            <Clock className="w-3.5 h-3.5" />
            {ageMinutes}m
          </div>
          <Badge className={`text-xs text-white ${cfg.badge}`}>{cfg.label}</Badge>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
        {items.length > 0 ? items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="font-bold text-primary w-6">{item.qty}×</span>
            <span className="flex-1 truncate">{item.name}</span>
            {item.notes && <span className="text-xs text-amber-600 italic truncate">({item.notes})</span>}
          </div>
        )) : (
          <p className="text-xs text-muted-foreground">Loading items...</p>
        )}
      </div>

      {/* Notes */}
      {order.customer_notes && (
        <div className="mb-3 p-2 bg-amber-100 rounded-lg text-xs text-amber-800">
          <span className="font-bold">Note: </span>{order.customer_notes}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {order.status === ORDER_STATUS.PENDING && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onAction(order.id, KITCHEN_STATUS.ACCEPTED)} disabled={isUpdating}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
            </Button>
            <Button size="sm" variant="destructive"
              onClick={() => onAction(order.id, KITCHEN_STATUS.REJECTED)} disabled={isUpdating}>
              <X className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </>
        )}
        {order.status === ORDER_STATUS.ACCEPTED && (
          <Button size="sm" className="col-span-2 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onAction(order.id, KITCHEN_STATUS.PREPARING)} disabled={isUpdating}>
            <ChefHat className="w-3.5 h-3.5 mr-1" /> Start Preparing
          </Button>
        )}
        {order.status === ORDER_STATUS.PREPARING && (
          <Button size="sm" className="col-span-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => onAction(order.id, KITCHEN_STATUS.COOKING)} disabled={isUpdating}>
            <Flame className="w-3.5 h-3.5 mr-1" /> Mark Cooking
          </Button>
        )}
        {order.status === ORDER_STATUS.COOKING && (
          <Button size="sm" className="col-span-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onAction(order.id, KITCHEN_STATUS.READY)} disabled={isUpdating}>
            <Package className="w-3.5 h-3.5 mr-1" /> Mark Ready
          </Button>
        )}
        {order.status === ORDER_STATUS.READY && (
          <div className="col-span-2 flex items-center justify-center gap-2 p-2 bg-green-100 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-bold text-green-700">Ready for Pickup</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kitchen Stats Bar ──────────────────────────────────────────────────────
function KitchenStats({ orders }) {
  const pending = orders.filter(o => o.status === ORDER_STATUS.PENDING).length;
  const preparing = orders.filter(o => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.COOKING].includes(o.status)).length;
  const ready = orders.filter(o => o.status === ORDER_STATUS.READY).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{pending}</p>
          <p className="text-xs text-blue-500 font-medium">New Orders</p>
        </CardContent>
      </Card>
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{preparing}</p>
          <p className="text-xs text-amber-500 font-medium">In Progress</p>
        </CardContent>
      </Card>
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{ready}</p>
          <p className="text-xs text-green-500 font-medium">Ready</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Kitchen Dashboard V2 ──────────────────────────────────────────────
export default function KitchenDashboardV2() {
  const { user } = useAuth?.() || {};
  const { restaurant } = useTenant?.() || {};
  const { lang } = useLanguage?.() || { lang: 'en' };
  const qc = useQueryClient();
  const audioRef = useRef(null);
  const prevOrderCountRef = useRef(0);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // Use the branch from restaurant or first branch
  const branchId = restaurant?.branches?.[0]?.id || restaurant?.id;

  const { data: orders = [], isLoading } = useKitchenOrders(branchId);
  const kitchenActions = useKitchenActions(user?.email, restaurant?.id);

  // Sound alert for new orders
  useEffect(() => {
    if (!soundEnabled) return;
    const newCount = orders.filter(o => o.status === ORDER_STATUS.PENDING).length;
    if (newCount > prevOrderCountRef.current) {
      // Play notification sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } catch (e) { /* Audio not available */ }
    }
    prevOrderCountRef.current = newCount;
  }, [orders, soundEnabled]);

  const handleAction = useCallback((orderId, kitchenStatus) => {
    kitchenActions.mutate(
      { orderId, kitchenStatus, actorId: user?.id },
      {
        onSuccess: () => toast.success(`Order updated to ${kitchenStatus}`),
        onError: () => toast.error('Failed to update order'),
      }
    );
  }, [kitchenActions, user?.id]);

  // Filter and sort orders
  const filteredOrders = orders.filter(o => {
    if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
    return true;
  }).sort((a, b) => {
    // Urgent first, then by age
    const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 };
    const pa = priorityWeight[a.priority] || 2;
    const pb = priorityWeight[b.priority] || 2;
    if (pa !== pb) return pb - pa;
    return new Date(a.created_date) - new Date(b.created_date);
  });

  const pendingOrders = filteredOrders.filter(o => o.status === ORDER_STATUS.PENDING);
  const inProgressOrders = filteredOrders.filter(o =>
    [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.COOKING].includes(o.status)
  );
  const readyOrders = filteredOrders.filter(o => o.status === ORDER_STATUS.READY);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-base">Kitchen Dashboard</h1>
              <p className="text-xs text-gray-400">{restaurant?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(v => !v)}
              className={`p-2 rounded-full ${soundEnabled ? 'bg-green-600' : 'bg-gray-700'}`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['kitchen_orders'] })}
              className="p-2 rounded-full bg-gray-700 hover:bg-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-400">{format(new Date(), 'HH:mm')}</p>
              <p className="text-xs text-gray-500">{format(new Date(), 'MMM d')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-300">{pendingOrders.length}</p>
            <p className="text-xs text-blue-400 font-medium">New Orders</p>
          </div>
          <div className="bg-amber-900/40 border border-amber-700/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-300">{inProgressOrders.length}</p>
            <p className="text-xs text-amber-400 font-medium">In Progress</p>
          </div>
          <div className="bg-green-900/40 border border-green-700/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-300">{readyOrders.length}</p>
            <p className="text-xs text-green-400 font-medium">Ready</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          {['all', 'urgent', 'high', 'normal'].map(f => (
            <button
              key={f}
              onClick={() => setPriorityFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                priorityFilter === f ? 'bg-primary text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <ChefHat className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No active orders</p>
            <p className="text-sm">New orders will appear here instantly</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* New Orders */}
            {pendingOrders.length > 0 && (
              <div className="md:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-blue-400 animate-bounce" />
                  <h2 className="text-sm font-bold text-blue-300 uppercase tracking-wide">
                    New Orders ({pendingOrders.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {pendingOrders.map(o => (
                    <KitchenTicket key={o.id} order={o} onAction={handleAction} isUpdating={kitchenActions.isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* In Progress */}
            {inProgressOrders.length > 0 && (
              <div className="md:col-span-2 lg:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                    In Progress ({inProgressOrders.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inProgressOrders.map(o => (
                    <KitchenTicket key={o.id} order={o} onAction={handleAction} isUpdating={kitchenActions.isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* Ready */}
            {readyOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">
                    Ready ({readyOrders.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {readyOrders.map(o => (
                    <div key={o.id} className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-emerald-200">{o.order_number || `#${o.id?.slice(-4)}`}</p>
                          {o.driver_name && <p className="text-xs text-emerald-400">🚴 {o.driver_name}</p>}
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
