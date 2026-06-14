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

import { Progress } from '@/components/ui/progress';
import {
  Users, Search, Plus, Star, Crown, Heart, TrendingUp, DollarSign,
  Phone, Mail, MapPin, Calendar, ChevronRight, Award, Gift, CreditCard,
  ShoppingBag, Clock, AlertTriangle
} from 'lucide-react';

function CustomerCard({ customer, onClick }) {
  const { currency } = useLanguage();
  const isVIP = (customer.total_purchases || 0) > 1000;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-bold text-sm text-primary">
              {customer.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate">{customer.name}</p>
              {isVIP && <Crown className="w-3.5 h-3.5 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{customer.phone || customer.email || '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-primary">{currency}{(customer.total_purchases || 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerProfileModal({ customer, onClose }) {
  const { t, currency } = useLanguage();
  const [tab, setTab] = useState('overview');
  if (!customer) return null;
  const isVIP = (customer.total_purchases || 0) > 1000;
  const loyaltyPoints = Math.floor((customer.total_purchases || 0) / 10);

  return (
    <Dialog open={!!customer} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-sm text-primary">
                {customer.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                {customer.name}
                {isVIP && <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1">VIP</Badge>}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { key: 'overview', label: t('overview') },
            { key: 'orders', label: t('order_history') },
            { key: 'credit', label: t('credit_history') },
            { key: 'loyalty', label: t('loyalty') },
          ].map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === tb.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Purchases', value: `${currency}${(customer.total_purchases || 0).toLocaleString()}`, color: 'text-blue-600' },
                { label: 'Loyalty Points', value: loyaltyPoints, color: 'text-amber-600' },
                { label: 'Outstanding', value: `${currency}${(customer.outstanding || 0).toLocaleString()}`, color: 'text-red-500' },
                { label: 'Orders', value: customer.order_count || 0, color: 'text-green-600' },
              ].map(kpi => (
                <Card key={kpi.label}>
                  <CardContent className="p-3">
                    <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-3 space-y-2">
                {[
                  { label: 'Phone', value: customer.phone || '—', icon: Phone },
                  { label: 'Email', value: customer.email || '—', icon: Mail },
                  { label: 'Address', value: customer.address || '—', icon: MapPin },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                    <row.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-14 shrink-0">{row.label}</span>
                    <span className="text-xs font-medium truncate">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'loyalty' && (
          <div className="space-y-3">
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-4 text-center">
                <Award className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-700">{loyaltyPoints}</p>
                <p className="text-sm text-amber-600">Loyalty Points</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-amber-600 mb-1">
                    <span>Silver</span>
                    <span>Gold (500 pts)</span>
                  </div>
                  <Progress value={Math.min((loyaltyPoints / 500) * 100, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rewards Available</p>
                {[
                  { label: '10% Off Next Order', points: 100, icon: Gift },
                  { label: 'Free Delivery', points: 200, icon: ShoppingBag },
                  { label: 'Free Dessert', points: 150, icon: Heart },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <r.icon className="w-4 h-4 text-amber-500" />
                      <span className="text-sm">{r.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{r.points} pts</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {(tab === 'orders' || tab === 'credit') && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{t('no_data')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerManagement() {
  const { t } = useLanguage();
  const { ownerFilter } = useTenant();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['customer_debts', ownerFilter],
    queryFn: () => base44.entities.Debt?.filter({ ...ownerFilter, type: 'customer' }) || [],
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  // Build customer list from debts (since no dedicated Customer entity)
  const customers = useMemo(() => {
    const map = {};
    debts.forEach(d => {
      if (!map[d.party_name]) {
        map[d.party_name] = {
          id: d.id,
          name: d.party_name,
          phone: d.phone,
          email: d.email,
          total_purchases: 0,
          outstanding: 0,
          order_count: 0,
        };
      }
      map[d.party_name].outstanding += d.balance || 0;
      map[d.party_name].total_purchases += d.amount || 0;
    });
    return Object.values(map).filter(c =>
      search === '' || c.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [debts, search]);

  const vipCustomers = customers.filter(c => (c.total_purchases || 0) > 1000);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('customer_management')}</h1>
          <p className="text-xs text-muted-foreground">{customers.length} customers</p>
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('active_customers'), value: customers.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'VIP', value: vipCustomers.length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Outstanding', value: customers.filter(c => c.outstanding > 0).length, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[11px] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`${t('search')} customers...`}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="all" className="text-xs">{t('all')}</TabsTrigger>
          <TabsTrigger value="vip" className="text-xs">VIP</TabsTrigger>
          <TabsTrigger value="outstanding" className="text-xs">{t('receivables')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_data')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map(c => <CustomerCard key={c.id} customer={c} onClick={() => setSelectedCustomer(c)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vip" className="mt-3">
          <div className="space-y-2">
            {vipCustomers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Crown className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No VIP customers yet</p>
              </div>
            ) : (
              vipCustomers.map(c => <CustomerCard key={c.id} customer={c} onClick={() => setSelectedCustomer(c)} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="outstanding" className="mt-3">
          <div className="space-y-2">
            {customers.filter(c => c.outstanding > 0).map(c => (
              <CustomerCard key={c.id} customer={c} onClick={() => setSelectedCustomer(c)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CustomerProfileModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}
