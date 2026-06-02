import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole } from '@/lib/RoleContext';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, CalendarCheck, DollarSign, BarChart3, Settings2, TrendingUp, Calendar } from 'lucide-react';
import AttendanceTab from '@/components/payroll/AttendanceTab';
import AttendanceAnalytics from '@/components/payroll/AttendanceAnalytics';
import PayrollDashboard from '@/components/payroll/PayrollDashboard';
import PayrollReport from '@/components/payroll/PayrollReport';
import BonusDeductionTab from '@/components/payroll/BonusDeductionTab';
import DeductionRulesSettings from '@/components/payroll/DeductionRulesSettings';
import WeeklyRosterView from '@/components/staff/WeeklyRosterView';

export default function Payroll() {
  const { t } = useLanguage();
  const { role } = useRole();
  const isOwner = role === 'owner';
  const isManager = role === 'owner' || role === 'manager';

  if (!isManager) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Access restricted.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('payroll')} />
      <Tabs defaultValue="attendance">
        <TabsList className="w-full mb-4 flex overflow-x-auto hide-scrollbar">
          <TabsTrigger value="attendance" className="flex-1 text-xs gap-1 whitespace-nowrap">
            <CalendarCheck className="w-3 h-3" /> {t('attendance')}
          </TabsTrigger>
          <TabsTrigger value="roster" className="flex-1 text-xs gap-1 whitespace-nowrap">
            <Calendar className="w-3 h-3" /> {t('shift')}
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="flex-1 text-xs gap-1 whitespace-nowrap">
            <DollarSign className="w-3 h-3" /> {t('bonuses')}
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 text-xs gap-1 whitespace-nowrap">
            <Users className="w-3 h-3" /> {t('payroll_report')}
          </TabsTrigger>
          <TabsTrigger value="perf" className="flex-1 text-xs gap-1 whitespace-nowrap">
            <TrendingUp className="w-3 h-3" /> {t('performance')}
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="analytics" className="flex-1 text-xs gap-1 whitespace-nowrap">
              <BarChart3 className="w-3 h-3" /> {t('analytics')}
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="settings" className="flex-1 text-xs gap-1 whitespace-nowrap">
              <Settings2 className="w-3 h-3" /> {t('rules')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="attendance"><AttendanceTab /></TabsContent>
        <TabsContent value="roster"><WeeklyRosterView /></TabsContent>
        <TabsContent value="bonuses"><BonusDeductionTab /></TabsContent>
        <TabsContent value="report"><PayrollReport /></TabsContent>
        <TabsContent value="perf"><AttendanceAnalytics /></TabsContent>
        {isOwner && <TabsContent value="analytics"><PayrollDashboard /></TabsContent>}
        {isOwner && <TabsContent value="settings"><DeductionRulesSettings /></TabsContent>}
      </Tabs>
    </div>
  );
}