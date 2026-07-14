import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Package, FileText, CheckCircle2, Clock, XCircle, LogOut,
  RefreshCw, Search, DollarSign, Calendar, Building2, Home,
  ShoppingCart, History
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PO_STATUS = {
  pending:   { label: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved:  { label: 'Approved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  shipped:   { label: 'Shipped', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  received:  { label: 'Received', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function SupplierPortalERP() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('home');
  const [search, setSearch] = useState('');

  // Supplier profile
  const { data: supplierProfile } = useQuery({
    queryKey: ['supplier-profile', user?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('email', user?.email)
        .single();
      return data;
    },
    enabled: !!user?.email,
  });

  // Purchase orders for this supplier
  const { data: purchaseOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['supplier-pos', supplierProfile?.id],
    queryFn: async () => {
      if (!supplierProfile?.id) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, branches(name), purchase_order_items(*, products(name))')
        .eq('supplier_id', supplierProfile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierProfile?.id,
    refetchInterval: 60000,
  });

  const confirmShipmentMutation = useMutation({
    mutationFn: async (poId) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .eq('id', poId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Shipment confirmed!');
      qc.invalidateQueries({ queryKey: ['supplier-pos'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = purchaseOrders.filter(po =>
    !search ||
    po.id?.toLowerCase().includes(search.toLowerCase()) ||
    po.branches?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const pending = purchaseOrders.filter(po => po.status === 'approved');
  const totalValue = purchaseOrders
    .filter(po => ['approved', 'shipped', 'received'].includes(po.status))
    .reduce((s, po) => s + (po.total_amount || 0), 0);

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {supplierProfile?.company_name || supplierProfile?.name || 'Supplier Portal'}
              </p>
              <p className="text-slate-500 text-xs">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-amber-400">{pending.length}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Awaiting Ship</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">
                    {purchaseOrders.filter(po => po.status === 'received').length}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">Completed</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-black text-blue-400">${totalValue.toLocaleString()}</p>
                  <p className="text-slate-500 text-xs mt-0.5">Total Value</p>
                </CardContent>
              </Card>
            </div>

            {/* Pending shipments */}
            {pending.length > 0 && (
              <div>
                <h3 className="text-white font-bold text-sm mb-3">
                  Action Required — {pending.length} order{pending.length > 1 ? 's' : ''} to ship
                </h3>
                <div className="space-y-3">
                  {pending.map(po => (
                    <POCard
                      key={po.id}
                      po={po}
                      onConfirmShipment={() => confirmShipmentMutation.mutate(po.id)}
                      loading={confirmShipmentMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {pending.length === 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-white font-medium">All orders fulfilled!</p>
                  <p className="text-slate-500 text-sm mt-1">No pending shipments.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search orders…"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600"
              />
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-500 py-6 justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" />Loading…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No purchase orders found.</p>
            ) : (
              filtered.map(po => (
                <POCard
                  key={po.id}
                  po={po}
                  onConfirmShipment={() => confirmShipmentMutation.mutate(po.id)}
                  loading={confirmShipmentMutation.isPending}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <h3 className="text-white font-bold">Order History</h3>
            {purchaseOrders
              .filter(po => ['received', 'cancelled'].includes(po.status))
              .map(po => (
                <Card key={po.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">PO #{po.id?.slice(0, 8)}</p>
                        <p className="text-slate-500 text-xs">
                          {po.branches?.name} · {po.created_at ? format(new Date(po.created_at), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">${(po.total_amount || 0).toLocaleString()}</p>
                        <Badge className={`text-[10px] border ${PO_STATUS[po.status]?.color || ''}`}>
                          {PO_STATUS[po.status]?.label || po.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur border-t border-white/10 z-40">
        <div className="max-w-3xl mx-auto px-4 flex">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  activeTab === tab.id ? 'text-slate-300' : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function POCard({ po, onConfirmShipment, loading }) {
  const statusConf = PO_STATUS[po.status] || PO_STATUS.pending;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-white font-bold text-sm">PO #{po.id?.slice(0, 8)}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <Building2 className="w-3 h-3" />
              {po.branches?.name || 'Unknown Branch'}
              <Calendar className="w-3 h-3 ml-1" />
              {po.created_at ? format(new Date(po.created_at), 'MMM d') : ''}
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-sm">${(po.total_amount || 0).toLocaleString()}</p>
            <Badge className={`text-[10px] border ${statusConf.color}`}>{statusConf.label}</Badge>
          </div>
        </div>

        {po.purchase_order_items?.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-500 text-xs hover:text-slate-300 mb-2"
          >
            {expanded ? 'Hide' : 'Show'} {po.purchase_order_items.length} item{po.purchase_order_items.length > 1 ? 's' : ''}
          </button>
        )}

        {expanded && po.purchase_order_items?.length > 0 && (
          <div className="space-y-1 mb-3 bg-white/5 rounded-lg p-2">
            {po.purchase_order_items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{item.products?.name || 'Item'}</span>
                <span className="text-white">×{item.quantity} @ ${item.unit_price}</span>
              </div>
            ))}
          </div>
        )}

        {po.status === 'approved' && (
          <Button
            size="sm"
            onClick={onConfirmShipment}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 mt-2"
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            Confirm Shipment
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
