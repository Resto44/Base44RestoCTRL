import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#6b7280'];
const REASON_COLORS = {
  expired: '#f97316',
  spoiled: '#ef4444',
  damaged: '#eab308',
  theft: '#8b5cf6',
  other: '#6b7280',
};

export default function WasteCostReport({ wastes, currency }) {
  const { lang } = useLanguage();

  const totalLoss = wastes.reduce((s, w) => s + (w.total_loss || 0), 0);

  // By product
  const byProduct = useMemo(() => {
    const map = {};
    wastes.forEach(w => {
      const key = w.product_name || w.product_id;
      if (!map[key]) map[key] = { name: key, loss: 0, qty: 0 };
      map[key].loss += w.total_loss || 0;
      map[key].qty += w.qty || 0;
    });
    return Object.values(map).sort((a, b) => b.loss - a.loss).slice(0, 10);
  }, [wastes]);

  // By branch
  const byBranch = useMemo(() => {
    const map = {};
    wastes.forEach(w => {
      if (!map[w.branch]) map[w.branch] = { name: w.branch, loss: 0 };
      map[w.branch].loss += w.total_loss || 0;
    });
    return Object.values(map).sort((a, b) => b.loss - a.loss);
  }, [wastes]);

  // By reason
  const byReason = useMemo(() => {
    const map = {};
    wastes.forEach(w => {
      if (!map[w.reason]) map[w.reason] = { name: w.reason, loss: 0, count: 0 };
      map[w.reason].loss += w.total_loss || 0;
      map[w.reason].count += 1;
    });
    return Object.values(map).sort((a, b) => b.loss - a.loss);
  }, [wastes]);

  if (wastes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No waste records in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-red-50 border-red-200">
          <p className="text-xs text-red-600 font-medium">Total Loss</p>
          <p className="text-lg font-bold text-red-700">{currency}{totalLoss.toFixed(2)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Waste Events</p>
          <p className="text-lg font-bold">{wastes.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Top Reason</p>
          <p className="text-lg font-bold capitalize">{byReason[0]?.name || '—'}</p>
        </Card>
      </div>

      {/* By Product */}
      {byProduct.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Waste Cost by Item</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, byProduct.length * 28)}>
            <BarChart data={byProduct} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${currency}${v.toFixed(0)}`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={v => `${currency}${Number(v).toFixed(2)}`} />
              <Bar dataKey="loss" name="Loss" radius={[0, 3, 3, 0]}>
                {byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* By Reason */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Loss by Reason</h3>
        <div className="space-y-2">
          {byReason.map(r => (
            <div key={r.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: REASON_COLORS[r.name] || '#6b7280' }} />
              <span className="capitalize text-sm flex-1">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.count} events</span>
              <span className="text-sm font-semibold text-red-600">{currency}{r.loss.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* By Branch */}
      {byBranch.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Loss by Branch</h3>
          <div className="space-y-2">
            {byBranch.map((b, i) => {
              const pct = totalLoss > 0 ? (b.loss / totalLoss * 100) : 0;
              return (
                <div key={b.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-red-600 font-semibold">{currency}{b.loss.toFixed(2)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}