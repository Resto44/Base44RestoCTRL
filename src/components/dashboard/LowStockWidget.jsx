import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, ShoppingCart, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { computePurchaseForecast, buildOrderDraftItems } from '@/lib/purchaseForecasting';
import { format } from 'date-fns';
import { useTenant } from '@/lib/TenantContext';

const urgencyColor = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
};

export default function LowStockWidget() {
  const { lang, branches, currency } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ownerFilter } = useTenant();
  const [expanded, setExpanded] = useState(true);
  const [generatingOrder, setGeneratingOrder] = useState(null); // branch key being generated

  const { data: items = [] } = useQuery({ queryKey: ['inventory', ownerFilter], queryFn: () => base44.entities.Inventory.filter(ownerFilter, '-date', 5000), enabled: !!ownerFilter.created_by });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases', ownerFilter], queryFn: () => base44.entities.Purchase.filter(ownerFilter, '-date', 10000), enabled: !!ownerFilter.created_by });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', ownerFilter], queryFn: () => base44.entities.Supplier.filter(ownerFilter, 'name', 50), enabled: !!ownerFilter.created_by });

  const createOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase_orders'] }),
  });

  // Compute full forecast
  const forecast = useMemo(() => computePurchaseForecast(items, purchases, 14, 30), [items, purchases]);
  const criticalItems = useMemo(() => forecast.filter(f => f.urgency === 'critical' || f.urgency === 'high'), [forecast]);
  const allAlerts = useMemo(() => forecast.filter(f => f.daysLeft <= 14), [forecast]);

  const branchLabel = (key) => branches.find(b => b.key === key)?.label || key;

  const handleGenerateOrder = async (branchKey) => {
    setGeneratingOrder(branchKey);
    const branchItems = forecast.filter(f => f.branch === branchKey && f.recommendedQty > 0);
    if (branchItems.length === 0) { setGeneratingOrder(null); return; }

    const orderItems = buildOrderDraftItems(branchItems);
    const totalAmount = 0; // user fills prices

    try {
      const order = await createOrderMutation.mutateAsync({
        branch: branchKey,
        date: format(new Date(), 'yyyy-MM-dd'),
        items: JSON.stringify(orderItems),
        total_amount: totalAmount,
        status: 'draft',
        notes: `AI-generated forecast order for ${branchLabel(branchKey)} — ${branchItems.length} items need replenishment within 14 days.`,
        order_number: `AI-${Date.now().toString().slice(-6)}`,
        supplier_id: suppliers[0]?.id || '',
        supplier_name: suppliers[0]?.name || 'To be assigned',
      });
      navigate('/purchase-orders');
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingOrder(null);
    }
  };

  if (allAlerts.length === 0) return null;

  const title = lang === 'ar' ? 'تنبيهات المخزون' : lang === 'fa' ? 'هشدارهای انبار' : 'Low Stock Alerts';

  // Unique branches with alerts
  const alertBranches = [...new Set(allAlerts.map(a => a.branch))];

  return (
    <Card className="mb-4 border-red-200 dark:border-red-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 flex-1">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              {title} ({allAlerts.length})
            </CardTitle>
            {criticalItems.length > 0 && (
              <Badge className="bg-red-100 text-red-700 text-xs">{criticalItems.length} critical</Badge>
            )}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
          </button>
          <Button size="sm" variant="ghost" asChild className="text-xs ml-1">
            <Link to="/inventory">{lang === 'ar' ? 'عرض الكل' : lang === 'fa' ? 'مشاهده همه' : 'View All'}</Link>
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Alert rows */}
          <div className="space-y-1.5 mb-3">
            {allAlerts.slice(0, 6).map(item => (
              <div
                key={`${item.product_id}_${item.branch}`}
                className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg border ${urgencyColor[item.urgency]}`}
              >
                <div>
                  <span className="font-medium">{item.product_name}</span>
                  <span className="opacity-70 ml-1">· {branchLabel(item.branch)}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{item.currentStock} {item.unit}</span>
                  <span className="opacity-70 ml-1">
                    {item.daysLeft <= 0 ? 'Out of stock' : `~${item.daysLeft}d left`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Forecast + Generate Order per branch */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <p className="text-xs font-semibold text-purple-700">
                {lang === 'fa' ? 'پیشنهاد خرید هوشمند' : lang === 'ar' ? 'توصية شراء ذكية' : 'AI Replenishment Forecast'}
              </p>
            </div>
            {alertBranches.map(branchKey => {
              const branchForecast = forecast.filter(f => f.branch === branchKey && f.recommendedQty > 0);
              if (branchForecast.length === 0) return null;
              const totalItems = branchForecast.length;
              const isGenerating = generatingOrder === branchKey;

              return (
                <div key={branchKey} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-purple-800">{branchLabel(branchKey)}</p>
                    <p className="text-xs text-purple-600">{totalItems} items need replenishment</p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700 gap-1"
                    disabled={isGenerating}
                    onClick={() => handleGenerateOrder(branchKey)}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-3 h-3" />
                    )}
                    {lang === 'fa' ? 'ایجاد سفارش' : lang === 'ar' ? 'إنشاء طلب' : 'Generate PO'}
                  </Button>
                </div>
              );
            })}

            {/* Forecast detail table */}
            {forecast.slice(0, 4).some(f => f.recommendedQty > 0) && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Top recommendations (14-day target):</p>
                <div className="space-y-1">
                  {forecast.filter(f => f.recommendedQty > 0).slice(0, 4).map(f => (
                    <div key={`${f.product_id}_${f.branch}`} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{f.product_name} · {branchLabel(f.branch)}</span>
                      <span className="font-semibold text-foreground">
                        +{f.recommendedQty} {f.unit}
                        <span className={`ml-1 ${f.confidence === 'high' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          ({f.confidence} confidence)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}