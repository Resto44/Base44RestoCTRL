import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ShoppingCart, Search, Star, Heart, Plus, Minus, X, ChevronRight,
  MapPin, Clock, CheckCircle2, Bike, ChefHat, Package, ArrowLeft,
  Truck, CreditCard, Wallet, Phone, Home
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Burgers', 'Pizza', 'Salads', 'Drinks', 'Desserts', 'Sides'];

const MOCK_PRODUCTS = [
  { id: '1', name: 'Classic Burger', price: 12.99, category: 'Burgers', rating: 4.8, reviews: 124, image: '🍔', description: 'Juicy beef patty with fresh vegetables', popular: true },
  { id: '2', name: 'Margherita Pizza', price: 15.99, category: 'Pizza', rating: 4.7, reviews: 89, image: '🍕', description: 'Classic tomato sauce with mozzarella', popular: true },
  { id: '3', name: 'Caesar Salad', price: 9.99, category: 'Salads', rating: 4.5, reviews: 67, image: '🥗', description: 'Fresh romaine with caesar dressing' },
  { id: '4', name: 'Coca Cola', price: 2.99, category: 'Drinks', rating: 4.9, reviews: 200, image: '🥤', description: 'Ice cold refreshment' },
  { id: '5', name: 'Chocolate Cake', price: 6.99, category: 'Desserts', rating: 4.9, reviews: 156, image: '🍰', description: 'Rich chocolate layer cake', popular: true },
  { id: '6', name: 'French Fries', price: 4.99, category: 'Sides', rating: 4.6, reviews: 203, image: '🍟', description: 'Crispy golden fries' },
];

function ProductCard({ product, onAdd, isFavorite, onToggleFavorite }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all active:scale-[0.98]">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-3xl shrink-0">
            {product.image}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{product.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{product.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[11px] font-medium">{product.rating}</span>
                  <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
                  {product.popular && <Badge className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-0">Popular</Badge>}
                </div>
              </div>
              <button onClick={() => onToggleFavorite(product.id)} className="shrink-0 p-1">
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-bold text-primary">${product.price.toFixed(2)}</span>
              <Button size="sm" className="h-7 w-7 p-0 rounded-full" onClick={() => onAdd(product)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CartItem({ item, onAdd, onRemove }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <span className="text-2xl">{item.image}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{item.name}</p>
        <p className="text-xs text-primary font-medium">${(item.price * item.qty).toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onRemove(item.id)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
        <button onClick={() => onAdd(item)} className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Plus className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}

const ORDER_TRACK_STEPS = [
  { key: 'placed',    label: 'Order Placed',      icon: CheckCircle2, done: true },
  { key: 'confirmed', label: 'Order Confirmed',    icon: Package,      done: true },
  { key: 'preparing', label: 'Being Prepared',     icon: ChefHat,      done: false },
  { key: 'delivery',  label: 'Out for Delivery',   icon: Bike,         done: false },
  { key: 'delivered', label: 'Delivered',           icon: Home,         done: false },
];

export default function OnlineOrdering() {
  const { t, currency } = useLanguage();
  const [tab, setTab] = useState('menu');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const filteredProducts = useMemo(() =>
    MOCK_PRODUCTS.filter(p =>
      (selectedCategory === 'All' || p.category === selectedCategory) &&
      (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
    ),
    [selectedCategory, search]
  );

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing?.qty === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const placeOrder = () => {
    setOrderPlaced(true);
    setCart([]);
    setShowCheckout(false);
    setTab('tracking');
    toast.success('Order placed successfully!');
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('online_ordering')}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3" />
            <span>Main Branch</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>30-45 min</span>
          </div>
        </div>
        <button onClick={() => setShowCart(true)} className="relative p-2 rounded-xl bg-primary/10">
          <ShoppingCart className="w-5 h-5 text-primary" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="menu" className="text-xs">{t('menu_page')}</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs">{t('order_tracking')}</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">{t('order_history')}</TabsTrigger>
        </TabsList>

        {/* Menu Tab */}
        <TabsContent value="menu" className="mt-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search') + '...'}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Popular section */}
          {selectedCategory === 'All' && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">⭐ Popular</p>
              <div className="space-y-2">
                {filteredProducts.filter(p => p.popular).map(p => (
                  <ProductCard key={p.id} product={p} onAdd={addToCart} isFavorite={favorites.has(p.id)} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            </div>
          )}

          {/* All products */}
          <div>
            {selectedCategory !== 'All' && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{selectedCategory}</p>
            )}
            <div className="space-y-2">
              {filteredProducts.filter(p => selectedCategory !== 'All' || !p.popular).map(p => (
                <ProductCard key={p.id} product={p} onAdd={addToCart} isFavorite={favorites.has(p.id)} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Order Tracking Tab */}
        <TabsContent value="tracking" className="mt-3">
          {!orderPlaced ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_data')}</p>
              <p className="text-xs mt-1">Place an order to track it here</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bike className="w-4 h-4 text-primary" />
                  Order #1234 — Out for Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                  {ORDER_TRACK_STEPS.map((step, i) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        step.done ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {i < ORDER_TRACK_STEPS.length - 1 && (
                          <div className={`w-0.5 h-6 ml-3.5 mt-1 ${step.done ? 'bg-primary' : 'bg-border'}`} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="history" className="mt-3">
          <div className="text-center py-10 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('no_data')}</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold">{t('cart')} ({cartCount})</h2>
              <button onClick={() => setShowCart(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>
              ) : (
                <>
                  {cart.map(item => (
                    <CartItem key={item.id} item={item} onAdd={addToCart} onRemove={removeFromCart} />
                  ))}
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-semibold text-emerald-600">Free</span>
                    </div>
                    <div className="flex justify-between text-base font-bold mb-4">
                      <span>{t('total')}</span>
                      <span className="text-primary">${cartTotal.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-11"
                      onClick={() => { setShowCart(false); setShowCheckout(true); }}
                    >
                      {t('checkout')} — ${cartTotal.toFixed(2)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('checkout')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Address</p>
              <Input placeholder="Street address" className="h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Cash', icon: Wallet },
                  { label: 'Card', icon: CreditCard },
                  { label: 'Online', icon: Phone },
                ].map(m => (
                  <button key={m.label} className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                    <m.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex justify-between text-sm font-bold">
                <span>{t('total')}</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <Button className="w-full h-11" onClick={placeOrder}>
              Place Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
