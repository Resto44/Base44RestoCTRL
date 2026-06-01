import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ShieldCheck, Clock, CheckCircle2, Store } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import RiskBadge from '@/components/shared/RiskBadge';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

const SETTLE_BADGE = {
  pending:  { label: 'Pending', icon: Clock, cls: 'text-amber-600 bg-amber-50' },
  verified: { label: 'Verified', icon: ShieldCheck, cls: 'text-blue-600 bg-blue-50' },
  approved: { label: 'Settled', icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
  rejected: { label: 'Rejected', icon: null, cls: 'text-red-600 bg-red-50' },
};

export default function SalesListItem({ sale, onEdit, onDelete }) {
  const { t, currency } = useLanguage();
  const { branches } = useTenant();
  const total = (sale.cash || 0) + (sale.network || 0) + (sale.credit || 0);
  const creditPct = total === 0 ? null : (sale.credit || 0) / total;
  const branchLabel = branches.find(b => b.key === sale.branch)?.label || sale.branch;
  const hasNetwork = (sale.network || 0) > 0;

  const rCash = sale.restaurant_cash ?? sale.cash ?? 0;
  const rNet = sale.restaurant_network ?? sale.network ?? 0;

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlement_for_sale', sale.id],
    queryFn: () => base44.entities.SettlementRecord.filter({ reference_id: sale.id, flow_type: 'MANAGER_TO_SPONSOR' }),
    enabled: hasNetwork,
    staleTime: 30000,
  });
  const settlement = settlements[0];
  const badge = settlement ? SETTLE_BADGE[settlement.status] || SETTLE_BADGE.pending : null;

  return (
    <Card className="p-3 mb-2 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{sale.date}</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">{branchLabel}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(sale)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(sale)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-secondary/40 rounded-lg px-2 py-1.5 mb-2">
        <Store className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground flex-1">{t('cash')}: <span className="font-semibold text-foreground">{currency}{rCash.toLocaleString()}</span></span>
        <span className="text-[10px] text-muted-foreground">Net: <span className="font-semibold text-foreground">{currency}{rNet.toLocaleString()}</span></span>
        {(sale.credit || 0) > 0 && (
          <span className="text-[10px] text-muted-foreground ms-2">Credit: <span className="font-semibold text-foreground">{currency}{(sale.credit || 0).toLocaleString()}</span></span>
        )}
        <span className="text-xs font-bold text-primary ms-2">{currency}{total.toLocaleString()}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div>
          {badge && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.icon && <badge.icon className="w-3 h-3" />}
              Network {badge.label}
              {settlement?.proof_url && <span className="ml-0.5">📎</span>}
            </span>
          )}
        </div>
        <RiskBadge creditPct={creditPct} />
      </div>
    </Card>
  );
}