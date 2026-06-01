import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, CreditCard, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useDebtI18n } from '@/lib/debtI18n';

const PARTY_ICONS = {
  customer: '👤',
  company: '🏢',
  supplier: '📦',
  loan: '🏦',
  branch: '🏪',
  owner_personal: '👑',
};

export default function DebtCard({ debt, onPay, onView, onEdit }) {
  const d = useDebtI18n();

  const STATUS_CONFIG = {
    open:        { label: d.status_open_label,        color: 'bg-blue-100 text-blue-700' },
    partial:     { label: d.status_partial_label,     color: 'bg-amber-100 text-amber-700' },
    paid:        { label: d.status_paid_label,        color: 'bg-green-100 text-green-700' },
    overdue:     { label: d.status_overdue_label,     color: 'bg-red-100 text-red-700' },
    written_off: { label: d.status_written_off_label, color: 'bg-slate-100 text-slate-500' },
  };

  const RISK_CONFIG = {
    low:    { label: d.risk_low,    color: 'bg-green-100 text-green-700' },
    medium: { label: d.risk_medium, color: 'bg-amber-100 text-amber-700' },
    high:   { label: d.risk_high,   color: 'bg-red-100 text-red-700' },
  };

  const isOverdue = debt.due_date && debt.status !== 'paid' && isPast(parseISO(debt.due_date));
  const pct = debt.total_amount > 0 ? Math.min(100, ((debt.paid_amount || 0) / debt.total_amount) * 100) : 0;
  const statusKey = isOverdue && debt.status !== 'paid' ? 'overdue' : debt.status;
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.open;

  return (
    <Card className={`overflow-hidden ${isOverdue ? 'border-red-300 shadow-red-100' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">{PARTY_ICONS[debt.party_type] || '💰'}</span>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{debt.party_name}</div>
              <div className="text-xs text-muted-foreground">{debt.description || debt.invoice_number || ''}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
            {debt.risk_score && debt.risk_score !== 'low' && (
              <Badge className={`text-[10px] ${RISK_CONFIG[debt.risk_score]?.color || ''}`}>
                {RISK_CONFIG[debt.risk_score]?.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground">{d.total}</div>
            <div className="text-sm font-bold">{(debt.total_amount || 0).toLocaleString()}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-[10px] text-muted-foreground">{d.paid}</div>
            <div className="text-sm font-bold text-green-700">{(debt.paid_amount || 0).toLocaleString()}</div>
          </div>
          <div className={`rounded-lg p-2 ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}>
            <div className="text-[10px] text-muted-foreground">{d.remaining}</div>
            <div className={`text-sm font-bold ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
              {(debt.remaining_amount ?? debt.total_amount - (debt.paid_amount || 0)).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{d.paid_pct(pct.toFixed(0))}</span>
            {debt.due_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                <Calendar className="w-3 h-3" />
                {format(parseISO(debt.due_date), 'dd MMM yyyy')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {debt.status !== 'paid' && debt.status !== 'written_off' && (
            <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => onPay(debt)}>
              <CreditCard className="w-3 h-3 mr-1" /> {d.record_payment}
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onView(debt)}>
            <ChevronRight className="w-3 h-3 mr-1" /> {d.details}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => onEdit(debt)}>✏️</Button>
        </div>
      </CardContent>
    </Card>
  );
}