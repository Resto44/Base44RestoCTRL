import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

function buildMenuHierarchy(categories, subcategories, products) {
  const catMap = {};
  categories.forEach(c => {
    catMap[c.id] = { ...c, subcategories: [] };
  });
  
  const subMap = {};
  subcategories.forEach(s => {
    subMap[s.id] = { ...s, products: [] };
    if (catMap[s.menu_category_id]) {
      catMap[s.menu_category_id].subcategories.push(s);
    }
  });
  
  products.forEach(p => {
    if (subMap[p.menu_subcategory_id]) {
      subMap[p.menu_subcategory_id].products.push(p);
    }
  });
  
  return Object.values(catMap).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export default function NewOrderForm({ branch, drivers = [], menuCategories = [], menuSubcategories = [], menuProducts = [], openShifts, onClose, onCreated }) {
  const [driverId, setDriverId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [deliveryFee, setDeliveryFee] = useState(5);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [activeSubcategoryId, setActiveSubcategoryId] = useState('');

  const menuHierarchy = useMemo(() => buildMenuHierarchy(menuCategories, menuSubcategories, menuProducts), [menuCategories, menuSubcategories, menuProducts]);
  
  const activeCategory = menuHierarchy.find(c => c.id === activeCategoryId);
  const activeSubcategory = activeCategory?.subcategories.find(s => s.id === activeSubcategoryId);
  const productsToDisplay = activeSubcategory?.products || [];

  const addItem = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unit_price } : i);
      return [...prev, { product_id: product.id, name: product.name, qty: 1, unit_price: product.selling_price, total: product.selling_price }];
    });
  };

  const removeItem = (pid) => setCart(p => p.filter(i => i.product_id !== pid));
  const changeQty = (pid, delta) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== pid) return i;
      const qty = Math.max(1, i.qty + delta);
      return { ...i, qty, total: qty * i.unit_price };
    }));
  };

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const total = subtotal + Number(deliveryFee) - Number(discount);

  const driver = drivers.find(d => d.id === driverId);
  const shift = openShifts.find(s => s.driver_id === driverId);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!driverId) throw new Error('Select a driver');
      if (cart.length === 0) throw new Error('Add at least one item');

      // Auto-open shift if none exists
      let shiftId = shift?.id;
      if (!shiftId) {
        const now = new Date().toTimeString().slice(0, 5);
        const newShift = await base44.entities.DriverShift.create({
          branch, driver_id: driverId, driver_name: driver?.full_name || '',
          date: new Date().toISOString().split('T')[0],
          shift_start: now, status: 'open',
          total_orders: 0, total_cash_collected: 0, total_network_collected: 0,
          total_credit_collected: 0, total_revenue: 0,
        });
        shiftId = newShift.id;
      }

      // Generate order number
      const orderNum = `ORD-${Date.now().toString().slice(-6)}`;
      await base44.entities.DeliveryOrder.create({
        order_number: orderNum, branch,
        driver_id: driverId, driver_name: driver?.full_name || '',
        status: 'pending', customer_name: customerName,
        customer_phone: customerPhone, customer_address: customerAddress,
        items_json: JSON.stringify(cart), subtotal, delivery_fee: Number(deliveryFee),
        discount: Number(discount), total_amount: total,
        payment_method: paymentMethod, payment_collected: false,
        shift_id: shiftId, notes,
      });
    },
    onSuccess: () => { toast.success('Order created!'); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  const firstCategory = menuHierarchy[0];
  const displayCategory = activeCategoryId ? activeCategory : firstCategory;
  const firstSubcategory = displayCategory?.subcategories[0];
  const displaySubcategory = activeSubcategoryId ? activeSubcategory : firstSubcategory;

  if (menuHierarchy.length === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" /> New Delivery Order
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No menu categories available. Please create menu items first.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> New Delivery Order
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x">
          {/* Left: Menu */}
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Menu</h3>
            
            {/* Category tabs */}
            <div className="flex gap-1 flex-wrap">
              {menuHierarchy.map(cat => (
                <button key={cat.id} onClick={() => {
                  setActiveCategoryId(cat.id);
                  setActiveSubcategoryId(cat.subcategories[0]?.id || '');
                }}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${displayCategory?.id === cat.id ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Subcategory tabs */}
            {displayCategory?.subcategories && displayCategory.subcategories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {displayCategory.subcategories.map(sub => (
                  <button key={sub.id} onClick={() => setActiveSubcategoryId(sub.id)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${displaySubcategory?.id === sub.id ? 'bg-blue-500 text-white border-blue-500' : 'border-border hover:bg-muted'}`}>
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* Products */}
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {productsToDisplay.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="text-left p-2 border rounded-lg hover:bg-accent/10 transition-colors active:scale-95">
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="text-xs text-primary font-bold mt-0.5">{p.selling_price} SAR</div>
                </button>
              ))}
            </div>
            {productsToDisplay.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No products in this category.</p>
            )}
          </div>

          {/* Right: Cart + Details */}
          <div className="p-4 space-y-3">
            {/* Driver */}
            <div>
              <Label className="text-xs">Driver *</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder={drivers.length === 0 ? "No drivers available" : "Select driver"} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">No drivers available</div>
                  ) : (
                    drivers
                      .filter(d => d.is_active !== false && d.driver_status !== 'off_duty')
                      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                      .map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Customer</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" /></div>
              <div><Label className="text-xs">Phone</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="05x" /></div>
            </div>
            <div><Label className="text-xs">Address</Label><Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} /></div>

            {/* Cart items */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {cart.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Tap products to add</p>}
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1">
                  <span className="flex-1 text-xs font-medium truncate">{item.name}</span>
                  <button onClick={() => changeQty(item.product_id, -1)} className="w-5 h-5 flex items-center justify-center rounded bg-muted"><Minus className="w-3 h-3" /></button>
                  <span className="text-xs w-4 text-center">{item.qty}</span>
                  <button onClick={() => changeQty(item.product_id, 1)} className="w-5 h-5 flex items-center justify-center rounded bg-primary text-white"><Plus className="w-3 h-3" /></button>
                  <span className="text-xs font-semibold w-12 text-right">{item.total} SAR</span>
                  <button onClick={() => removeItem(item.product_id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Delivery Fee</Label><Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} /></div>
              <div><Label className="text-xs">Discount</Label><Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-xs">Payment</Label>
              <div className="flex gap-2 mt-1">
                {['cash', 'network', 'credit'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${paymentMethod === m ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>

            {/* Total */}
            <div className="bg-primary/5 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">{total.toFixed(2)} SAR</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Order'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
