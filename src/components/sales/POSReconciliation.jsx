/**
 * POSReconciliation — Per-device POS reconciliation.
 * Shows expected amount (from sales), actual settlement, and mismatch warnings.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Wifi, AlertTriangle, CheckCircle2 } from 'lucide-react';

const LABELS = {
  en: {
    title: 'POS Reconciliation',
    device: 'Device',
    expected: 'Expected',
    actual: 'Actual Settlement',
    difference: 'Difference',
    mismatch: 'Mismatch',
    balanced: 'Balanced',
    no_pos: 'No POS transactions today',
  },
  ar: {
    title: 'مطابقة نقاط البيع',
    device: 'الجهاز',
    expected: 'المتوقع',
    actual: 'التسوية الفعلية',
    difference: 'الفرق',
    mismatch: 'عدم تطابق',
    balanced: 'متوازن',
    no_pos: 'لا توجد معاملات POS اليوم',
  },
  fa: {
    title: 'تطبیق POS',
    device: 'دستگاه',
    expected: 'مورد انتظار',
    actual: 'تسویه واقعی',
    difference: 'تفاوت',
    mismatch: 'عدم تطابق',
    balanced: 'متعادل',
    no_pos: 'تراکنش POS امروز ندارد',
  },
};

export default function POSReconciliation({ date, branch }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { ownerFilter } = useTenant();
  const todayStr = date || format(new Date(), 'yyyy-MM-dd');

  const [actualAmounts, setActualAmounts] = useState({});

  const { data: sales = [] } = useQuery({
    queryKey: ['sales_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const { data: networkAccounts = [] } = useQuery({
    queryKey: ['network_accounts'],
    queryFn: () => base44.entities.NetworkAccount.list('-created_date', 500),
    staleTime: 60000,
  });

  // Aggregate POS amounts from sales pos_entries_json
  const posDeviceTotals = useMemo(() => {
    const map = {};
    const daySales = branch && branch !== 'all' ? sales.filter(s => s.branch === branch) : sales;

    daySales.forEach(sale => {
      // New structured entries
      if (sale.pos_entries_json) {
        try {
          const entries = JSON.parse(sale.pos_entries_json);
          entries.forEach(entry => {
            const key = entry.device_id || 'unknown';
            map[key] = (map[key] || 0) + (Number(entry.amount) || 0);
          });
          return;
        } catch { /* fall through */ }
      }
      // Legacy: single restaurant_network field
      const net = Number(sale.restaurant_network) || Number(sale.network) || 0;
      if (net > 0) {
        const key = sale.restaurant_network_account_id || 'legacy';
        map[key] = (map[key] || 0) + net;
      }
    });

    return map;
  }, [sales, branch]);

  const deviceIds = Object.keys(posDeviceTotals);

  const getDeviceName = (id) => {
    const acc = networkAccounts.find(a => a.id === id);
    return acc?.account_name || id || 'Unknown Device';
  };

  if (deviceIds.length === 0) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
          <Wifi className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{lbl.title}</span>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">{lbl.no_pos}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
        <Wifi className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{lbl.title}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
          <span>{lbl.device}</span>
          <span className="text-right">{lbl.expected}</span>
          <span className="text-right">{lbl.actual}</span>
          <span className="text-right">{lbl.difference}</span>
        </div>

        {deviceIds.map(deviceId => {
          const expected = posDeviceTotals[deviceId] || 0;
          const actual = Number(actualAmounts[deviceId]) || 0;
          const hasActual = actualAmounts[deviceId] !== undefined && actualAmounts[deviceId] !== '';
          const diff = actual - expected;
          const hasMismatch = hasActual && Math.abs(diff) > 0.01;

          return (
            <div key={deviceId} className={`rounded-lg border p-2.5 ${hasMismatch ? 'border-red-200 bg-red-50/50' : hasActual ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-muted/20'}`}>
              <div className="grid grid-cols-4 gap-2 items-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Wifi className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{getDeviceName(deviceId)}</span>
                </div>
                <span className="text-xs font-bold text-right">{currency}{expected.toLocaleString()}</span>
                <Input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={actualAmounts[deviceId] || ''}
                  onChange={e => setActualAmounts(prev => ({ ...prev, [deviceId]: e.target.value }))}
                  placeholder="0"
                  className="h-8 text-xs text-right"
                />
                <div className="flex items-center justify-end gap-1">
                  {hasActual ? (
                    hasMismatch ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="text-xs font-bold text-red-600">{diff >= 0 ? '+' : ''}{currency}{diff.toLocaleString()}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-emerald-600">OK</span>
                      </>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              {hasMismatch && (
                <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                  {lbl.mismatch}: {currency}{Math.abs(diff).toLocaleString()} {diff > 0 ? '(surplus)' : '(shortage)'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
