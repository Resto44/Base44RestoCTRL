import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Building2, TrendingUp, Users, Package, Truck, ChefHat, BarChart3, Settings, ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function NetworkHub() {
  const { t, currency, lang } = useLanguage();
  const { ownerFilter, branches, createRestaurant, updateRestaurantBranches, activeRestaurant } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fmt = v => formatCurrency(v, currency);
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Modals State
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form States
  const [networkForm, setNetworkForm] = useState({ name: '', description: '', owner: '', currency: '$', country: '', timezone: 'UTC', status: 'active' });
  const [branchForm, setBranchForm] = useState({ label: '', key: '', manager_name: '', phone: '', address: '', working_hours: '', status: 'active' });

  // Fetch network data
  const { data: dailySales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['daily_sales_network', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: branchHealthScores = [] } = useQuery({
    queryKey: ['branch_health_scores', ownerFilter],
    queryFn: () => base44.entities.BranchHealthScore?.filter(ownerFilter || {}, '-date', 100) || [],
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: transferRequests = [] } = useQuery({
    queryKey: ['transfer_requests', ownerFilter],
    queryFn: () => base44.entities.TransferRequest?.filter(ownerFilter || {}, '-created_date', 50) || [],
    staleTime: 30000,
    enabled: !!ownerFilter?.created_by,
  });

  // Mutations
  const createNetworkMutation = useMutation({
    mutationFn: (data) => createRestaurant(data),
    onSuccess: () => {
      toast.success(t('success') || 'Network created successfully');
      setShowNetworkModal(false);
      queryClient.invalidateQueries(['restaurants']);
    },
    onError: () => toast.error(t('error') || 'Failed to create network'),
  });

  const createBranchMutation = useMutation({
    mutationFn: (newBranch) => {
      const updatedBranches = [...(branches || []), newBranch];
      return updateRestaurantBranches(updatedBranches);
    },
    onSuccess: () => {
      toast.success(t('success') || 'Branch created successfully');
      setShowBranchModal(false);
      queryClient.invalidateQueries(['restaurants']);
    },
    onError: () => toast.error(t('error') || 'Failed to create branch'),
  });

  // Calculate network metrics
  const metrics = useMemo(() => {
    const filtered = selectedBranch === 'all' ? dailySales : dailySales.filter(s => s.branch === selectedBranch);
    const totalRevenue = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
    const avgRevenue = filtered.length > 0 ? totalRevenue / filtered.length : 0;
    
    const branchMetrics = {};
    filtered.forEach(s => {
      if (!branchMetrics[s.branch]) {
        branchMetrics[s.branch] = { revenue: 0, count: 0 };
      }
      branchMetrics[s.branch].revenue += (s.total || 0);
      branchMetrics[s.branch].count += 1;
    });

    const branchRanking = Object.entries(branchMetrics)
      .map(([branch, data]) => ({
        branch,
        revenue: data.revenue,
        avgDaily: data.count > 0 ? data.revenue / data.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      avgRevenue,
      branchRanking,
      activeBranches: Object.keys(branchMetrics).length,
      totalBranches: branches?.length || 0,
    };
  }, [dailySales, selectedBranch, branches]);

  // Chart data
  const revenueChartData = useMemo(() => {
    return metrics.branchRanking.slice(0, 8).map(b => ({
      name: b.branch.substring(0, 12),
      revenue: b.revenue,
      avg: Math.round(b.avgDaily),
    }));
  }, [metrics.branchRanking]);

  const healthChartData = useMemo(() => {
    const healthByStatus = { healthy: 0, warning: 0, critical: 0 };
    branchHealthScores.forEach(h => {
      healthByStatus[h.status || 'healthy']++;
    });
    return Object.entries(healthByStatus)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        color: status === 'healthy' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444',
      }));
  }, [branchHealthScores]);

  const pendingTransfers = useMemo(() => {
    return transferRequests.filter(t => t.status === 'pending').length;
  }, [transferRequests]);

  const modules = [
    { id: 'inventory', icon: Package, label: t('inventory_command_center'), desc: 'Cross-branch visibility, low-stock alerts', color: 'bg-amber-50 text-amber-700 border-amber-200', path: '/inventory-command-center' },
    { id: 'transfers', icon: RefreshCw, label: t('transfer_center'), desc: `${pendingTransfers} pending approvals`, color: 'bg-green-50 text-green-700 border-green-200', path: '/inventory-transfers' },
    { id: 'purchasing', icon: TrendingUp, label: t('central_purchasing'), desc: 'Shared suppliers, contracts, analytics', color: 'bg-pink-50 text-pink-700 border-pink-200', path: '/procurement-dashboard' },
    { id: 'customers', icon: Users, label: t('unified_customers'), desc: 'Shared profiles, loyalty, cross-branch history', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', path: '/customer-management' },
    { id: 'drivers', icon: Truck, label: t('driver_network'), desc: 'Allocation, performance, debt tracking', color: 'bg-orange-50 text-orange-700 border-orange-200', path: '/driver-management' },
    { id: 'kitchen', icon: ChefHat, label: t('central_kitchen'), desc: 'Production planning, workload balancing', color: 'bg-red-50 text-red-700 border-red-200', path: '/kitchen-dashboard' },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto px-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 no-scrollbar">
        <Button size="sm" onClick={() => setShowNetworkModal(true)} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-1" /> {t('add_network')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowBranchModal(true)} className="flex-shrink-0">
          <Building2 className="w-4 h-4 mr-1" /> {t('add_branch')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/inventory-transfers')} className="flex-shrink-0">
          <RefreshCw className="w-4 h-4 mr-1" /> {t('transfer_center')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowSettingsModal(true)} className="flex-shrink-0">
          <Settings className="w-4 h-4 mr-1" /> {t('network_settings')}
        </Button>
      </div>

      <PageHeader
        title={t('network_management')}
        subtitle={`${metrics.activeBranches} of ${metrics.totalBranches} branches active`}
        icon={Building2}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('total_revenue')}</div>
          <div className="text-xl font-bold text-primary">{fmt(metrics.totalRevenue)}</div>
          <div className="text-xs text-green-600 mt-1">↑ {metrics.activeBranches} branches</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('avg_daily_revenue')}</div>
          <div className="text-xl font-bold text-primary">{fmt(metrics.avgRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">Network average</div>
        </Card>
      </div>

      {/* Branch Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t('filter_by_branch')}</label>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Button
            variant={selectedBranch === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBranch('all')}
            className="whitespace-nowrap"
          >
            {t('all_branches')}
          </Button>
          {branches?.map(b => (
            <Button
              key={b.key}
              variant={selectedBranch === b.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedBranch(b.key)}
              className="whitespace-nowrap"
            >
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">{t('dashboard')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics')}</TabsTrigger>
          <TabsTrigger value="modules">{t('modules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 pt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('branch_health_status') || 'Branch Health Status'}
            </h3>
            {healthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={healthChartData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={60} fill="#8884d8" dataKey="value">
                    {healthChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t('no_data_available')}</div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t('top_branches_by_revenue') || 'Top Branches by Revenue'}
            </h3>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3b82f6" name={t('total_revenue')} />
                  <Bar dataKey="avg" fill="#10b981" name={t('avg_daily')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t('no_data_available')}</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 pt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">{t('network_analytics')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_branches')}</span>
                <span className="font-semibold">{metrics.totalBranches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('active_branches')}</span>
                <span className="font-semibold text-green-600">{metrics.activeBranches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_revenue')}</span>
                <span className="font-semibold">{fmt(metrics.totalRevenue)}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-3 pt-4">
          {modules.map(module => {
            const Icon = module.icon;
            return (
              <Link key={module.id} to={module.path}>
                <Card className={`p-4 border-2 cursor-pointer hover:shadow-md transition-shadow ${module.color}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 mt-1 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">{module.label}</div>
                        <div className="text-xs opacity-75 mt-1">{module.desc}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={showNetworkModal} onOpenChange={setShowNetworkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('add_network')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('network_name')}</Label>
              <Input value={networkForm.name} onChange={e => setNetworkForm({...networkForm, name: e.target.value})} placeholder="e.g. Al-Fares Network" />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea value={networkForm.description} onChange={e => setNetworkForm({...networkForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('currency_symbol')}</Label>
                <Input value={networkForm.currency} onChange={e => setNetworkForm({...networkForm, currency: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t('country')}</Label>
                <Input value={networkForm.country} onChange={e => setNetworkForm({...networkForm, country: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNetworkModal(false)}>{t('cancel')}</Button>
            <Button onClick={() => createNetworkMutation.mutate(networkForm)} disabled={createNetworkMutation.isPending}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBranchModal} onOpenChange={setShowBranchModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('add_branch')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('branch_name')}</Label>
              <Input value={branchForm.label} onChange={e => setBranchForm({...branchForm, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_')})} placeholder="e.g. Downtown Branch" />
            </div>
            <div className="space-y-2">
              <Label>{t('branch_manager')}</Label>
              <Input value={branchForm.manager_name} onChange={e => setBranchForm({...branchForm, manager_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input value={branchForm.phone} onChange={e => setBranchForm({...branchForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{t('address')}</Label>
              <Input value={branchForm.address} onChange={e => setBranchForm({...branchForm, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{t('opening_hours')}</Label>
              <Input value={branchForm.working_hours} onChange={e => setBranchForm({...branchForm, working_hours: e.target.value})} placeholder="e.g. 08:00 - 22:00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBranchModal(false)}>{t('cancel')}</Button>
            <Button onClick={() => createBranchMutation.mutate(branchForm)} disabled={createBranchMutation.isPending}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('network_settings')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>{t('settings_content_placeholder') || 'Network-wide configuration and security settings.'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsModal(false)}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
