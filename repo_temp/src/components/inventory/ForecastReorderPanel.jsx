import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, Package, ShoppingCart, Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatDate } from '@/lib/helpers';
import { addDays } from 'date-fns';

// Generates reorder suggestions from forecast rows
export default function ForecastReorderPanel({ forecast, onCreateOrder }) {
  const { t, currency } = useLanguage();

  const reorderItems = useMemo(() =>
    forecast
      .filter(r => r.needsReorder)
      .map(r => {
        const reorderQty = Math.ceil(r.avgDaily * 14); // 2-week buffer
        const reorderDate = r.daysLeft !== null && r.daysLeft > 0
          ? formatDate(addDays(new Date(), Math.max(0, r.daysLeft - 2)))
          : formatDate(new Date());
        const urgency = r.daysLeft !== null && r.daysLeft <= 1 ? 'critical' : r.daysLeft <= 3 ? 'high' : 'medium';
        return { ...r, reorderQty, reorderDate, urgency };
      })
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2 };
        return order[a.urgency] - order[b.urgency];
      }), [forecast]);

  if (reorderItems.length === 0) return null;

  const urgencyConfig = {
    critical: { label: 'CRITICAL', color: 'text-red-700', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700 border-red-200' },
    high:     { label: 'URGENT',   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    medium:   { label: 'ORDER',    color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  return (
    <Card className="p-4 border-orange-200 bg-orange-50/40">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-4 h-4 text-orange-600" />
        <h3 className="text-sm font-semibold text-orange-800">{t('reorder_suggested')} ({reorderItems.length})</h3>
      </div>

      <div className="space-y-2">
        {reorderItems.map((item, i) => {
          const cfg = urgencyConfig[item.urgency];
          return (
            <div key={i} className={`rounded-lg border p-3 ${cfg.bg}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{item.product_name}</span>
                    <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground">{item.branch}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t('days_of_stock')}</p>
                      <p className={`font-bold ${cfg.color}`}>{item.daysLeft ?? '—'} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('avg_consumption')}</p>
                      <p className="font-semibold">{item.avgDaily} {item.unit}/day</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('reorder_suggested')}</p>
                      <p className="font-bold text-primary">{item.reorderQty} {item.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Order by: <span className="font-semibold text-foreground">{item.reorderDate}</span></span>
                  </div>
                </div>
              </div>

              {/* Depletion progress bar */}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>{t('opening_stock')}: {item.currentStock} {item.unit}</span>
                  <span>{t('days_of_stock')}: {item.daysLeft ?? '?'}</span>
                </div>
                <div className="w-full bg-white/60 rounded-full h-2 border">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, item.daysLeft !== null ? Math.min((item.daysLeft / 14) * 100, 100) : 0)}%`,
                      background: item.urgency === 'critical' ? '#ef4444' : item.urgency === 'high' ? '#f97316' : '#f59e0b',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onCreateOrder && (
        <Button
          size="sm"
          className="w-full mt-3"
          onClick={() => onCreateOrder(reorderItems)}
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
          Create Purchase Order for All
        </Button>
      )}
    </Card>
  );
}