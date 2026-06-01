import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { subDays, format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Search, Package } from 'lucide-react';

const SPIKE_THRESHOLD = 0.05; // 5%
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function SupplierPriceTracker() {
  const { currency } = useLanguage();
  const [search, setSearch] = useState('');

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => base44.entities.Purchase.list('-date', 5000),
    staleTime: 120000,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-date', 500),
  });

  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const fmt = v => formatCurrency(v, currency);

  // Build price history per product, grouping by supplier (via purchase orders where possible)
  const productPriceHistory = useMemo(() => {
    const map = {}; // productName -> [ { date, price, supplier } ]

    // From direct purchases with prices
    purchases.filter(p => p.used_price || p.current_price).forEach(p => {
      const name = p.product_name;
      if (!name) return;
      if (!map[name]) map[name] = [];
      map[name].push({
        date: p.date,
        price: p.used_price || p.current_price,
        supplier: p.branch || 'Direct',
        source: 'purchase',
      });
    });

    // From purchase order line items
    purchaseOrders.forEach(po => {
      if (!po.items) return;
      try {
        const items = JSON.parse(po.items);
        const supplierName = po.supplier_name || suppliers.find(s => s.id === po.supplier_id)?.name || 'Unknown';
        items.forEach(item => {
          if (!item.product_name || !item.unit_price) return;
          if (!map[item.product_name]) map[item.product_name] = [];
          map[item.product_name].push({
            date: po.date,
            price: item.unit_price,
            supplier: supplierName,
            source: 'po',
          });
        });
      } catch {}
    });

    return map;
  }, [purchases, purchaseOrders, suppliers]);

  // Compute analytics per product
  const productAnalytics = useMemo(() => {
    return Object.entries(productPriceHistory).map(([product, history]) => {
      const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
      const recent30 = sorted.filter(h => h.date >= thirtyDaysAgo);
      const prior30 = sorted.filter(h => h.date < thirtyDaysAgo).slice(-20);

      // Average per supplier
      const supplierAverages = {};
      sorted.forEach(h => {
        if (!supplierAverages[h.supplier]) supplierAverages[h.supplier] = { total: 0, count: 0, latest: null, dates: [] };
        supplierAverages[h.supplier].total += h.price;
        supplierAverages[h.supplier].count += 1;
        if (!supplierAverages[h.supplier].latest || h.date > supplierAverages[h.supplier].latest.date) {
          supplierAverages[h.supplier].latest = h;
        }
        supplierAverages[h.supplier].dates.push(h.date);
      });

      // Overall 30-day average
      const avg30 = recent30.length > 0
        ? recent30.reduce((s, h) => s + h.price, 0) / recent30.length
        : null;

      // Detect price spikes: latest price vs 30d avg
      const latestEntry = sorted[sorted.length - 1];
      const latestPrice = latestEntry?.price || 0;
      const spikeDetected = avg30 && latestPrice > avg30 * (1 + SPIKE_THRESHOLD);
      const spikePct = avg30 ? ((latestPrice - avg30) / avg30) * 100 : 0;

      // Best price (cheapest supplier with recent data)
      const supplierList = Object.entries(supplierAverages).map(([name, d]) => ({
        name,
        avg: d.total / d.count,
        latest: d.latest?.price,
        lastDate: d.latest?.date,
      })).filter(s => s.latest);

      const bestSupplier = supplierList.reduce((best, s) => (!best || s.latest < best.latest) ? s : best, null);
      const worstSupplier = supplierList.reduce((worst, s) => (!worst || s.latest > worst.latest) ? s : worst, null);

      // Chart data: daily prices across all suppliers
      const chartData = sorted.reduce((acc, h) => {
        const existing = acc.find(d => d.date === h.date);
        if (existing) {
          existing[h.supplier] = h.price;
        } else {
          acc.push({ date: h.date.slice(5), [h.supplier]: h.price });
        }
        return acc;
      }, []).slice(-30);

      return {
        product,
        sorted,
        avg30,
        latestPrice,
        spikeDetected,
        spikePct,
        supplierList,
        bestSupplier,
        worstSupplier,
        chartData,
        uniqueSuppliers: [...new Set(sorted.map(h => h.supplier))],
      };
    }).filter(p => p.sorted.length > 0)
      .sort((a, b) => (b.spikeDetected ? 1 : 0) - (a.spikeDetected ? 1 : 0));
  }, [productPriceHistory, thirtyDaysAgo]);

  const spikes = productAnalytics.filter(p => p.spikeDetected);
  const filtered = productAnalytics.filter(p =>
    !search || p.product.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Price spike alerts */}
      {spikes.length > 0 && (
        <Card className="p-3 border-red-300 bg-red-50 dark:bg-red-950/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">{spikes.length} Price Spike{spikes.length > 1 ? 's' : ''} Detected (≥5% above 30-day avg)</p>
          </div>
          <div className="space-y-1">
            {spikes.map(s => (
              <div key={s.product} className="flex items-center justify-between text-xs">
                <span className="font-medium text-red-800">{s.product}</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-600">Now: {fmt(s.latestPrice)}</span>
                  <span className="text-muted-foreground">30d avg: {fmt(s.avg30)}</span>
                  <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">
                    +{s.spikePct.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredient..." className="pl-8" />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Loading price history...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No purchase price history found. Add purchases with prices to see comparisons.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.product} className={`p-4 ${p.spikeDetected ? 'border-red-300' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{p.product}</p>
                    {p.spikeDetected && (
                      <Badge className="text-xs bg-red-100 text-red-700 border border-red-200">
                        <TrendingUp className="w-3 h-3 mr-0.5" /> +{p.spikePct.toFixed(1)}% spike
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.uniqueSuppliers.length} supplier{p.uniqueSuppliers.length !== 1 ? 's' : ''} · {p.sorted.length} price records
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Latest</p>
                  <p className={`text-sm font-bold ${p.spikeDetected ? 'text-red-500' : 'text-foreground'}`}>{fmt(p.latestPrice)}</p>
                </div>
              </div>

              {/* Supplier comparison */}
              {p.supplierList.length > 1 && (
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {p.bestSupplier && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-xs">
                      <p className="text-emerald-600 font-semibold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Best Price
                      </p>
                      <p className="font-bold text-emerald-700">{fmt(p.bestSupplier.latest)}</p>
                      <p className="text-muted-foreground truncate">{p.bestSupplier.name}</p>
                    </div>
                  )}
                  {p.worstSupplier && p.worstSupplier.name !== p.bestSupplier?.name && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-xs">
                      <p className="text-red-500 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Highest Price
                      </p>
                      <p className="font-bold text-red-600">{fmt(p.worstSupplier.latest)}</p>
                      <p className="text-muted-foreground truncate">{p.worstSupplier.name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Price history chart */}
              {p.chartData.length > 1 && (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={p.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `${currency}${v.toFixed(0)}`} width={40} />
                    <Tooltip formatter={v => fmt(v)} />
                    {p.avg30 && <ReferenceLine y={p.avg30} stroke="#6366f1" strokeDasharray="3 2" strokeWidth={1} label={{ value: 'avg', fill: '#6366f1', fontSize: 8 }} />}
                    {p.uniqueSuppliers.map((sup, i) => (
                      <Line key={sup} type="monotone" dataKey={sup} stroke={COLORS[i % COLORS.length]}
                        strokeWidth={1.5} dot={false} connectNulls name={sup} />
                    ))}
                    {p.uniqueSuppliers.length === 1 && (
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* All supplier prices table */}
              {p.supplierList.length > 0 && (
                <div className="mt-2 space-y-1">
                  {p.supplierList.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate flex-1">{s.name}</span>
                      <span className="font-semibold ml-2">{fmt(s.latest)}</span>
                      <span className="text-muted-foreground ml-2">avg {fmt(s.avg)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}