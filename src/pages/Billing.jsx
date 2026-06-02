import React, { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useSubscription, PLAN_LIMITS } from '@/lib/SubscriptionContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Check, CreditCard, Star, Zap, Crown,
  Clock, AlertTriangle, FileText, Users, Building2, Camera
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const PLANS = [
  {
    key: 'starter',
    icon: Zap,
    color: 'text-emerald-500',
    price: { monthly: 49 },
    features: {
      en: ['1 restaurant', 'Up to 3 branches', 'Up to 20 employees', '100 OCR scans/mo', '50 PDF exports/mo', 'Sales & Purchases', 'Basic Reports'],
      ar: ['مطعم واحد', 'حتى 3 فروع', 'حتى 20 موظفاً', '100 مسح OCR/شهر', '50 تصدير PDF/شهر', 'المبيعات والمشتريات', 'تقارير أساسية'],
    },
  },
  {
    key: 'pro',
    icon: Star,
    color: 'text-primary',
    price: { monthly: 99 },
    badge: { en: 'Most Popular', ar: 'الأكثر شيوعاً' },
    features: {
      en: ['Up to 5 restaurants', 'Up to 15 branches', 'Up to 100 employees', '500 OCR scans/mo', '200 PDF exports/mo', 'Everything in Starter', 'Advanced Analytics', 'Debt Management', 'Smart Alerts'],
      ar: ['حتى 5 مطاعم', 'حتى 15 فرعاً', 'حتى 100 موظف', '500 مسح OCR/شهر', '200 تصدير PDF/شهر', 'كل مميزات Starter', 'تحليلات متقدمة', 'إدارة الديون', 'تنبيهات ذكية'],
    },
  },
  {
    key: 'enterprise',
    icon: Crown,
    color: 'text-violet-500',
    price: { monthly: 299 },
    features: {
      en: ['Unlimited restaurants', 'Unlimited branches', 'Unlimited employees', 'Unlimited OCR', 'Unlimited PDF exports', 'Everything in Pro', 'Brand Customization', 'Priority Support', 'Custom Reports', 'API Access'],
      ar: ['مطاعم غير محدودة', 'فروع غير محدودة', 'موظفون غير محدودون', 'OCR غير محدود', 'PDF غير محدود', 'كل مميزات Pro', 'تخصيص العلامة التجارية', 'دعم ذو أولوية', 'تقارير مخصصة', 'وصول API'],
    },
  },
];

const statusColors = {
  trial:     'bg-blue-100 text-blue-700',
  active:    'bg-emerald-100 text-emerald-700',
  past_due:  'bg-amber-100 text-amber-700',
  canceled:  'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700',
};

const statusLabels = {
  en: { trial: 'Trial', active: 'Active', past_due: 'Past Due', canceled: 'Canceled', suspended: 'Suspended' },
  ar: { trial: 'تجريبي', active: 'نشط', past_due: 'متأخر', canceled: 'ملغى', suspended: 'موقوف' },
};

export default function Billing() {
  const { lang } = useLanguage();
  const { subscription, effectiveStatus, plan, limits, usedOcr, usedPdf, updateSubscription, refetch } = useSubscription();
  const [loading, setLoading] = useState(false);
  const slabels = statusLabels[lang] || statusLabels.en;

  const handleDemoActivate = async (planKey) => {
    setLoading(true);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const pl = PLAN_LIMITS[planKey];
    await updateSubscription({
      plan: planKey,
      subscription_status: 'active',
      current_period_end: end.toISOString().split('T')[0],
      payment_provider: 'manual',
      monthly_price: pl.price,
      max_restaurants: pl.restaurants,
      max_branches: pl.branches,
      max_employees: pl.employees,
      max_ocr_scans: pl.ocr,
      max_pdf_exports: pl.pdf,
    });
    await refetch();
    setLoading(false);
  };

  const handleDemoTrial = async () => {
    setLoading(true);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const pl = PLAN_LIMITS.pro;
    await updateSubscription({
      plan: 'pro',
      subscription_status: 'trial',
      trial_end: trialEnd.toISOString().split('T')[0],
      current_period_end: trialEnd.toISOString().split('T')[0],
      payment_provider: 'none',
      monthly_price: pl.price,
      max_restaurants: pl.restaurants,
      max_branches: pl.branches,
      max_employees: pl.employees,
      max_ocr_scans: pl.ocr,
      max_pdf_exports: pl.pdf,
    });
    await refetch();
    setLoading(false);
  };

  const formatDateStr = (str) => {
    if (!str) return '—';
    try { return format(parseISO(str), 'dd MMM yyyy'); } catch { return str; }
  };

  const usageItems = [
    { label: lang === 'ar' ? 'OCR مسح' : 'OCR Scans', used: usedOcr, max: limits.ocr, IconCmp: Camera },
    { label: lang === 'ar' ? 'تصدير PDF' : 'PDF Exports', used: usedPdf, max: limits.pdf, IconCmp: FileText },
    { label: lang === 'ar' ? 'الفروع' : 'Branches', used: 0, max: limits.branches, IconCmp: Building2 },
    { label: lang === 'ar' ? 'الموظفون' : 'Employees', used: 0, max: limits.employees, IconCmp: Users },
  ];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={lang === 'ar' ? 'الفوترة والاشتراك' : 'Billing & Subscription'} />

      {/* Current subscription summary */}
      {subscription && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-3">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{lang === 'ar' ? 'الخطة الحالية' : 'Current Plan'}</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black capitalize">{plan}</span>
                  <Badge className={`text-xs ${statusColors[effectiveStatus]}`}>{slabels[effectiveStatus] || effectiveStatus}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {effectiveStatus === 'trial' ? (lang === 'ar' ? 'انتهاء التجربة' : 'Trial ends') : (lang === 'ar' ? 'التجديد القادم' : 'Next renewal')}
                </p>
                <p className="font-bold text-sm flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDateStr(effectiveStatus === 'trial' ? subscription.trial_end : subscription.current_period_end)}
                </p>
              </div>
            </div>
          </div>

          {/* Usage meters */}
          <CardContent className="pt-3 pb-4 grid grid-cols-2 gap-3">
            {usageItems.map(({ label, used, max, IconCmp }) => {
              const pct = max > 0 && max < 9999 ? Math.min(100, (used / max) * 100) : 0;
              const isUnlimited = max >= 9999;
              const isHigh = pct > 80;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <IconCmp className="w-3 h-3" />
                    <span>{label}</span>
                  </div>
                  {isUnlimited ? (
                    <div className="text-xs font-semibold text-green-600">∞ {lang === 'ar' ? 'غير محدود' : 'Unlimited'}</div>
                  ) : (
                    <>
                      <Progress value={pct} className={`h-1.5 ${isHigh ? '[&>div]:bg-red-500' : ''}`} />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{used}</span>
                        <span className={isHigh ? 'text-red-500 font-semibold' : ''}>{max}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Demo Controls */}
      <Card className="border-dashed border-amber-400">
        <CardContent className="p-3">
          <p className="text-xs text-amber-600 mb-2 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Demo Controls (Testing Only)
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleDemoActivate('starter')} disabled={loading}>Activate Starter</Button>
            <Button size="sm" variant="default" className="text-xs" onClick={() => handleDemoActivate('pro')} disabled={loading}>Activate Pro</Button>
            <Button size="sm" className="text-xs bg-violet-600 hover:bg-violet-700" onClick={() => handleDemoActivate('enterprise')} disabled={loading}>Activate Enterprise</Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={handleDemoTrial} disabled={loading}>Reset Trial</Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="space-y-4">
        {PLANS.map((p) => {
          const PlanIcon = p.icon;
          const isCurrent = plan === p.key && (effectiveStatus === 'active' || effectiveStatus === 'trial');
          const features = p.features[lang] || p.features.en;
          const badge = p.badge?.[lang] || p.badge?.en;
          return (
            <Card key={p.key} className={`relative overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-primary shadow-lg' : ''}`}>
              {badge && (
                <div className="absolute top-3 end-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">{badge}</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <PlanIcon className={`w-5 h-5 ${p.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="capitalize text-base">{p.key}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {PLAN_LIMITS[p.key].restaurants === 999 ? '∞' : PLAN_LIMITS[p.key].restaurants} restaurants ·{' '}
                      {PLAN_LIMITS[p.key].branches === 999 ? '∞' : PLAN_LIMITS[p.key].branches} branches
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="text-2xl font-bold">${p.price.monthly}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 mb-4">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge variant="secondary" className="w-full justify-center py-2 text-sm">
                    {lang === 'ar' ? '✓ خطتك الحالية' : '✓ Your Current Plan'}
                  </Badge>
                ) : (
                  <Button className="w-full gap-2" onClick={() => handleDemoActivate(p.key)} disabled={loading}>
                    <CreditCard className="w-4 h-4" />
                    {lang === 'ar' ? `الترقية إلى ${p.key}` : `Upgrade to ${p.key}`} — ${p.price.monthly}/mo
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4">
        {lang === 'ar'
          ? 'للدفع عبر مدى أو Apple Pay أو Google Pay، تواصل مع الدعم.'
          : 'Stripe, Mada, Apple Pay & Google Pay available. Contact support to activate.'}
      </p>
    </div>
  );
}