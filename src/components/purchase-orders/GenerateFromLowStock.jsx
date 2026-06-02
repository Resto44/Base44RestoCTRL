import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { computeLiveStock } from '@/lib/stockEngine';
import { format } from 'date-fns';
import { AlertTriangle, Zap } from 'lucide-react';

export default function GenerateFromLowStock({ open, onClose, onCreated }) {
  const { currency } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [qtys, setQtys] = useState({});
  const [loading, setLoading] = useState(false);

  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list('-date', 500) });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-date', 5000) });
  const { data: wastes = [] } = useQuery({ queryKey: ['inventory_waste'], queryFn: () => base44.entities.InventoryWaste.list('-date', 500) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list('name', 200) });

  const liveStock = useMemo(() => computeLiveStock(inventory, purchases, wastes), [inventory, purchases, wastes]);

  const lowItems = useMemo(() => {
    let items = liveStock.filter(i => i.isLow);
    if (selectedBranch !== 'all') items = items.filter(i => i.branch === selectedBranch);
    return items;
  }, [liveStock, selectedBranch]);

  const branches = useMemo(() => [...new Set(liveStock.map(i => i.branch))], [liveStock]);

  // Default reorder qty = 2× threshold
  const getDefaultQty = (item) => qtys[`${item.product_id}_${item.branch}`] ?? Math.max(1, (item.low_stock_threshold || 5) * 2);

  const selectedSupplierObj = suppliers.find(s => s.id === selectedSupplier);

  const handleGenerate = async () => {
    if (!selectedSupplier || lowItems.length === 0) return;
    setLoading(true);

    const items = lowItems.map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      qty: getDefaultQty(it),
      unit: it.unit || '',
      unit_price: 0,
    }));

    const total = 0; // prices unknown at this stage
    const orderNum = `PO-${Date.now().toString().slice(-6)}`;

    await base44.entities.PurchaseOrder.create({
      order_number: orderNum,
      supplier_id: selectedSupplier,
      supplier_name: selectedSupplierObj?.name || '',
      supplier_email: selectedSupplierObj?.email || '',
      supplier_phone: selectedSupplierObj?.phone || '',
      branch: selectedBranch === 'all' ? (lowItems[0]?.branch || '') : selectedBranch,
      date: format(new Date(), 'yyyy-MM-dd'),
      items: JSON.stringify(items),
      total_amount: total,
      status: 'draft',
      notes: `Auto-generated from low stock alert — ${lowItems.length} item(s)`,
    });

    queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
    setLoading(false);
    onCreated?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Generate PO from Low Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Branch filter */}
          <div>
            <Label>Branch</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Supplier */}
          <div>
            <Label>Assign to Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Low stock items */}
          {lowItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">
              ✅ No low stock items for this branch!
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                {lowItems.length} low-stock item(s) found. Adjust reorder quantities:
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {lowItems.map(it => {
                  const key = `${it.product_id}_${it.branch}`;
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 border rounded-lg bg-amber-50/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{it.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock: <span className="text-red-500 font-semibold">{it.currentStock?.toFixed(1)}</span> / Min: {it.low_stock_threshold} {it.unit}
                          {selectedBranch === 'all' && <span className="text-muted-foreground"> · {it.branch}</span>}
                        </p>
                      </div>
                      <div className="w-16">
                        <Input
                          type="number"
                          className="h-7 text-xs text-center"
                          value={getDefaultQty(it)}
                          min={1}
                          onChange={e => setQtys(q => ({ ...q, [key]: parseFloat(e.target.value) || 1 }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={handleGenerate}
              disabled={loading || !selectedSupplier || lowItems.length === 0}
            >
              {loading ? 'Creating...' : `Create Draft PO (${lowItems.length} items)`}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}