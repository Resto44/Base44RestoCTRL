import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sparkles, Brain, TrendingUp, Star, Heart, ShoppingCart, MessageSquare,
  Phone, Send, Bot, User, RefreshCw, Zap, Target, BarChart3,
  Clock, Award, ChevronRight, Plus, Package
} from 'lucide-react';
import { toast } from 'sonner';

// ── AI Chat Message ───────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const isBot = msg.role === 'assistant';
  return (
    <div className={`flex gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${isBot ? 'bg-primary/10' : 'bg-muted'}`}>
        {isBot ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isBot ? 'bg-muted rounded-tl-sm' : 'bg-primary text-white rounded-tr-sm'}`}>
        {msg.content}
      </div>
    </div>
  );
}

// ── WhatsApp Order Simulator ──────────────────────────────────────────────────
function WhatsAppOrderFlow({ products, currency, lang, onAddToCart }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: `👋 Welcome! I'm your AI ordering assistant.\n\nYou can order by typing:\n• "I want a burger"\n• "Show me pizza"\n• "What's popular today?"\n• "Order 2 chicken wraps"` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const processOrder = useCallback(async (userMessage) => {
    setLoading(true);
    const userMsg = { id: Date.now(), role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Build product context
      const productList = products.slice(0, 20).map(p => `${p[`name_${lang}`] || p.name_ar || p.name}: ${currency}${p.default_price}`).join('\n');

      const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mqubwgbppncldyiicbtu.supabase.co';
      const _supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xdWJ3Z2JwcG5jbGR5aWljYnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjUyNDcsImV4cCI6MjA5NTgwMTI0N30.lRWj1iE26Hkv0zlnT5d5ZDMthrVidq8-Qysg7jZl59Q';
      const response = await fetch(`${_supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_supabaseKey}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are a friendly restaurant ordering assistant. Available products:\n${productList}\n\nHelp customers order. When they want to order something, confirm the item and price. Keep responses short and friendly. Use emojis.` },
            ...messages.filter(m => m.id > 1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ]
        })
      });

      let botContent = '';
      if (response.ok) {
        const data = await response.json();
        botContent = data.choices?.[0]?.message?.content || data.content || '';
      }

      if (!botContent) {
        // Fallback: simple keyword matching
        const lower = userMessage.toLowerCase();
        const matchedProduct = products.find(p => {
          const name = (p[`name_${lang}`] || p.name_ar || p.name || '').toLowerCase();
          return lower.includes(name) || name.includes(lower.split(' ').find(w => w.length > 3) || '');
        });

        if (matchedProduct) {
          const pName = matchedProduct[`name_${lang}`] || matchedProduct.name_ar || matchedProduct.name;
          botContent = `Great choice! 🎉 **${pName}** for ${currency}${matchedProduct.default_price}.\n\nShall I add it to your cart?`;
          // Auto-suggest add to cart
          setTimeout(() => {
            onAddToCart(matchedProduct);
          }, 1000);
        } else if (lower.includes('popular') || lower.includes('best')) {
          const popular = products.filter(p => p.is_popular || p.is_best_seller).slice(0, 3);
          botContent = popular.length > 0
            ? `🔥 Our most popular items:\n${popular.map(p => `• ${p[`name_${lang}`] || p.name_ar || p.name}: ${currency}${p.default_price}`).join('\n')}`
            : `Our menu has ${products.length} items. What are you in the mood for? 😊`;
        } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('مرحبا')) {
          botContent = `Hello! 👋 Welcome to our restaurant!\n\nWhat would you like to order today? I can help you find the perfect meal! 🍽️`;
        } else {
          botContent = `I'd love to help you order! 😊\n\nTry asking:\n• "Show me burgers"\n• "What's popular?"\n• "I want pizza"\n\nOr browse our menu tab!`;
        }
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: botContent }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: `Sorry, I'm having trouble right now. Please try again! 🙏` }]);
    }
    setLoading(false);
  }, [messages, products, currency, lang, onAddToCart]);

  const handleSend = () => {
    if (!input.trim()) return;
    processOrder(input.trim());
    setInput('');
  };

  const quickReplies = ['What\'s popular?', 'Show me deals', 'I\'m hungry 🍔', 'Surprise me!'];

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-muted/30 rounded-xl">
        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted px-3 py-2 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Replies */}
      <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-hide">
        {quickReplies.map(qr => (
          <button key={qr} onClick={() => processOrder(qr)}
            className="shrink-0 px-3 py-1.5 bg-muted rounded-full text-xs font-medium hover:bg-primary/10 transition-colors">
            {qr}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your order..."
          className="flex-1 h-10 text-sm rounded-xl"
          disabled={loading}
        />
        <Button className="h-10 w-10 p-0 rounded-xl" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── AI Recommendations Panel ──────────────────────────────────────────────────
function AIRecommendationsPanel({ products, orders, customer, currency, lang, onAddToCart }) {
  const { t } = useLanguage();

  // Compute recommendations based on order history
  const recommendations = React.useMemo(() => {
    if (!products.length) return [];

    // Get ordered product IDs from history
    const orderedIds = new Set(orders.flatMap(o => (o.items || []).map(i => i.product_id)));

    // Score products
    const scored = products.map(p => {
      let score = 0;
      if (p.is_popular) score += 30;
      if (p.is_featured) score += 20;
      if (p.is_best_seller) score += 25;
      if (p.is_new) score += 15;
      if (!orderedIds.has(p.id)) score += 10; // Not yet tried
      // Loyalty tier bonus
      if (customer?.loyalty_tier === 'Gold' || customer?.loyalty_tier === 'Platinum') score += 5;
      return { ...p, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [products, orders, customer]);

  const trendingProducts = products.filter(p => p.is_popular || p.is_best_seller).slice(0, 4);
  const newProducts = products.filter(p => p.is_new).slice(0, 4);

  const ProductMiniCard = ({ product }) => {
    const name = product[`name_${lang}`] || product.name_ar || product.name || '';
    return (
      <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
        {product.image_url ? (
          <img src={product.image_url} alt={name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-xs text-primary font-bold">{currency}{parseFloat(product.default_price || 0).toFixed(2)}</p>
        </div>
        <Button size="sm" className="h-7 w-7 p-0 rounded-lg shrink-0" onClick={() => onAddToCart(product)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Personalized */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            {customer ? `For ${customer.name?.split(' ')[0] || 'You'}` : 'Top Picks'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t('no_data')}</p>
          ) : (
            recommendations.map(p => <ProductMiniCard key={p.id} product={p} />)
          )}
        </CardContent>
      </Card>

      {/* Trending */}
      {trendingProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-orange-500" />Trending Now 🔥
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {trendingProducts.map(p => <ProductMiniCard key={p.id} product={p} />)}
          </CardContent>
        </Card>
      )}

      {/* New Items */}
      {newProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500" />New on Menu ✨
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {newProducts.map(p => <ProductMiniCard key={p.id} product={p} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIRecommendations() {
  const { t, currency, lang } = useLanguage();
  const { ownerFilter } = useTenant();
  const { user } = useAuth();
  const [tab, setTab] = useState('chat');
  const [cartCount, setCartCount] = useState(0);

  const { data: products = [] } = useQuery({
    queryKey: ['ai_products', ownerFilter],
    queryFn: () => base44.entities.Product.filter({ ...ownerFilter, is_active: true }, 'name', 100),
    enabled: !!ownerFilter?.created_by,
  });

  const { data: customer } = useQuery({
    queryKey: ['ai_customer', user?.email],
    queryFn: async () => {
      const r = await base44.entities.Customer.filter({ email: user?.email }, '-created_date', 1);
      return r?.[0] || null;
    },
    enabled: !!user?.email,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['ai_orders', customer?.id],
    queryFn: () => base44.entities.Order.filter({ customer_id: customer.id }, '-created_date', 20),
    enabled: !!customer?.id,
  });

  const handleAddToCart = useCallback((product) => {
    setCartCount(c => c + 1);
    const name = product[`name_${lang}`] || product.name_ar || product.name || '';
    toast.success(`${name} added to cart! 🛒`);
  }, [lang]);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t('ai_recommendations') || 'AI Assistant'}</h1>
            <p className="text-xs text-muted-foreground">{t('powered_by_ai') || 'Powered by AI'}</p>
          </div>
        </div>
        {cartCount > 0 && (
          <Badge className="bg-primary text-white">
            <ShoppingCart className="w-3 h-3 mr-1" />{cartCount} items
          </Badge>
        )}
      </div>

      {/* Customer Tier Banner */}
      {customer?.loyalty_tier && customer.loyalty_tier !== 'Bronze' && (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
          <Award className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs font-bold text-primary">{customer.loyalty_tier} Member</p>
            <p className="text-[10px] text-muted-foreground">Personalized recommendations just for you</p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-2 h-9">
          <TabsTrigger value="chat" className="text-xs">
            <MessageSquare className="w-3 h-3 mr-1.5" />{t('ai_chat') || 'AI Chat'}
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1.5" />{t('recommendations') || 'For You'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-3">
          <Card>
            <CardContent className="p-3">
              <WhatsAppOrderFlow
                products={products}
                currency={currency}
                lang={lang}
                onAddToCart={handleAddToCart}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-3">
          <AIRecommendationsPanel
            products={products}
            orders={orders}
            customer={customer}
            currency={currency}
            lang={lang}
            onAddToCart={handleAddToCart}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
