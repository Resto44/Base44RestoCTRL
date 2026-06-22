/**
 * Online Ordering V2 — Customer App / Web Portal
 * Smart Restaurant ERP — Integrated Module
 * Routes: /order, /order/branch/:branchSlug, /order/track/:orderId
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ShoppingCart, Search, Star, Heart, Plus, Minus, X, ChevronRight,
  MapPin, Clock, CheckCircle2, Bike, ChefHat, Package, ArrowLeft,
  Truck, CreditCard, Wallet, Phone, Home, Zap, Tag, Gift, Flame,
  Award, Sparkles, Filter, ChevronDown, Info, AlertCircle, RefreshCw,
  Navigation, User, LogOut, Settings, Bell, QrCode, Share2, Download,
  MessageCircle, RotateCcw
} from 'lucide-react';
import {
  useCart, usePlaceOrder, useOrderRealtime, usePromoCode, useCustomerOrders
} from '@/hooks/useOnlineOrdering';
import { PAYMENT_METHODS, ORDER_STATUS } from '@/lib/onlineOrderingService';

// ── Status Config ──────────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'pending',       label_en: 'Order Received',   label_ar: 'تم استلام الطلب',   icon: CheckCircle2,  color: 'text-slate-500' },
  { key: 'accepted',      label_en: 'Confirmed',         label_ar: 'تم التأكيد',         icon: CheckCircle2,  color: 'text-blue-500' },
  { key: 'preparing',     label_en: 'Preparing',         label_ar: 'جاري التحضير',       icon: ChefHat,       color: 'text-amber-500' },
  { key: 'cooking',       label_en: 'Cooking',           label_ar: 'جاري الطهي',         icon: Flame,         color: 'text-orange-500' },
  { key: 'ready',         label_en: 'Ready',             label_ar: 'جاهز',               icon: Package,       color: 'text-green-500' },
  { key: 'assigned',      label_en: 'Driver Assigned',   label_ar: 'تم تعيين السائق',    icon: Bike,          color: 'text-blue-500' },
  { key: 'picked_up',     label_en: 'Picked Up',         label_ar: 'تم الاستلام',        icon: Truck,         color: 'text-indigo-500' },
  { key: 'on_the_way',    label_en: 'On the Way',        label_ar: 'في الطريق',          icon: Bike,          color: 'text-primary' },
  { key: 'arrived',       label_en: 'Driver Near You',   label_ar: 'السائق قريب',        icon: Navigation,    color: 'text-purple-500' },
  { key: 'delivered',     label_en: 'Delivered',         label_ar: 'تم التوصيل',         icon: Home,          color: 'text-emerald-500' },
];

// ── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product, onAdd, isFavorite, onToggleFavorite, lang }) {
  const name = lang === 'ar' ? (product.name_ar || product.name) : product.name;
  const desc = lang === 'ar' ? (product.description_ar || product.description) : product.description;
  const price = product.price || product.default_price || 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
      <div className="relative">
        {product.image_url ? (
          <img src={product.image_url} alt={name} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
            <ChefHat className="w-12 h-12 text-orange-300" />
          </div>
        )}
        {product.is_popular && (
          <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-xs">Popular</Badge>
        )}
        {product.is_new && (
          <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs">New</Badge>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(product.id); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
        </button>
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm truncate">{name}</h3>
        {desc && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-primary">{price.toFixed(2)} SAR</span>
          <Button size="sm" onClick={() => onAdd(product)} className="h-8 w-8 p-0 rounded-full">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cart Drawer ────────────────────────────────────────────────────────────
function CartDrawer({ items, subtotal, onAdd, onRemove, onCheckout, onClose, lang }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background w-full max-w-sm flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {lang === 'ar' ? 'سلة التسوق' : 'Your Cart'}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{lang === 'ar' ? 'السلة فارغة' : 'Cart is empty'}</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit_price.toFixed(2)} SAR</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onRemove(item.product_id, item.modifiers)}
                    className="w-7 h-7 rounded-full bg-background border flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
                  <button onClick={() => onAdd(item, 1)}
                    className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm font-bold text-primary w-16 text-right">
                  {(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t space-y-3">
            <div className="flex justify-between font-bold">
              <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span>{subtotal.toFixed(2)} SAR</span>
            </div>
            <Button className="w-full" size="lg" onClick={onCheckout}>
              {lang === 'ar' ? 'إتمام الطلب' : 'Proceed to Checkout'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Checkout Dialog ────────────────────────────────────────────────────────
function CheckoutDialog({ open, onClose, cart, onPlaceOrder, customer, lang }) {
  const [step, setStep] = useState(1); // 1=address, 2=payment, 3=confirm
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [promoCode, setPromoCode] = useState('');
  const [notes, setNotes] = useState('');
  const [walletAmount, setWalletAmount] = useState(0);
  const { promoResult, isValidating, validate: validatePromo, clear: clearPromo } = usePromoCode();

  const { data: addresses = [] } = useQuery({
    queryKey: ['customer_addresses', customer?.id],
    queryFn: () => base44.entities.CustomerAddress.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const deliveryFee = 10;
  const tax = cart.subtotal * 0.15;
  const discount = promoResult?.valid ? promoResult.discount : 0;
  const total = cart.subtotal + deliveryFee + tax - discount - walletAmount;

  const handlePromoValidate = () => validatePromo(promoCode, cart.subtotal);

  const handlePlaceOrder = () => {
    if (!selectedAddress) { toast.error('Please select a delivery address'); return; }
    onPlaceOrder({
      items: cart.items,
      deliveryAddressId: selectedAddress,
      paymentMethod,
      promoCode: promoResult?.valid ? promoCode : null,
      walletAmount,
      notes,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lang === 'ar' ? 'إتمام الطلب' : 'Checkout'}</DialogTitle>
        </DialogHeader>
        <Tabs value={String(step)} onValueChange={v => setStep(Number(v))}>
          <TabsList className="w-full">
            <TabsTrigger value="1" className="flex-1">
              {lang === 'ar' ? 'العنوان' : 'Address'}
            </TabsTrigger>
            <TabsTrigger value="2" className="flex-1">
              {lang === 'ar' ? 'الدفع' : 'Payment'}
            </TabsTrigger>
            <TabsTrigger value="3" className="flex-1">
              {lang === 'ar' ? 'تأكيد' : 'Confirm'}
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Address */}
          <TabsContent value="1" className="space-y-3 mt-4">
            <h3 className="font-semibold">{lang === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}</h3>
            {addresses.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No saved addresses. Please add one.</p>
              </div>
            ) : (
              addresses.map(addr => (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddress(addr.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAddress === addr.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{addr.label || 'Address'}</p>
                      <p className="text-xs text-muted-foreground">{addr.address_line1}, {addr.city}</p>
                    </div>
                    {addr.is_default && <Badge className="ml-auto text-xs">Default</Badge>}
                  </div>
                </div>
              ))
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Delivery instructions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <Button className="w-full" onClick={() => setStep(2)} disabled={!selectedAddress}>
              {lang === 'ar' ? 'التالي' : 'Next: Payment'}
            </Button>
          </TabsContent>

          {/* Step 2: Payment */}
          <TabsContent value="2" className="space-y-3 mt-4">
            <h3 className="font-semibold">{lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</h3>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    paymentMethod === pm.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-xl">{pm.icon}</span>
                  <p className="text-xs font-medium mt-1">{lang === 'ar' ? pm.label_ar : pm.label_en}</p>
                </button>
              ))}
            </div>

            {/* Promo Code */}
            <div className="space-y-2">
              <Label>Promo Code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value); clearPromo(); }}
                />
                <Button variant="outline" onClick={handlePromoValidate} disabled={isValidating || !promoCode}>
                  {isValidating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {promoResult && (
                <p className={`text-xs ${promoResult.valid ? 'text-green-600' : 'text-red-500'}`}>
                  {promoResult.valid ? `✓ Discount: ${promoResult.discount?.toFixed(2)} SAR` : promoResult.message}
                </p>
              )}
            </div>

            {/* Wallet */}
            {(customer?.cashback_wallet || 0) > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium">Wallet Balance: {customer.cashback_wallet?.toFixed(2)} SAR</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={walletAmount > 0}
                    onChange={e => setWalletAmount(e.target.checked ? Math.min(customer.cashback_wallet, total) : 0)}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => setStep(3)}>
              {lang === 'ar' ? 'التالي' : 'Next: Review Order'}
            </Button>
          </TabsContent>

          {/* Step 3: Confirm */}
          <TabsContent value="3" className="space-y-3 mt-4">
            <h3 className="font-semibold">{lang === 'ar' ? 'مراجعة الطلب' : 'Order Summary'}</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cart.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity}</span>
                  <span className="font-medium">{(item.unit_price * item.quantity).toFixed(2)} SAR</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{cart.subtotal.toFixed(2)} SAR</span></div>
              <div className="flex justify-between"><span>Delivery Fee</span><span>{deliveryFee.toFixed(2)} SAR</span></div>
              <div className="flex justify-between"><span>VAT (15%)</span><span>{tax.toFixed(2)} SAR</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{discount.toFixed(2)} SAR</span></div>}
              {walletAmount > 0 && <div className="flex justify-between text-amber-600"><span>Wallet</span><span>-{walletAmount.toFixed(2)} SAR</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span><span className="text-primary">{Math.max(0, total).toFixed(2)} SAR</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
              <span className="text-lg">{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.icon}</span>
              <span>{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label_en}</span>
            </div>
            <Button className="w-full" size="lg" onClick={handlePlaceOrder}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {lang === 'ar' ? 'تأكيد الطلب' : 'Place Order'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Order Tracking View ────────────────────────────────────────────────────
function OrderTrackingView({ orderId, onBack, lang }) {
  const { order, tracking, driverLocation } = useOrderRealtime(orderId);

  const currentStepIndex = useMemo(() => {
    if (!order) return 0;
    return STATUS_STEPS.findIndex(s => s.key === order.status);
  }, [order]);

  if (!order) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-bold text-lg">{lang === 'ar' ? 'تتبع الطلب' : 'Track Order'}</h2>
          <p className="text-sm text-muted-foreground">{order.order_number}</p>
        </div>
        <Badge className="ml-auto" variant={order.status === ORDER_STATUS.DELIVERED ? 'default' : 'secondary'}>
          {STATUS_STEPS.find(s => s.key === order.status)?.label_en || order.status}
        </Badge>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {STATUS_STEPS.slice(0, currentStepIndex + 2).map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className={`flex items-center gap-3 ${isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isCurrent ? 'bg-primary text-white' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-muted'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                      {lang === 'ar' ? step.label_ar : step.label_en}
                    </p>
                    {tracking.find(t => t.status === step.key) && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tracking.find(t => t.status === step.key).created_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                  {isCurrent && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Driver Info */}
      {order.driver_id && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{order.driver_name || 'Your Driver'}</p>
                  <p className="text-xs text-muted-foreground">
                    {driverLocation ? 'Live tracking active' : 'Tracking unavailable'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Summary */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">{lang === 'ar' ? 'ملخص الطلب' : 'Order Summary'}</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{order.total_amount?.toFixed(2)} SAR</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <span>{PAYMENT_METHODS.find(p => p.id === order.payment_method)?.label_en || order.payment_method}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Customer App ──────────────────────────────────────────────────────
export default function OnlineOrderingV2() {
  const { lang } = useLanguage?.() || { lang: 'en' };
  const { user } = useAuth?.() || {};
  const { restaurant } = useTenant?.() || {};
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [view, setView] = useState('menu'); // 'menu' | 'tracking' | 'history' | 'profile'
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState(new Set());

  const cart = useCart();
  const placeOrderMutation = usePlaceOrder();

  // Load menu products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['menu_products', restaurant?.id],
    queryFn: () => base44.entities.MenuProduct.filter({ restaurant_id: restaurant?.id, is_available: true }),
    enabled: !!restaurant?.id,
  });

  // Load categories
  const { data: categories = [] } = useQuery({
    queryKey: ['online_order_categories', restaurant?.id],
    queryFn: () => base44.entities.OnlineOrderCategory.filter({ restaurant_id: restaurant?.id }),
    enabled: !!restaurant?.id,
  });

  // Load customer profile
  const { data: customerList = [] } = useQuery({
    queryKey: ['customer_profile', user?.email],
    queryFn: () => base44.entities.Customer.filter({ email: user?.email }),
    enabled: !!user?.email,
  });
  const customer = customerList[0] || null;

  // Load customer orders
  const { data: customerOrders = [] } = useCustomerOrders(customer?.id);

  // Filter products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') list = list.filter(p => p.category_id === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.name_ar || '').includes(q));
    }
    return list;
  }, [products, selectedCategory, searchQuery]);

  const handleAddToCart = useCallback((product) => {
    cart.addItem(product);
    toast.success(`${product.name} added to cart`);
  }, [cart]);

  const handleToggleFavorite = useCallback((productId) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const handlePlaceOrder = useCallback(async (orderData) => {
    if (!customer?.id) { toast.error('Please log in to place an order'); return; }
    try {
      const order = await placeOrderMutation.mutateAsync({
        restaurantId: restaurant?.id,
        branchId: restaurant?.branches?.[0]?.id,
        customerId: customer.id,
        orgId: user?.email,
        ...orderData,
      });
      cart.clearCart();
      toast.success(`Order ${order.order_number} placed successfully!`);
      setTrackingOrderId(order.id);
      setView('tracking');
    } catch (err) {
      toast.error('Failed to place order. Please try again.');
    }
  }, [customer, restaurant, user, placeOrderMutation, cart]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {restaurant?.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className="w-8 h-8 rounded-full object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{restaurant?.name || 'Restaurant'}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lang === 'ar' ? 'توصيل سريع' : 'Fast Delivery'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('history')}
              className="p-2 rounded-full hover:bg-muted relative"
            >
              <Package className="w-5 h-5" />
              {customerOrders.filter(o => ['pending','preparing','on_the_way'].includes(o.status)).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => setShowCart(true)}
              className="p-2 rounded-full hover:bg-muted relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                  {cart.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-24">
        {view === 'tracking' && trackingOrderId ? (
          <OrderTrackingView
            orderId={trackingOrderId}
            onBack={() => setView('menu')}
            lang={lang}
          />
        ) : view === 'history' ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('menu')} className="p-2 rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-lg">{lang === 'ar' ? 'طلباتي' : 'My Orders'}</h2>
            </div>
            {customerOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{lang === 'ar' ? 'لا توجد طلبات' : 'No orders yet'}</p>
              </div>
            ) : (
              customerOrders.map(order => (
                <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setTrackingOrderId(order.id); setView('tracking'); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">{order.order_number}</span>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {STATUS_STEPS.find(s => s.key === order.status)?.label_en || order.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{format(new Date(order.created_date), 'MMM d, yyyy HH:mm')}</span>
                      <span className="font-medium text-foreground">{order.total_amount?.toFixed(2)} SAR</span>
                    </div>
                    {['pending','accepted','preparing','cooking','ready','assigned','picked_up','on_the_way','arrived'].includes(order.status) && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        Live tracking available
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={lang === 'ar' ? 'ابحث عن منتج...' : 'Search menu...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === 'all' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {lang === 'ar' ? 'الكل' : 'All'}
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {lang === 'ar' ? (cat.name_ar || cat.name) : cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{lang === 'ar' ? 'لا توجد منتجات' : 'No products found'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleAddToCart}
                    isFavorite={favorites.has(product.id)}
                    onToggleFavorite={handleToggleFavorite}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Cart Button */}
      {cart.itemCount > 0 && view === 'menu' && (
        <div className="fixed bottom-6 left-4 right-4 z-30 max-w-lg mx-auto">
          <Button
            className="w-full h-14 shadow-xl rounded-2xl text-base font-semibold"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {lang === 'ar' ? `عرض السلة (${cart.itemCount})` : `View Cart (${cart.itemCount})`}
            <span className="ml-auto">{cart.subtotal.toFixed(2)} SAR</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <CartDrawer
          items={cart.items}
          subtotal={cart.subtotal}
          onAdd={(item, qty) => cart.addItem({ id: item.product_id, name: item.name, price: item.unit_price }, qty)}
          onRemove={cart.removeItem}
          onCheckout={() => { setShowCart(false); setShowCheckout(true); }}
          onClose={() => setShowCart(false)}
          lang={lang}
        />
      )}

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        onPlaceOrder={handlePlaceOrder}
        customer={customer}
        lang={lang}
      />
    </div>
  );
}
