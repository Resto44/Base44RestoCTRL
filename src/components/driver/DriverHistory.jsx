import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, MapPin, Banknote, CreditCard, Package } from 'lucide-react';

const STATUS_COLOR = {
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
};

export default function DriverHistory({ driver }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders-history', driver?.id],
    queryFn: () => driver?.id
      ? base44.entities.DeliveryOrder.filter({ driver_id: driver.id }, '-created_date', 100)
      : [],
    enabled: !!driver?.id,
  });

  const completedOrders = orders.filter(o => o.status === 'delivered');
  const totalEarnings = completedOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const cashEarnings = completedOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
  const networkEarnings = completedOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xl font-black text-green-700">{completedOrders.length}</p>
          <p className="text-xs text-green-600">Delivered</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3">
          <p className="text-lg font-black text-emerald-700">{cashEarnings.toFixed(0)}</p>
          <p className="text-xs text-emerald-600">Cash SAR</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-lg font-black text-blue-700">{networkEarnings.toFixed(0)}</p>
          <p className="text-xs text-blue-600">Network SAR</p>
        </div>
      </div>

      {/* Orders list */}
      {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Loading history…</p>}
      {!isLoading && orders.length === 0 && (
        <div className="text-center py-10">
          <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No delivery history yet</p>
        </div>
      )}
      <div className="space-y-2">
        {orders.map(o => {
          const PayIcon = o.payment_method === 'network' ? CreditCard : Banknote;
          const statusColor = STATUS_COLOR[o.status] || 'bg-slate-100 text-slate-600';
          return (
            <Card key={o.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${statusColor}`}>
                  {o.status === 'delivered' ? <CheckCircle2 className="w-4 h-4" /> :
                   o.status === 'cancelled' ? <XCircle className="w-4 h-4" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{o.order_number || `#${o.id?.slice(-4)}`}</span>
                    <Badge className={`text-[10px] border ${statusColor}`}>{o.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{o.customer_name}</div>
                  {o.customer_address && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />{o.customer_address}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <PayIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    {(o.total_amount || 0).toFixed(0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {o.created_date ? new Date(o.created_date).toLocaleDateString() : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}