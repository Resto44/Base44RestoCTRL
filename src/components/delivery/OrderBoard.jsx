import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, CheckCircle2, MapPin, Phone } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_FLOW = {
  pending:          { label: 'Pending',          color: 'bg-slate-100 text-slate-700 border-slate-200',  next: 'preparing',        nextLabel: 'Start Prep' },
  preparing:        { label: 'Preparing',        color: 'bg-amber-100 text-amber-700 border-amber-200',  next: 'ready',            nextLabel: 'Mark Ready' },
  ready:            { label: 'Ready',            color: 'bg-blue-100 text-blue-700 border-blue-200',     next: 'out_for_delivery', nextLabel: 'Dispatch' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-100 text-purple-700 border-purple-200', next: 'delivered',        nextLabel: 'Mark Delivered' },
  delivered:        { label: 'Delivered',        color: 'bg-green-100 text-green-700 border-green-200',  next: null,               nextLabel: null },
  cancelled:        { label: 'Cancelled',        color: 'bg-red-100 text-red-700 border-red-200',        next: null,               nextLabel: null },
};

const PAYMENT_COLORS = { cash: 'bg-green-100 text-green-700', network: 'bg-blue-100 text-blue-700', credit: 'bg-orange-100 text-orange-700' };

function OrderCard({ order, onUpdate, loading }) {
  const cfg = STATUS_FLOW[order.status] || STATUS_FLOW.pending;
  const items = (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })();
  const [confirming, setConfirming] = useState(false);

  const advance = () => {
    if (order.status === 'out_for_delivery') {
      // Mark as delivered AND collected
      onUpdate(order.id, { status: 'delivered', payment_collected: true, delivered_at: new Date().toISOString() });
    } else {
      onUpdate(order.id, { status: cfg.next });
    }
    setConfirming(false);
  };

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${order.status === 'pending' ? 'bg-slate-400' : order.status === 'preparing' ? 'bg-amber-400' : order.status === 'ready' ? 'bg-blue-400' : order.status === 'out_for_delivery' ? 'bg-purple-400' : order.status === 'delivered' ? 'bg-green-400' : 'bg-red-400'}`} />
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm">{order.order_number}</span>
              <Badge className={`text-[10px] border ${cfg.color}`}>{cfg.label}</Badge>
              <Badge className={`text-[10px] ${PAYMENT_COLORS[order.payment_method]}`}>{order.payment_method}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Truck className="w-3 h-3" />{order.driver_name}
              {order.created_date && <span>· {format(new Date(order.created_date), 'HH:mm')}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-primary">{order.total_amount?.toFixed(2)} SAR</div>
            {order.payment_collected && <div className="text-[10px] text-green-600 flex items-center gap-0.5 justify-end"><CheckCircle2 className="w-3 h-3" />Collected</div>}
          </div>
        </div>

        {/* Customer */}
        {(order.customer_name || order.customer_phone) && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {order.customer_name && <span className="font-medium text-foreground">{order.customer_name}</span>}
            {order.customer_phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{order.customer_phone}</span>}
            {order.customer_address && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3" />{order.customer_address}</span>}
          </div>
        )}

        {/* Items */}
        <div className="text-xs text-muted-foreground">
          {items.map((i, idx) => <span key={idx}>{i.qty}× {i.name}{idx < items.length - 1 ? ', ' : ''}</span>)}
        </div>

        {/* Actions */}
        {cfg.next && !confirming && (
          <Button size="sm" className="w-full h-8 text-xs" onClick={() => setConfirming(true)} disabled={loading}>
            {cfg.nextLabel}
          </Button>
        )}
        {confirming && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={advance}>Confirm</Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        )}
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <Button size="sm" variant="ghost" className="w-full h-6 text-xs text-destructive" onClick={() => onUpdate(order.id, { status: 'cancelled' })}>
            Cancel Order
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderBoard({ orders, drivers, onUpdateOrder, loading }) {
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterDriver, setFilterDriver] = useState('all');

  const filtered = orders.filter(o => {
    const statusMatch = filterStatus === 'active'
      ? !['delivered', 'cancelled'].includes(o.status)
      : filterStatus === 'all' || o.status === filterStatus;
    const driverMatch = filterDriver === 'all' || o.driver_id === filterDriver;
    return statusMatch && driverMatch;
  });

  // Group by status for kanban
  const columns = ['pending', 'preparing', 'ready', 'out_for_delivery'];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['active', 'all', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <select className="ml-auto text-xs border rounded px-2 py-1 bg-background"
          value={filterDriver} onChange={e => setFilterDriver(e.target.value)}>
          <option value="all">All Drivers</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map(order => (
          <OrderCard key={order.id} order={order} onUpdate={onUpdateOrder} loading={loading} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No orders found</p>
        </div>
      )}
    </div>
  );
}

function ShoppingBag({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}