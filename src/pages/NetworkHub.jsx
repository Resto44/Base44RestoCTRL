import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Building2, TrendingUp, Users, Package, Truck, ChefHat, BarChart3, Settings, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function NetworkHub() {
  const { t, currency, lang } = useLanguage();
  const { ownerFilter, branches } = useTenant();
  const fmt = v => formatCurrency(v, currency);
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Fetch network data
  const { data: dailySales = [] } = useQuery({
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

  // Chart data: Revenue by branch
  const revenueChartData = useMemo(() => {
    return metrics.branchRanking.slice(0, 8).map(b => ({
      name: b.branch.substring(0, 12),
      revenue: b.revenue,
      avg: Math.round(b.avgDaily),
    }));
  }, [metrics.branchRanking]);

  // Chart data: Branch health status
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

  // Pending transfers
  const pendingTransfers = useMemo(() => {
    return transferRequests.filter(t => t.status === 'pending').length;
  }, [transferRequests]);

  // Module cards
  const modules = [
    {
      id: 'dashboard',
      icon: BarChart3,
      label: 'Network Dashboard',
      desc: 'Total branches, revenue, profit, health scores',
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      path: '#dashboard',
    },
    {
      id: 'control',
      icon: Building2,
      label: 'Multi-Branch Control',
      desc: 'Branch switcher, comparison, ranking',
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      path: '#control',
    },
    {
      id: 'inventory',
      icon: Package,
      label: 'Central Inventory',
      desc: 'Cross-branch visibility, low-stock alerts',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      path: '/inventory-command-center',
    },
    {
      id: 'transfers',
      icon: ArrowRight,
      label: 'Inter-Branch Transfers',
      desc: `Transfer requests, approvals (${pendingTransfers} pending)`,
      color: 'bg-green-50 text-green-700 border-green-200',
      path: '/inventory-transfers',
    },
    {
      id: 'purchasing',
      icon: TrendingUp,
      label: 'Central Purchasing',
      desc: 'Shared suppliers, contracts, analytics',
      color: 'bg-pink-50 text-pink-700 border-pink-200',
      path: '#purchasing',
    },
    {
      id: 'customers',
      icon: Users,
      label: 'Unified Customers',
      desc: 'Shared profiles, loyalty, cross-branch history',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      path: '#customers',
    },
    {
      id: 'drivers',
      icon: Truck,
      label: 'Driver Network',
      desc: 'Allocation, performance, debt tracking',
      color: 'bg-orange-50 text-orange-700 border-orange-200',
      path: '#drivers',
    },
    {
      id: 'kitchen',
      icon: ChefHat,
      label: 'Central Kitchen',
      desc: 'Production planning, workload balancing',
      color: 'bg-red-50 text-red-700 border-red-200',
      path: '#kitchen',
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={t('network_management') || 'Network Management'}
        subtitle={`${metrics.activeBranches} of ${metrics.totalBranches} branches active`}
        icon={Building2}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('total_revenue') || 'Total Revenue'}</div>
          <div className="text-xl font-bold text-primary">{fmt(metrics.totalRevenue)}</div>
          <div className="text-xs text-green-600 mt-1">↑ {metrics.activeBranches} branches</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('avg_daily_revenue') || 'Avg Daily'}</div>
          <div className="text-xl font-bold text-primary">{fmt(metrics.avgRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">Network average</div>
        </Card>
      </div>

      {/* Branch Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t('filter_by_branch') || 'Filter by Branch'}</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedBranch === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBranch('all')}
            className="whitespace-nowrap"
          >
            {t('all_branches') || 'All'}
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

      {/* Tabs: Dashboard, Charts, Modules */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">{t('dashboard') || 'Dashboard'}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics') || 'Analytics'}</TabsTrigger>
          <TabsTrigger value="modules">{t('modules') || 'Modules'}</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Branch Health Status */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('branch_health_status') || 'Branch Health Status'}
            </h3>
            {healthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={healthChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {healthChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t('no_data_available') || 'No data available'}</div>
            )}
          </Card>

          {/* Top Branches by Revenue */}
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
                  <Bar dataKey="revenue" fill="#3b82f6" name={t('total_revenue') || 'Revenue'} />
                  <Bar dataKey="avg" fill="#10b981" name={t('avg_daily') || 'Avg Daily'} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">{t('no_data_available') || 'No data available'}</div>
            )}
          </Card>

          {/* Branch Ranking Table */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">{t('branch_ranking') || 'Branch Ranking'}</h3>
            <div className="space-y-2">
              {metrics.branchRanking.slice(0, 5).map((b, idx) => (
                <div key={b.branch} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{idx + 1}</Badge>
                    <span className="font-medium">{b.branch}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmt(b.revenue)}</div>
                    <div className="text-xs text-muted-foreground">{fmt(b.avgDaily)}/day</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">{t('network_analytics') || 'Network Analytics'}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_branches') || 'Total Branches'}</span>
                <span className="font-semibold">{metrics.totalBranches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('active_branches') || 'Active Branches'}</span>
                <span className="font-semibold text-green-600">{metrics.activeBranches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_revenue') || 'Total Revenue'}</span>
                <span className="font-semibold">{fmt(metrics.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pending_transfers') || 'Pending Transfers'}</span>
                <span className="font-semibold text-amber-600">{pendingTransfers}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-3">
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
    </div>
  );
}
