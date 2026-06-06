import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';

export default function PurchaseListItem({ purchase, onEdit, onDelete }) {
  const { t, currency } = useLanguage();
  const { branches } = useTenant();
  const branchLabel = branches.find(b => b.key === purchase.branch)?.label || purchase.branch;
  const total = (purchase.qty || 0) * (purchase.used_price || purchase.current_price || 0);

  return (
    <Card className="p-3 mb-2 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{purchase.date}</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">{branchLabel}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(purchase)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(purchase)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{purchase.product_name || purchase.product_id}</p>
          <p className="text-xs text-muted-foreground">
            {purchase.qty} × {currency}{(purchase.used_price || purchase.current_price || 0).toLocaleString()}
            {purchase.category ? <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{purchase.category}</span> : null}
          </p>
        </div>
        <p className="text-sm font-bold text-primary">{currency}{total.toLocaleString()}</p>
      </div>
    </Card>
  );
}