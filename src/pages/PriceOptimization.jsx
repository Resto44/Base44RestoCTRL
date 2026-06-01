import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/helpers';

const DAYS = 30;

function PriceRow({ product, purchases, targetMargin, currency }) {
  const recentPurchases = purchases.filter(p => p.product_id === product.product_id || p.product_id === product.id);

  // Average cost from recent purchase history
  const avgCost = recentPurchases.length > 0
    ? recentPurchases.reduce((s, p) => s + (p.used_price || p.current_price || product.default_cost || 0), 0) / recentPurchases.length
    : product.default_cost || 0;

  const currentPrice = product.default_price || 0;
  const currentMargin = avgCost > 0 ? ((currentPrice - avgCost) / currentPrice) * 100 : null;
  const suggestedPrice = avgCost > 0 ? avgCost / (1 - targetMargin / 100) : null;
  const priceDiff = suggestedPrice ? suggestedPrice - currentPrice : 0;
  const costChange = product.default_cost && avgCost > 0 ? ((avgCost - product.default_cost) / product.default_cost) * 100 : 0;

  const status = !suggestedPrice ? 'no-data'
    : currentMargin >= targetMargin - 2 ? 'ok'
    : currentMargin >= targetMargin - 10 ? 'warning'
    : 'danger';

  const statusColors = {
    ok: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
    danger: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    'no-data': 'bg-secondary border-border',
  };

  return (
    <Card className={`p-3 ${statusColors[status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{product.name}</p>
            {product.category && <Badge variant="outline" className="text-xs">{product.category}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-xs">
            <span className="text-muted-foreground">Current price: <span className="font-medium text-foreground">{formatCurrency(currentPrice, currency)}</span></span>
            <span className="text-muted-foreground">Avg cost ({DAYS}d): <span className="font-medium text-foreground">{avgCost > 0 ? formatCurrency(avgCost, currency) : '—'}</span></span>
            <span className="text-muted-foreground">Current margin: <span className={`font-medium ${currentMargin === null ? 'text-muted-foreground' : currentMargin >= targetMargin ? 'text-green-600' : 'text-red-600'}`}>{currentMargin !== null ? `${currentMargin.toFixed(1)}%` : '—'}</span></span>
            {Math.abs(costChange) > 1 && (
              <span className="text-muted-foreground">Cost shift: <span className={`font-medium ${costChange > 0 ? 'text-red-600' : 'text-green-600'}`}>{costChange > 0 ? '+' : ''}{costChange.toFixed(1)}%</span></span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {suggestedPrice ? (
            <>
              <p className="text-xs text-muted-foreground">Suggested</p>
              <p className="font-bold text-base">{formatCurrency(suggestedPrice, currency)}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {priceDiff > 0.5 ? <TrendingUp className="w-3 h-3 text-amber-500" /> : priceDiff < -0.5 ? <TrendingDown className="w-3 h-3 text-green-500" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                <span className={`text-xs font-medium ${priceDiff > 0.5 ? 'text-amber-600' : priceDiff < -0.5 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {priceDiff >= 0 ? '+' : ''}{formatCurrency(priceDiff, currency)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No cost data</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function PriceOptimization() {
  const { currency } = useLanguage();
  const [targetMargin, setTargetMargin] = useState(35);
  const [search, setSearch] = useState('');
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const since = format(subDays(new Date(), DAYS), 'yyyy-MM-dd');

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('name', 10000),
  });

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases_recent'],
    queryFn: () => base44.entities.Purchase.filter({ date: { $gte: since } }, '-date', 5000),
  });

  const isLoading = loadingProducts || loadingPurchases;

  const filteredProducts = useMemo(() => products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
  ), [products, search]);

  // Group products by status for summary
  const summary = useMemo(() => {
    let ok = 0, warning = 0, danger = 0, noData = 0;
    products.forEach(p => {
      const rp = purchases.filter(pu => pu.product_id === p.product_id || pu.product_id === p.id);
      const avgCost = rp.length > 0 ? rp.reduce((s, pu) => s + (pu.used_price || pu.current_price || p.default_cost || 0), 0) / rp.length : p.default_cost || 0;
      if (!avgCost) { noData++; return; }
      const margin = ((p.default_price - avgCost) / p.default_price) * 100;
      if (margin >= targetMargin - 2) ok++;
      else if (margin >= targetMargin - 10) warning++;
      else danger++;
    });
    return { ok, warning, danger, noData };
  }, [products, purchases, targetMargin]);

  const generateAIInsights = async () => {
    setLoadingAI(true);
    setAiInsights(null);
    try {
      // Build a concise product cost-price summary for the AI
      const productData = products.slice(0, 20).map(p => {
        const rp = purchases.filter(pu => pu.product_id === p.product_id || pu.product_id === p.id);
        const avgCost = rp.length > 0 ? rp.reduce((s, pu) => s + (pu.used_price || pu.current_price || p.default_cost || 0), 0) / rp.length : p.default_cost || 0;
        const margin = avgCost > 0 ? ((p.default_price - avgCost) / p.default_price) * 100 : null;
        return { name: p.name, price: p.default_price, cost: avgCost, margin: margin ? margin.toFixed(1) : null };
      });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a restaurant pricing consultant. Given this product data (price, avg cost, margin%) and a target margin of ${targetMargin}%, provide 3-5 concise, actionable insights in bullet points. Focus on: which products need urgent price increases, any patterns (categories or items), and quick wins. Data: ${JSON.stringify(productData)}. Be specific and brief.`,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: { type: 'array', items: { type: 'string' } },
            top_priority: { type: 'string' },
          },
        },
      });
      setAiInsights(result);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div>
      <PageHeader title="Price Optimization" />

      {/* Target Margin Control */}
      <Card className="p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Target Profit Margin</Label>
          <span className="text-lg font-bold text-primary">{targetMargin}%</span>
        </div>
        <Slider value={[targetMargin]} onValueChange={([v]) => setTargetMargin(v)} min={10} max={70} step={1} />
        <div className="flex justify-between text-xs text-muted-foreground"><span>10%</span><span>70%</span></div>
      </Card>

      {/* Summary KPIs */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-2.5 text-center bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{summary.ok}</p>
            <p className="text-xs text-green-600">On Target</p>
          </Card>
          <Card className="p-2.5 text-center bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{summary.warning}</p>
            <p className="text-xs text-amber-600">At Risk</p>
          </Card>
          <Card className="p-2.5 text-center bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{summary.danger}</p>
            <p className="text-xs text-red-600">Below Target</p>
          </Card>
        </div>
      )}

      {/* AI Insights */}
      <Button variant="outline" className="w-full mb-4 border-primary/30 text-primary" onClick={generateAIInsights} disabled={loadingAI || isLoading}>
        {loadingAI ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {loadingAI ? 'Analyzing pricing...' : 'Generate AI Pricing Insights'}
      </Button>

      {aiInsights && (
        <Card className="p-4 mb-4 bg-primary/5 border-primary/20 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">AI Pricing Analysis</p>
            <button onClick={() => setAiInsights(null)} className="ml-auto text-muted-foreground hover:text-foreground"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          {aiInsights.top_priority && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{aiInsights.top_priority}</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {(aiInsights.insights || []).map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary font-bold mt-0.5">•</span> {ins}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Product List */}
      <div className="mb-3">
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /><span>Loading product data...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">No products found</p>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map(p => (
            <PriceRow key={p.id} product={p} purchases={purchases} targetMargin={targetMargin} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}