import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, ShoppingCart } from 'lucide-react';
import SalesForm from '@/components/sales/SalesForm';
import { useLanguage } from '@/lib/LanguageContext';

export default function StaffUpload() {
  const { user } = useAuth();
  const { role } = useRole();

  // Owners and restaurant_admins must never see this staff page — redirect to dashboard
  useEffect(() => {
    if (role === ROLES.OWNER || role === ROLES.RESTAURANT_ADMIN) {
      window.location.replace('/');
    }
  }, [role]);
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(null);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Restaurant.list(),
  });

  const userBranch = branches.find(b => b.key === user?.branch)?.key || branches[0]?.key;

  const createSaleMutation = useMutation({
    mutationFn: (data) => base44.entities.DailySales.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setActiveTab(null);
      toast({ description: t('Sale recorded successfully') });
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data) => base44.entities.Purchase.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setActiveTab(null);
      toast({ description: t('Purchase recorded successfully') });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('Daily Operations')}
          </h1>
          <p className="text-slate-600">
            {t('Record your daily sales and purchases')}
          </p>
        </div>

        {/* Active Form */}
        {activeTab === 'sales' && (
          <div className="mb-6">
            <SalesForm
              branch={userBranch}
              onSubmit={(data) => {
                createSaleMutation.mutate({
                  ...data,
                  branch: userBranch,
                });
              }}
              isLoading={createSaleMutation.isPending}
              onCancel={() => setActiveTab(null)}
            />
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('Record Purchase')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  {t('Purchase recording coming soon')}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tiles */}
        {!activeTab && (
          <div className="grid grid-cols-1 gap-4">
            {/* Sales Tile */}
            <button
              onClick={() => setActiveTab('sales')}
              className="block w-full"
            >
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-primary">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-full">
                      <BarChart3 className="w-12 h-12 text-primary" />
                    </div>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        {t('Daily Sales')}
                      </h2>
                      <p className="text-slate-600">
                        {t('Record cash, card, and credit sales')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Purchases Tile */}
            <button
              onClick={() => setActiveTab('purchases')}
              className="block w-full"
            >
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-primary">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-full">
                      <ShoppingCart className="w-12 h-12 text-primary" />
                    </div>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        {t('Daily Purchases')}
                      </h2>
                      <p className="text-slate-600">
                        {t('Record inventory purchases and restocking')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}