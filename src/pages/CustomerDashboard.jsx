import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ShoppingCart, Home, ClipboardList, MapPin, Plus, Minus, X,
  ChefHat, Bike, CheckCircle2, Clock, Search, LogOut
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:          { label: 'Order Received',      icon: Clock,         color: 'text-slate-500',   bg: 'bg-slate-100' },
  preparing:        { label: 'Being Prepared',       icon: ChefHat,       color: 'text-amber-600',   bg: 'bg-amber-100' },
  ready:            { label: 'Ready for Pickup',     icon: CheckCircle2,  color: 'text-blue-600',    bg: 'bg-blue-100' },
  out_for_delivery: { label: 'Out for Delivery',     icon: Bike,          color: 'text-primary',     bg: 'bg-primary/10' },
  delivered:        { label: 'Delivered',            icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-100' },
  cancelled:        { label: 'Cancelled',            icon: X,             color: 'text-red-500',     bg: 'bg-red-50' },
};

function CartItem({ item, onAdd, onRemove }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.unit_price} SAR × {item.qty}</p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <button onClick={() => onRemove(item)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
        <button onClick={() => onAdd(item)} className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20">
          <Plus className="w-3.5 h-3.5 text-primary" />
        </button>
        <span className="text-sm font-bold text-primary w-16 text-right">{(item.unit_price * item.qty).toFixed(2)} SAR</span>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('menu');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // Menu products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['customer-menu'],
    queryFn: () => base44.entities.MenuProduct.filter({ is_active: true }, 'name', 300),
  });

  // My orders
  const { data: myOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['customer-orders', user?.email],
    queryFn: () => base44.entities.DeliveryOrder.filter(
      { customer_phone: user?.email },
      '-created_date',
      50
    ),
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  const categories = ['all', ...new Set(products.map(p => p.category || 'Other').filter(Boolean))];
  const filtered = products.filter(p => {
    const matchCat  = filterCat === 'all' || (p.category || 'Other') === filterCat;
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.name_ar?.includes(search);
    return matchCat && matchSearch;
  });

  // Cart helpers
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unit_price } : i);
      return [...prev, { product_id: product.id, name: product.name, qty: 1, unit_price: product.default_price, total: product.default_price }];
    });
  };

  const removeFromCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(i => i.product_id !== item.product_id);
      return prev.map(i => i.product_id === item.product_id ? { ...i, qty: i.qty - 1, total: (i.qty - 1) * i.unit_price } : i);
    });
  };

  const cartQty = (productId) => cart.find(i => i.product_id === productId)?.qty || 0;
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const placeOrderMutation = useMutation({
    mutationFn: () => {
      if (!address.trim()) throw new Error('Please enter your delivery address');
      if (cart.length === 0) throw new Error('Cart is empty');
      const now = new Date();
      const orderNum = `ORD-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;
      return base44.entities.DeliveryOrder.create({
        order_number: orderNum,
        branch: products[0]?.branch || 'main',
        driver_id: '',
        driver_name: '',
        status: 'pending',
        customer_name: user?.full_name || 'Customer',
        customer_phone: user?.email || phone,
        customer_address: address,
        items_json: JSON.stringify(cart),
        subtotal: cartTotal,
        delivery_fee: 0,
        discount: 0,
        total_amount: cartTotal,
        payment_method: payMethod,
        payment_collected: false,
        notes,
      });
    },
    onSuccess: () => {
      toast.success('🎉 Order placed successfully!');
      setCart([]);
      setAddress('');
      setNotes('');
      setShowCheckout(false);
      setTab('orders');
      qc.invalidateQueries({ queryKey: ['customer-orders'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const activeOrders = myOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-base font-black">🍽️ Order Food</h1>
            <p className="text-xs text-muted-foreground">Hello, {user?.full_name || 'Guest'}</p>
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && tab === 'menu' && (
              <button
                onClick={() => setShowCheckout(true)}
                className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-2 rounded-full shadow-md active:scale-95 transition-transform"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {cartCount} · {cartTotal.toFixed(0)} SAR
              </button>
            )}
            <Button size="sm" variant="ghost" onClick={() => base44.auth.logout('/auth')}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          {/* Active order banner */}
          {activeOrders.length > 0 && (
            <button
              onClick={() => setTab('orders')}
              className="w-full mb-4 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-sm font-bold text-primary">{activeOrders.length} Active Order{activeOrders.length > 1 ? 's' : ''}</span>
              </div>
              <span className="text-xs text-primary font-medium">Track →</span>
            </button>
          )}

          {/* Bottom nav tabs */}
          <TabsList className="grid grid-cols-2 w-full mb-4 h-12 fixed bottom-0 left-0 right-0 z-30 rounded-none border-t bg-background max-w-lg mx-auto">
            <TabsTrigger value="menu" className="flex flex-col items-center gap-0.5 text-[11px] h-full relative">
              <Home className="w-4 h-4" />Menu
              {cartCount > 0 && (
                <span className="absolute top-1 right-6 w-4 h-4 bg-primary text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex flex-col items-center gap-0.5 text-[11px] h-full relative">
              <ClipboardList className="w-4 h-4" />My Orders
              {activeOrders.length > 0 && (
                <span className="absolute top-1 right-6 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                  {activeOrders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* MENU TAB */}
          <TabsContent value="menu" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="pl-9 rounded-xl"
              />
            </div>

            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-medium ${filterCat === c ? 'bg-primary text-white border-primary' : 'border-border bg-background hover:bg-muted'}`}>
                  {c}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading menu…</div>
            )}

            {/* Products grid */}
            <div className="space-y-3">
              {filtered.map(p => {
                const qty = cartQty(p.id);
                return (
                  <Card key={p.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl">🍽️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{p.name}</p>
                        {p.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{p.name_ar}</p>}
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
                        <p className="text-primary font-black text-base mt-1">{p.default_price} SAR</p>
                      </div>
                      <div className="shrink-0">
                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(p)}
                            className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-md"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => removeFromCart({ product_id: p.id })} className="w-7 h-7 bg-muted rounded-full flex items-center justify-center">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-black w-5 text-center">{qty}</span>
                            <button onClick={() => addToCart(p)} className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5 text-primary" />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <p className="text-2xl mb-2">🔍</p>
                  No items found
                </div>
              )}
            </div>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="space-y-3">
            <h2 className="font-bold text-base">My Orders</h2>
            {myOrders.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No orders yet</p>
                <p className="text-xs mt-1">Browse the menu and place your first order!</p>
                <Button className="mt-4" onClick={() => setTab('menu')}>Browse Menu</Button>
              </div>
            )}
            {myOrders.map(o => {
              const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const items = (() => { try { return JSON.parse(o.items_json || '[]'); } catch { return []; } })();
              return (
                <Card key={o.id} className="overflow-hidden">
                  <div className={`h-1 ${o.status === 'delivered' ? 'bg-emerald-500' : o.status === 'cancelled' ? 'bg-red-400' : o.status === 'out_for_delivery' ? 'bg-primary' : 'bg-amber-400'}`} />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.created_date ? format(new Date(o.created_date), 'MMM d, h:mm a') : ''}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5">
                      {items.map((item, i) => (
                        <p key={i}>× {item.qty} {item.name}</p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[160px]">{o.customer_address}</span>
                      </div>
                      <p className="font-black text-primary text-sm">{o.total_amount} SAR</p>
                    </div>

                    {o.driver_name && o.status === 'out_for_delivery' && (
                      <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-2">
                        <Bike className="w-4 h-4 text-primary animate-pulse" />
                        <p className="text-xs font-medium">Driver: <strong>{o.driver_name}</strong> is on the way!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cart items */}
            <div className="divide-y">
              {cart.map(item => (
                <CartItem key={item.product_id} item={item} onAdd={() => addToCart({ id: item.product_id, price: item.unit_price, name: item.name })} onRemove={() => removeFromCart(item)} />
              ))}
            </div>

            <div className="flex items-center justify-between font-black text-base border-t pt-3">
              <span>Total</span>
              <span className="text-primary">{cartTotal.toFixed(2)} SAR</span>
            </div>

            {/* Delivery details */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Delivery Address *</Label>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, building, apartment…"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Special requests…"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <div className="flex gap-2 mt-1">
                  {['cash', 'network'].map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${payMethod === m ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                      {m === 'cash' ? '💵 Cash' : '💳 Card'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-bold"
              onClick={() => placeOrderMutation.mutate()}
              disabled={placeOrderMutation.isPending || cart.length === 0}
            >
              {placeOrderMutation.isPending ? 'Placing Order…' : `Place Order · ${cartTotal.toFixed(0)} SAR`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}