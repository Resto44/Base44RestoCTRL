import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { Card } from '@/components/ui/card';
import { ShoppingBag, ShoppingCart, Users, Landmark, ChevronRight, Star, Lock, Building2, GitBranch } from 'lucide-react';

const LABELS = {
  en: {
    welcome: 'Welcome to Your Private Workspace',
    sub: name => `Hi ${name ? name + ',' : ''} your restaurant system is ready.`,
    isolated: 'This is your private, isolated workspace. No demo data. No shared content.',
    checklistTitle: 'Start Here — Quick Actions',
    empty: 'Your dashboard starts empty. Every record you add belongs only to you.',
    privacyBadge: 'Private & Isolated',
    restaurantName: 'Restaurant',
    branchName: 'Branch',
    actions: [
      { icon: ShoppingBag, label: 'Record First Sale', to: '/sales', desc: 'Start tracking your daily revenue' },
      { icon: ShoppingCart, label: 'Record First Purchase', to: '/purchases', desc: 'Log your first buying expense' },
      { icon: Users, label: 'Add First Employee', to: '/employees', desc: 'Build your team and run payroll' },
      { icon: Landmark, label: 'Setup Treasury', to: '/treasury', desc: 'Track your cash and network balances' },
      { icon: Building2, label: 'Manage Restaurants', to: '/restaurants', desc: 'Add branches or a second restaurant' },
    ],
    tip: '🔒 All your data is fully encrypted and private. Zero shared access.',
  },
  ar: {
    welcome: 'مرحباً بك في مساحتك الخاصة',
    sub: name => `أهلاً ${name ? name + '،' : ''} نظام مطعمك جاهز.`,
    isolated: 'هذه مساحة عمل خاصة ومعزولة. لا بيانات تجريبية. لا محتوى مشترك.',
    checklistTitle: 'ابدأ من هنا — إجراءات سريعة',
    empty: 'لوحتك تبدأ فارغة. كل سجل تضيفه ينتمي لك وحدك.',
    privacyBadge: 'خاص ومعزول',
    restaurantName: 'المطعم',
    branchName: 'الفرع',
    actions: [
      { icon: ShoppingBag, label: 'تسجيل أول مبيعة', to: '/sales', desc: 'ابدأ بتتبع إيراداتك اليومية' },
      { icon: ShoppingCart, label: 'تسجيل أول مشتريات', to: '/purchases', desc: 'سجّل أول مصروف شراء' },
      { icon: Users, label: 'إضافة أول موظف', to: '/employees', desc: 'أعدّ فريقك وكشف الرواتب' },
      { icon: Landmark, label: 'إعداد الخزينة', to: '/treasury', desc: 'تتبع أرصدة النقد والشبكة' },
      { icon: Building2, label: 'إدارة المطاعم', to: '/restaurants', desc: 'أضف فروعاً أو مطعماً ثانياً' },
    ],
    tip: '🔒 جميع بياناتك مشفرة وخاصة تماماً. لا وصول مشترك.',
  },
  fa: {
    welcome: 'به فضای کاری خصوصی خود خوش آمدید',
    sub: name => `سلام ${name ? name + '،' : ''} سیستم رستوران شما آماده است.`,
    isolated: 'این فضای کاری کاملاً خصوصی و مجزا است. بدون داده‌های آزمایشی. بدون محتوای مشترک.',
    checklistTitle: 'از اینجا شروع کنید',
    empty: 'داشبورد شما از صفر شروع می‌شود. هر رکورد فقط متعلق به شماست.',
    privacyBadge: 'خصوصی و مجزا',
    restaurantName: 'رستوران',
    branchName: 'فرع',
    actions: [
      { icon: ShoppingBag, label: 'ثبت اولین فروش', to: '/sales', desc: 'ردیابی درآمد روزانه را شروع کنید' },
      { icon: ShoppingCart, label: 'ثبت اولین خرید', to: '/purchases', desc: 'اولین هزینه خرید را ثبت کنید' },
      { icon: Users, label: 'افزودن اولین کارمند', to: '/employees', desc: 'تیم و حقوق را راه‌اندازی کنید' },
      { icon: Landmark, label: 'راه‌اندازی خزانه', to: '/treasury', desc: 'موجودی نقد و شبکه را ردیابی کنید' },
      { icon: Building2, label: 'مدیریت رستوران‌ها', to: '/restaurants', desc: 'فروع یا رستوران دوم اضافه کنید' },
    ],
    tip: '🔒 تمام داده‌های شما کاملاً رمزگذاری و خصوصی است.',
  },
};

export default function WelcomeDashboard() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { activeRestaurant, branches } = useTenant();
  const L = LABELS[lang] || LABELS.en;
  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <div className="space-y-4 pb-8">
      {/* Hero — private workspace identity */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground leading-tight">{L.welcome}</h1>
            <p className="text-muted-foreground text-sm">{L.sub(firstName)}</p>
          </div>
        </div>

        {/* Isolation badge */}
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mb-3">
          <Lock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{L.privacyBadge}</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-500">— {L.isolated}</span>
        </div>

        {/* Active workspace info */}
        {activeRestaurant && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-card border border-border rounded-lg px-2.5 py-1">
              <Building2 className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-foreground">{activeRestaurant.name}</span>
            </div>
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-card border border-border rounded-lg px-2.5 py-1">
                <GitBranch className="w-3 h-3 text-accent" />
                <span className="text-xs font-medium text-foreground">{branches[0].label}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state indicator */}
      <p className="text-xs text-center text-muted-foreground/70 italic">{L.empty}</p>

      {/* Checklist / Quick actions */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">{L.checklistTitle}</p>
        <div className="space-y-2">
          {L.actions.map(({ icon: Icon, label, to, desc }) => (
            <Link key={to} to={to}>
              <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Privacy note */}
      <p className="text-center text-xs text-muted-foreground/60 pt-2">{L.tip}</p>
    </div>
  );
}