import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Package, Banknote, CreditCard, ChevronDown, ChevronUp, CheckCircle2, Truck, Clock, Navigation } from 'lucide-react';
import { DriverLocationMap } from '@/components/driver/DriverLocationMap';

const STATUS_FLOW = {
  pending:         { label: 'New Order',       color: 'bg-amber-100 text-amber-700', next: 'preparing',        nextLabel: 'Accept & Prepare' },
  preparing:       { label: 'Preparing',       color: 'bg-blue-100 text-blue-700',   next: 'ready',            nextLabel: 'Mark Ready' },
  ready:           { label: 'Ready',           color: 'bg-purple-100 text-purple-700', next: 'out_for_delivery', nextLabel: '🛵 Start Delivery' },
  out_for_delivery:{ label: 'Out for Delivery',color: 'bg-orange-100 text-orange-700', next: 'delivered',       nextLabel: '✅ Mark Delivered' },
  delivered:       { label: 'Delivered',       color: 'bg-green-100 text-green-700', next: null,               nextLabel: null },
  cancelled:       { label: 'Cancelled',       color: 'bg-red-100 text-red-700',     next: null,               nextLabel: null },
};

const PAY_ICON = { cash: Banknote, network: CreditCard, credit: CreditCard };
const PAY_COLOR = { cash: 'text-emerald-600', network: 'text-blue-600', credit: 'text-purple-600' };

export default function DriverOrderCard({ order, onUpdateStatus, isUpdating, driverPosition }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_FLOW[order.status] || STATUS_FLOW.pending;
  const PayIcon = PAY_ICON[order.payment_method] || Banknote;

  const items = (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })();

  return (
    <Card className={`border-l-4 shadow-sm ${order.status === 'pending' ? 'border-l-amber-400 animate-pulse-slow' : order.status === 'delivered' ? 'border-l-green-400' : 'border-l-primary'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">{order.order_number || `#${order.id?.slice(-4)}`}</span>
              <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Clock className="w-3 h-3" />
              {order.created_date ? new Date(order.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 font-bold text-lg text-primary">
              <PayIcon className={`w-4 h-4 ${PAY_COLOR[order.payment_method]}`} />
              {(order.total_amount || 0).toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">SAR</div>
          </div>
        </div>

        {/* Customer */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{order.customer_name || 'Customer'}</span>
          </div>
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-sm text-primary">
              <Phone className="w-4 h-4 shrink-0" />
              <span>{order.customer_phone}</span>
            </a>
          )}
          {order.customer_address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0 text-red-500" />
              <span className="line-clamp-1">{order.customer_address}</span>
            </a>
          )}
        </div>

        {/* Items toggle */}
        {items.length > 0 && (
          <button className="flex items-center gap-1 text-xs text-muted-foreground w-full"
            onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {items.length} item{items.length !== 1 ? 's' : ''} {expanded ? '(hide)' : '(show)'}
          </button>
        )}

        {expanded && (
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span>{it.qty}x {it.name}</span>
                <span className="font-medium">{(it.total || 0).toFixed(0)} SAR</span>
              </div>
            ))}
          </div>
        )}

        {order.notes && (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800">
            📝 {order.notes}
          </div>
        )}

        {/* Live map when out for delivery */}
        {order.status === 'out_for_delivery' && (driverPosition || order.customer_address) && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-blue-500" /> Live Navigation
            </p>
            <DriverLocationMap order={order} driverPosition={driverPosition} />
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address || '')}`}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-blue-600 font-medium py-1"
            >
              <Navigation className="w-3.5 h-3.5" /> Open in Google Maps
            </a>
          </div>
        )}

        {/* CTA */}
        {cfg.next && (
          <Button className="w-full h-12 text-sm font-bold rounded-xl"
            onClick={() => onUpdateStatus(order.id, cfg.next)}
            disabled={isUpdating}>
            {cfg.next === 'out_for_delivery' && <Truck className="w-4 h-4 mr-2" />}
            {cfg.next === 'delivered' && <CheckCircle2 className="w-4 h-4 mr-2" />}
            {cfg.nextLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}