import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bike, Package, Banknote, CreditCard } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const LABELS = {
  en: { title: 'Delivery Summary', cash: 'Driver Cash', network: 'Driver Network', orders: 'Orders', auto: 'Auto-calculated from delivery orders', loading: 'Loading delivery data…', none: 'No delivery orders today' },
  ar: { title: 'ملخص التوصيل', cash: 'نقد السائق', network: 'شبكة السائق', orders: 'الطلبات', auto: 'محسوب تلقائياً من طلبات التوصيل', loading: 'جارٍ التحميل…', none: 'لا توجد طلبات توصيل اليوم' },
  fa: { title: 'خلاصه تحویل', cash: 'نقد راننده', network: 'شبکه راننده', orders: 'سفارشات', auto: 'محاسبه خودکار از سفارشات تحویل', loading: 'در حال بارگذاری…', none: 'هیچ سفارش تحویلی امروز نیست' },
};

export default function DeliverySummaryPanel({ branch, date }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['delivery_summary', branch, date],
    queryFn: () => base44.entities.DeliveryOrder.filter({ branch, status: 'delivered' }),
    enabled: !!branch && !!date,
    staleTime: 30000,
  });

  // Filter to the specific date
  const dayOrders = orders.filter(o => {
    if (!o.delivered_at) return false;
    return o.delivered_at.slice(0, 10) === date;
  });

  const driverCash = dayOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
  const driverNetwork = dayOrders.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);
  const orderCount = dayOrders.length;
  const hasData = orderCount > 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border p-3 bg-orange-50/40">
        <p className="text-xs text-muted-foreground text-center">{lbl.loading}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-100/60">
        <Bike className="w-4 h-4 text-orange-600" />
        <span className="text-sm font-semibold text-orange-800">{lbl.title}</span>
        <span className="ms-auto text-[10px] text-orange-600 italic">{lbl.auto}</span>
      </div>

      {!hasData ? (
        <p className="text-xs text-muted-foreground text-center py-3">{lbl.none}</p>
      ) : (
        <div className="p-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/70 rounded-lg p-2">
            <Banknote className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{lbl.cash}</p>
            <p className="text-sm font-bold text-emerald-700">{currency}{driverCash.toLocaleString()}</p>
          </div>
          <div className="bg-white/70 rounded-lg p-2">
            <CreditCard className="w-3.5 h-3.5 text-blue-600 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{lbl.network}</p>
            <p className="text-sm font-bold text-blue-700">{currency}{driverNetwork.toLocaleString()}</p>
          </div>
          <div className="bg-white/70 rounded-lg p-2">
            <Package className="w-3.5 h-3.5 text-orange-600 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{lbl.orders}</p>
            <p className="text-sm font-bold text-orange-700">{orderCount}</p>
          </div>
        </div>
      )}
    </div>
  );
}