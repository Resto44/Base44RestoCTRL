import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChefHat, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

function getElapsedMinutes(createdDate) {
  if (!createdDate) return 0;
  return Math.floor((Date.now() - new Date(createdDate).getTime()) / 60000);
}

function KitchenTicket({ order, onUpdate }) {
  const [now, setNow] = useState(new Date());
  const items = (() => { try { return JSON.parse(order.items_json || '[]'); } catch { return []; } })();
  const elapsed = getElapsedMinutes(order.created_date);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const urgency = elapsed > 20 ? 'urgent' : elapsed > 10 ? 'warning' : 'normal';

  return (
    <Card className={`overflow-hidden transition-all ${urgency === 'urgent' ? 'border-red-400 shadow-red-100 shadow-md' : urgency === 'warning' ? 'border-amber-400' : 'border-border'}`}>
      <div className={`h-1.5 ${urgency === 'urgent' ? 'bg-red-500' : urgency === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-bold">{order.order_number}</CardTitle>
            <div className="text-xs text-muted-foreground">{order.driver_name}</div>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 text-xs font-semibold ${urgency === 'urgent' ? 'text-red-600' : urgency === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {urgency === 'urgent' && <AlertCircle className="w-3.5 h-3.5" />}
              <Clock className="w-3.5 h-3.5" />{elapsed}m
            </div>
            <Badge className={`text-[10px] mt-0.5 ${order.status === 'preparing' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {order.status === 'preparing' ? 'Preparing' : 'Pending'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {/* Items */}
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
                {item.qty}
              </span>
              <span className="text-sm font-medium">{item.name}</span>
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
            📝 {order.notes}
          </div>
        )}
        {order.customer_address && (
          <div className="text-xs text-muted-foreground">📍 {order.customer_address}</div>
        )}
        {/* Actions */}
        {order.status === 'pending' && (
          <Button size="sm" className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600"
            onClick={() => onUpdate(order.id, { status: 'preparing' })}>
            <ChefHat className="w-3.5 h-3.5 mr-1" /> Start Preparing
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button size="sm" className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={() => onUpdate(order.id, { status: 'ready' })}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Ready
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function KitchenDisplay({ orders, onUpdateOrder }) {
  const kitchenOrders = orders
    .filter(o => ['pending', 'preparing'].includes(o.status))
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  const pending = kitchenOrders.filter(o => o.status === 'pending');
  const preparing = kitchenOrders.filter(o => o.status === 'preparing');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <ChefHat className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Preparing: {preparing.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Pending: {pending.length}</span>
        </div>
      </div>

      {kitchenOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No active kitchen orders</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kitchenOrders.map(order => (
            <KitchenTicket key={order.id} order={order} onUpdate={onUpdateOrder} />
          ))}
        </div>
      )}
    </div>
  );
}