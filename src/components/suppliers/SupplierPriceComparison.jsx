import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/helpers';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export default function SupplierPriceComparison({ supplier }) {
  const { currency } = useLanguage();

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-date', 500),
  });

  // Build price history per product from this supplier's POs
  const priceHistory = useMemo(() => {
    const orders = purchaseOrders.filter(po => po.supplier_id === supplier.id && po.status !== 'cancelled');
    const productMap = {}; // productName -> [{date, price}]

    orders.forEach(po => {
      const items = (() => { try { return JSON.parse(po.items || '[]'); } catch { return []; } })();
      items.forEach(item => {
        if (!item.unit_price || item.unit_price === 0) return;
        const name = item.product_name || item.product_id;
        if (!productMap[name]) productMap[name] = [];
        productMap[name].push({ date: po.date, price: item.unit_price });
      });
    });

    // Only products with 2+ data points
    return Object.entries(productMap)
      .filter(([, pts]) => pts.length >= 2)
      .map(([name, pts]) => {
        const sorted = pts.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0].price;
        const last = sorted[sorted.length - 1].price;
        const changePct = first > 0 ? ((last - first) / first * 100) : 0;
        return { name, pts: sorted, first, last, changePct };
      })
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [purchaseOrders, supplier.id]);

  // Chart data: unified timeline across all products
  const chartData = useMemo(() => {
    if (priceHistory.length === 0) return [];
    const allDates = [...new Set(priceHistory.flatMap(p => p.pts.map(x => x.date)))].sort();
    return allDates.map(date => {
      const row = { date };
      priceHistory.forEach(p => {
        // Find most recent price on or before this date
        const relevant = p.pts.filter(x => x.date <= date);
        if (relevant.length > 0) row[p.name] = relevant[relevant.length - 1].price;
      });
      return row;
    });
  }, [priceHistory]);

  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];

  if (priceHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Not enough data yet. Price comparison requires at least 2 purchase orders with priced items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Price Change Summary</h3>
        {priceHistory.map((p, i) => (
          <Card key={p.name} className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(p.first, currency)} → {formatCurrency(p.last, currency)} ({p.pts.length} orders)
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {p.changePct > 1 ? (
                <TrendingUp className="w-4 h-4 text-red-500" />
              ) : p.changePct < -1 ? (
                <TrendingDown className="w-4 h-4 text-emerald-500" />
              ) : (
                <Minus className="w-4 h-4 text-muted-foreground" />
              )}
              <Badge
                className={
                  p.changePct > 5 ? 'bg-red-100 text-red-700 border-red-200' :
                  p.changePct < -5 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  'bg-secondary text-secondary-foreground'
                }
              >
                {p.changePct > 0 ? '+' : ''}{p.changePct.toFixed(1)}%
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Line chart */}
      {chartData.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Price Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v, currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {priceHistory.map((p, i) => (
                <Line
                  key={p.name}
                  type="monotone"
                  dataKey={p.name}
                  stroke={COLORS[i % COLORS.length]}
                  dot={{ r: 3 }}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}