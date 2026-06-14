import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChefHat, Clock, CheckCircle2, AlertTriangle, Zap, BarChart3,
  Bell, RefreshCw, Play, Pause, Volume2, VolumeX, Timer
} from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';

const ORDER_STATUS = {
  pending:    { label: 'New Order',    color: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  preparing:  { label: 'Preparing',   color: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  ready:      { label: 'Ready',       color: 'bg-emerald-500',text: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  delayed:    { label: 'Delayed',     color: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

function OrderTimer({ createdAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = createdAt ? new Date(createdAt) : new Date();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isDelayed = mins >= 15;
  return (
    <span className={`font-mono text-xs font-bold ${isDelayed ? 'text-red-600 animate-pulse' : 'text-muted-foreground'}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

function KDSOrderCard({ order, onStatusChange }) {
  const { t, currency } = useLanguage();
  const statusCfg = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
  const isDelayed = order.created_date && differenceInMinutes(new Date(), new Date(order.created_date)) >= 15;

  const nextStatus = {
    pending: 'preparing',
    preparing: 'ready',
    ready: null,
  };

  return (
    <Card className={`border-2 ${isDelayed ? 'border-red-300 bg-red-50/50' : statusCfg.border} transition-all`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">#{order.id?.slice(-4) || '0001'}</span>
              {order.order_type && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">{order.order_type}</Badge>
              )}
              {isDelayed && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{order.customer_name || t('customer')}</p>
          </div>
          <div className="text-right">
            <Badge className={`${statusCfg.color} text-white text-[10px]`}>{statusCfg.label}</Badge>
            <div className="mt-1 flex items-center gap-1 justify-end">
              <Timer className="w-3 h-3 text-muted-foreground" />
              <OrderTimer createdAt={order.created_date} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1 mb-3">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                {item.quantity || 1}
              </span>
              <span className="font-medium">{item.name || item.product_name}</span>
              {item.notes && <span className="text-muted-foreground italic">({item.notes})</span>}
            </div>
          ))}
          {(!order.items || order.items.length === 0) && (
            <p className="text-xs text-muted-foreground italic">{t('no_data')}</p>
          )}
        </div>

        {/* Action buttons */}
        {nextStatus[order.status] && (
          <Button
            size="sm"
            className={`w-full h-8 text-xs ${
              order.status === 'pending' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
            } text-white`}
            onClick={() => onStatusChange(order.id, nextStatus[order.status])}
          >
            {order.status === 'pending' ? (
              <><Play className="w-3 h-3 mr-1" />{t('preparing_orders')}</>
            ) : (
              <><CheckCircle2 className="w-3 h-3 mr-1" />{t('ready_orders')}</>
            )}
          </Button>
        )}
        {order.status === 'ready' && (
          <div className="flex items-center justify-center gap-1 py-1 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold">{t('ready_orders')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KitchenDisplaySystem() {
  const { t } = useLanguage();
  const { ownerFilter } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState('queue');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['kds_orders', ownerFilter],
    queryFn: () => base44.entities.Order?.filter(ownerFilter || {}, '-created_date', 100) || [],
    staleTime: 15000,
    refetchInterval: autoRefresh ? 15000 : false,
    enabled: !!ownerFilter?.created_by,
  });

  const pendingOrders   = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders     = orders.filter(o => o.status === 'ready');
  const delayedOrders   = orders.filter(o => {
    if (!o.created_date) return false;
    return differenceInMinutes(new Date(), new Date(o.created_date)) >= 15 && o.status !== 'ready';
  });

  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    try {
      await base44.entities.Order?.update(orderId, { status: newStatus });
      qc.invalidateQueries(['kds_orders']);
      if (soundEnabled && newStatus === 'ready') {
        // Play a simple notification sound
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
      toast.success(`Order marked as ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update order status');
    }
  }, [qc, soundEnabled]);

  const stats = {
    total: orders.length,
    pending: pendingOrders.length,
    preparing: preparingOrders.length,
    ready: readyOrders.length,
    delayed: delayedOrders.length,
    avgTime: orders.length > 0
      ? Math.round(orders.filter(o => o.created_date).reduce((s, o) =>
          s + differenceInMinutes(new Date(), new Date(o.created_date)), 0) / orders.length)
      : 0,
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t('kds')}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'HH:mm:ss')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => setSoundEnabled(s => !s)}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => setAutoRefresh(s => !s)}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'text-primary animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t('order_queue'), value: stats.pending,   color: 'bg-blue-100 text-blue-700' },
          { label: t('preparing_orders'), value: stats.preparing, color: 'bg-amber-100 text-amber-700' },
          { label: t('ready_orders'),    value: stats.ready,     color: 'bg-emerald-100 text-emerald-700' },
          { label: t('delayed_orders'),  value: stats.delayed,   color: 'bg-red-100 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[10px] font-medium leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Avg time */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Avg. order time: <strong>{stats.avgTime} min</strong></span>
        {stats.delayed > 0 && (
          <Badge variant="destructive" className="text-[10px] ml-auto">
            <AlertTriangle className="w-3 h-3 mr-1" />{stats.delayed} delayed
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="queue" className="text-xs">
            {t('order_queue')} {pendingOrders.length > 0 && <Badge className="ml-1 h-4 w-4 p-0 text-[9px] bg-blue-500">{pendingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="preparing" className="text-xs">
            {t('preparing_orders')} {preparingOrders.length > 0 && <Badge className="ml-1 h-4 w-4 p-0 text-[9px] bg-amber-500">{preparingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ready" className="text-xs">{t('ready_orders')}</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">{t('kitchen_statistics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_data')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map(order => (
                <KDSOrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preparing" className="mt-3">
          {preparingOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">{t('no_data')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {preparingOrders.map(order => (
                <KDSOrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ready" className="mt-3">
          {readyOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">{t('no_data')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {readyOrders.map(order => (
                <KDSOrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('kitchen_performance')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { label: 'Total Orders Today',    value: stats.total },
                { label: 'Avg. Preparation Time', value: `${stats.avgTime} min` },
                { label: 'Delayed Orders',        value: stats.delayed, warn: stats.delayed > 0 },
                { label: 'Completion Rate',       value: stats.total > 0 ? `${Math.round((stats.ready / stats.total) * 100)}%` : '0%' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-bold ${row.warn ? 'text-red-500' : 'text-foreground'}`}>{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
