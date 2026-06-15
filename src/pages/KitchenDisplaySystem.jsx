import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChefHat, Clock, CheckCircle2, AlertTriangle, Zap, BarChart3,
  Bell, RefreshCw, Play, Pause, Volume2, VolumeX, Timer, Flame,
  Package, Truck, Star, Shield, ArrowRight, MessageSquare, Plus
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

// ── Kitchen status pipeline ───────────────────────────────────────────────────
const KDS_STATUSES = {
  pending:    { label_en: 'New Order',   label_ar: 'طلب جديد',       label_fa: 'سفارش جدید',      color: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  preparing:  { label_en: 'Preparing',   label_ar: 'جاري التحضير',   label_fa: 'در حال آماده‌سازی', color: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  cooking:    { label_en: 'Cooking',     label_ar: 'جاري الطهي',     label_fa: 'در حال پخت',       color: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  ready:      { label_en: 'Ready',       label_ar: 'جاهز',           label_fa: 'آماده',            color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  completed:  { label_en: 'Completed',   label_ar: 'مكتمل',          label_fa: 'تکمیل شد',         color: 'bg-slate-500',   text: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const PRIORITY_CONFIG = {
  Normal:  { color: 'bg-slate-100 text-slate-600',   icon: null },
  Urgent:  { color: 'bg-red-100 text-red-600',       icon: AlertTriangle },
  VIP:     { color: 'bg-yellow-100 text-yellow-700', icon: Star },
};

const NEXT_STATUS = {
  pending: 'preparing',
  preparing: 'cooking',
  cooking: 'ready',
  ready: 'completed',
};

const DRIVER_REQUEST_TYPES = [
  { id: 'extra_sauce',  label_en: 'Extra Sauce',   label_ar: 'صوص إضافي',     label_fa: 'سس اضافه' },
  { id: 'extra_bread',  label_en: 'Extra Bread',   label_ar: 'خبز إضافي',     label_fa: 'نان اضافه' },
  { id: 'extra_rice',   label_en: 'Extra Rice',    label_ar: 'أرز إضافي',     label_fa: 'برنج اضافه' },
  { id: 'packaging',    label_en: 'Packaging',     label_ar: 'تغليف',          label_fa: 'بسته‌بندی' },
  { id: 'missing_item', label_en: 'Missing Item',  label_ar: 'عنصر مفقود',    label_fa: 'آیتم گم‌شده' },
];

// ── Order Timer ───────────────────────────────────────────────────────────────
function OrderTimer({ createdAt, targetMinutes = 20 }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = createdAt ? new Date(createdAt) : new Date();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start.getTime()) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [createdAt]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = Math.min(100, (mins / targetMinutes) * 100);
  const isDelayed = mins >= targetMinutes;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
            className={isDelayed ? 'text-red-500' : 'text-primary'}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Timer className={`w-3 h-3 ${isDelayed ? 'text-red-500' : 'text-muted-foreground'}`} />
        </div>
      </div>
      <span className={`font-mono text-xs font-bold ${isDelayed ? 'text-red-600 animate-pulse' : 'text-muted-foreground'}`}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}

// ── KDS Order Card ────────────────────────────────────────────────────────────
function KDSOrderCard({ order, onStatusChange, driverRequests, lang }) {
  const { t } = useLanguage();
  const statusCfg = KDS_STATUSES[order.kitchen_status || order.status] || KDS_STATUSES.pending;
  const priorityCfg = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.Normal;
  const PriorityIcon = priorityCfg.icon;
  const isDelayed = order.created_date && differenceInMinutes(new Date(), new Date(order.created_date)) >= 20;
  const nextStatus = NEXT_STATUS[order.kitchen_status || order.status];
  const pendingRequests = driverRequests.filter(r => r.order_id === order.id && r.status === 'pending');

  const statusLabel = (s) => {
    const cfg = KDS_STATUSES[s];
    if (!cfg) return s;
    if (lang === 'ar') return cfg.label_ar;
    if (lang === 'fa') return cfg.label_fa;
    return cfg.label_en;
  };

  return (
    <Card className={`border-2 ${isDelayed ? 'border-red-300 bg-red-50/30' : statusCfg.border} transition-all`}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black">#{order.id?.slice(-4)?.toUpperCase() || '0001'}</span>
              {order.order_type && <Badge variant="outline" className="text-[10px] h-4 px-1">{order.order_type}</Badge>}
              {order.priority && order.priority !== 'Normal' && (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${priorityCfg.color}`}>
                  {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5" />}
                  {order.priority}
                </span>
              )}
              {isDelayed && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name || t('customer')}</p>
          </div>
          <div className="text-right shrink-0">
            <Badge className={`${statusCfg.color} text-white text-[10px]`}>{statusLabel(order.kitchen_status || order.status)}</Badge>
            <div className="mt-1">
              <OrderTimer createdAt={order.created_date} />
            </div>
          </div>
        </div>

        {/* Driver Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-[10px] font-bold text-orange-700 mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Driver Requests ({pendingRequests.length})
            </p>
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between text-xs">
                <span className="text-orange-700">{DRIVER_REQUEST_TYPES.find(t => t.id === req.request_type)?.[`label_${lang}`] || req.request_type}</span>
                <button onClick={() => onStatusChange(req.id, 'fulfilled', 'request')}
                  className="text-[10px] text-emerald-600 font-bold underline">Done</button>
              </div>
            ))}
          </div>
        )}

        {/* Items */}
        <div className="space-y-1 mb-3">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                {item.quantity || 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{item.name || item.product_name}</span>
                {item.modifiers_json?.length > 0 && (
                  <p className="text-muted-foreground text-[10px]">
                    {item.modifiers_json.flatMap(m => m.options?.map(o => o[`name_${lang}`] || o.name_en) || []).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-muted-foreground italic text-[10px]">"{item.notes}"</p>}
              </div>
            </div>
          ))}
          {(!order.items || order.items.length === 0) && (
            <p className="text-xs text-muted-foreground italic">{t('no_data')}</p>
          )}
        </div>

        {/* Action Button */}
        {nextStatus && (
          <Button
            size="sm"
            className={`w-full h-9 text-xs font-bold ${
              nextStatus === 'preparing' ? 'bg-amber-500 hover:bg-amber-600' :
              nextStatus === 'cooking'   ? 'bg-orange-500 hover:bg-orange-600' :
              nextStatus === 'ready'     ? 'bg-emerald-500 hover:bg-emerald-600' :
              'bg-slate-500 hover:bg-slate-600'
            } text-white`}
            onClick={() => onStatusChange(order.id, nextStatus, 'order')}
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            {t('mark_as') || 'Mark as'} {statusLabel(nextStatus)}
          </Button>
        )}
        {(order.kitchen_status === 'completed' || order.status === 'completed') && (
          <div className="flex items-center justify-center gap-1 py-1.5 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold">{t('completed') || 'Completed'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KitchenDisplaySystem() {
  const { t, lang } = useLanguage();
  const { ownerFilter } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: rawOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['kds_orders', ownerFilter],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter(ownerFilter || {}, '-created_date', 100);
      // Load items for each order
      for (const order of orders) {
        try {
          order.items = await base44.entities.OrderItem.filter({ order_id: order.id }, 'created_date', 20);
        } catch { order.items = []; }
      }
      return orders;
    },
    staleTime: 10000,
    refetchInterval: autoRefresh ? 10000 : false,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: driverRequests = [] } = useQuery({
    queryKey: ['driver_requests_kds', ownerFilter],
    queryFn: () => base44.entities.DriverRequest.filter({ status: 'pending' }, '-created_at', 50),
    refetchInterval: autoRefresh ? 10000 : false,
    enabled: !!ownerFilter?.created_by,
  });

  const pendingOrders   = rawOrders.filter(o => (o.kitchen_status || o.status) === 'pending');
  const preparingOrders = rawOrders.filter(o => (o.kitchen_status || o.status) === 'preparing');
  const cookingOrders   = rawOrders.filter(o => (o.kitchen_status || o.status) === 'cooking');
  const readyOrders     = rawOrders.filter(o => (o.kitchen_status || o.status) === 'ready');
  const completedOrders = rawOrders.filter(o => (o.kitchen_status || o.status) === 'completed');
  const delayedOrders   = rawOrders.filter(o => {
    if (!o.created_date) return false;
    const ks = o.kitchen_status || o.status;
    return differenceInMinutes(new Date(), new Date(o.created_date)) >= 20 && ks !== 'ready' && ks !== 'completed';
  });

  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, [soundEnabled]);

  const handleStatusChange = useCallback(async (id, newStatus, type) => {
    try {
      if (type === 'order') {
        await base44.entities.Order.update(id, { kitchen_status: newStatus, status: newStatus === 'ready' ? 'ready' : undefined });
        if (newStatus === 'ready') {
          playSound();
          toast.success('Order ready — notifying driver queue');
        } else {
          toast.success(`Order → ${newStatus}`);
        }
      } else if (type === 'request') {
        await base44.entities.DriverRequest.update(id, { status: 'fulfilled' });
        toast.success('Driver request fulfilled');
      }
      qc.invalidateQueries(['kds_orders']);
      qc.invalidateQueries(['driver_requests_kds']);
    } catch (e) {
      toast.error('Failed to update status');
    }
  }, [qc, playSound]);

  const stats = {
    total: rawOrders.length,
    pending: pendingOrders.length,
    preparing: preparingOrders.length,
    cooking: cookingOrders.length,
    ready: readyOrders.length,
    completed: completedOrders.length,
    delayed: delayedOrders.length,
    driverRequests: driverRequests.length,
    avgTime: rawOrders.filter(o => o.created_date).length > 0
      ? Math.round(rawOrders.filter(o => o.created_date).reduce((s, o) => s + differenceInMinutes(new Date(), new Date(o.created_date)), 0) / rawOrders.filter(o => o.created_date).length)
      : 0,
  };

  const OrderList = ({ orders }) => {
    if (isLoading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    if (orders.length === 0) return (
      <div className="text-center py-10 text-muted-foreground">
        <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">{t('no_data')}</p>
      </div>
    );
    return (
      <div className="space-y-3">
        {orders.map(order => (
          <KDSOrderCard key={order.id} order={order} onStatusChange={handleStatusChange} driverRequests={driverRequests} lang={lang} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t('kds') || 'Kitchen Display'}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'HH:mm:ss')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {driverRequests.length > 0 && (
            <Badge className="bg-orange-500 text-white text-xs animate-pulse">
              <MessageSquare className="w-3 h-3 mr-1" />{driverRequests.length}
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setSoundEnabled(s => !s)}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { setAutoRefresh(s => !s); refetch(); }}>
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'text-primary' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t('new') || 'New',        value: stats.pending,   color: 'bg-blue-100 text-blue-700' },
          { label: t('preparing') || 'Prep', value: stats.preparing, color: 'bg-amber-100 text-amber-700' },
          { label: t('cooking') || 'Cook',   value: stats.cooking,   color: 'bg-orange-100 text-orange-700' },
          { label: t('ready') || 'Ready',    value: stats.ready,     color: 'bg-emerald-100 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2 text-center ${s.color}`}>
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-[10px] font-semibold leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Avg time + delayed */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t('avg_time') || 'Avg'}: <strong>{stats.avgTime} min</strong></span>
        {stats.delayed > 0 && (
          <Badge variant="destructive" className="text-[10px] ms-auto">
            <AlertTriangle className="w-3 h-3 mr-1" />{stats.delayed} {t('delayed') || 'delayed'}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-5 h-9">
          <TabsTrigger value="pending" className="text-[10px] relative">
            {t('new') || 'New'}
            {stats.pending > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{stats.pending}</span>}
          </TabsTrigger>
          <TabsTrigger value="preparing" className="text-[10px] relative">
            {t('prep') || 'Prep'}
            {stats.preparing > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{stats.preparing}</span>}
          </TabsTrigger>
          <TabsTrigger value="cooking" className="text-[10px] relative">
            {t('cook') || 'Cook'}
            {stats.cooking > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{stats.cooking}</span>}
          </TabsTrigger>
          <TabsTrigger value="ready" className="text-[10px]">{t('ready') || 'Ready'}</TabsTrigger>
          <TabsTrigger value="stats" className="text-[10px]"><BarChart3 className="w-3 h-3" /></TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3"><OrderList orders={pendingOrders} /></TabsContent>
        <TabsContent value="preparing" className="mt-3"><OrderList orders={preparingOrders} /></TabsContent>
        <TabsContent value="cooking" className="mt-3"><OrderList orders={cookingOrders} /></TabsContent>
        <TabsContent value="ready" className="mt-3"><OrderList orders={readyOrders} /></TabsContent>

        <TabsContent value="stats" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold">{t('kitchen_performance') || 'Kitchen Performance'}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: t('total_orders_today') || 'Total Orders Today', value: stats.total },
                { label: t('avg_preparation_time') || 'Avg. Prep Time',   value: `${stats.avgTime} min` },
                { label: t('delayed_orders') || 'Delayed Orders',         value: stats.delayed, warn: stats.delayed > 0 },
                { label: t('ready_orders') || 'Ready Orders',             value: stats.ready },
                { label: t('completed_orders') || 'Completed',            value: stats.completed },
                { label: t('driver_requests') || 'Driver Requests',       value: stats.driverRequests, warn: stats.driverRequests > 0 },
                { label: t('completion_rate') || 'Completion Rate',       value: stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-bold ${row.warn ? 'text-red-500' : ''}`}>{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
