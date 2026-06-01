import React, { useState, useEffect, useRef } from 'react';
import { X, Share2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';

// ── Translations ─────────────────────────────────────────────────────────────
const TEXTS = {
  en: {
    title: 'Install the App',
    subtitle: 'Add to your home screen for a native app experience',
    ios_steps: [
      { label: 'Tap the Share button', detail: 'at the bottom of your Safari browser' },
      { label: 'Scroll and tap "Add to Home Screen"', detail: 'you may need to scroll the menu' },
      { label: 'Tap "Add"', detail: 'in the top-right corner to confirm' },
    ],
    android_steps: [
      { label: 'Tap the menu (⋮)', detail: 'in the top-right of your Chrome browser' },
      { label: 'Tap "Add to Home screen"', detail: 'or "Install app"' },
      { label: 'Tap "Add" to confirm', detail: 'the app will appear on your home screen' },
    ],
    install_now: 'Install Now',
    got_it: 'Got it!',
    dont_show: "Don't show again",
    ios_hint: 'Look for the Share icon (□↑) at the bottom of Safari',
    android_hint: 'Chrome will show a native install dialog',
  },
  ar: {
    title: 'تثبيت التطبيق',
    subtitle: 'أضفه إلى شاشتك الرئيسية للحصول على تجربة تطبيق أصلي',
    ios_steps: [
      { label: 'اضغط على زر المشاركة', detail: 'في أسفل متصفح Safari' },
      { label: 'مرر واضغط على "إضافة إلى الشاشة الرئيسية"', detail: 'قد تحتاج للتمرير في القائمة' },
      { label: 'اضغط على "إضافة"', detail: 'في الزاوية العلوية اليمنى للتأكيد' },
    ],
    android_steps: [
      { label: 'اضغط على القائمة (⋮)', detail: 'في أعلى يمين متصفح Chrome' },
      { label: 'اضغط على "إضافة إلى الشاشة الرئيسية"', detail: 'أو "تثبيت التطبيق"' },
      { label: 'اضغط على "إضافة" للتأكيد', detail: 'سيظهر التطبيق على شاشتك الرئيسية' },
    ],
    install_now: 'تثبيت الآن',
    got_it: 'فهمت!',
    dont_show: 'لا تظهر مجدداً',
    ios_hint: 'ابحث عن أيقونة المشاركة (□↑) في أسفل Safari',
    android_hint: 'سيعرض Chrome مربع تثبيت أصلي',
  },
  fa: {
    title: 'نصب برنامه',
    subtitle: 'برای تجربه‌ای مثل اپ واقعی، به صفحه اصلی اضافه کنید',
    ios_steps: [
      { label: 'دکمه اشتراک‌گذاری را بزنید', detail: 'در پایین مرورگر Safari' },
      { label: 'اسکرول کرده و "افزودن به صفحه اصلی" را بزنید', detail: 'شاید نیاز باشد در منو اسکرول کنید' },
      { label: '"افزودن" را بزنید', detail: 'در گوشه بالا راست برای تأیید' },
    ],
    android_steps: [
      { label: 'روی منو (⋮) بزنید', detail: 'در بالا راست مرورگر Chrome' },
      { label: 'روی "افزودن به صفحه اصلی" بزنید', detail: 'یا "نصب برنامه"' },
      { label: 'روی "افزودن" بزنید برای تأیید', detail: 'برنامه روی صفحه اصلی ظاهر می‌شود' },
    ],
    install_now: 'نصب کن',
    got_it: 'فهمیدم!',
    dont_show: 'دیگر نشان نده',
    ios_hint: 'آیکون اشتراک‌گذاری (□↑) را در پایین Safari پیدا کنید',
    android_hint: 'Chrome یک دیالوگ نصب واقعی نشان می‌دهد',
  },
};

const STEP_ICONS = {
  ios: [
    <Share2 key="share" className="w-5 h-5 text-blue-500" />,
    <Plus key="plus" className="w-5 h-5 text-blue-500" />,
    <Check key="check" className="w-5 h-5 text-green-500" />,
  ],
  android: [
    <span key="menu" className="text-lg leading-none">⋮</span>,
    <Plus key="plus" className="w-5 h-5 text-blue-500" />,
    <Check key="check" className="w-5 h-5 text-green-500" />,
  ],
};

export default function PWAInstallModal({ onClose, onNeverShow }) {
  const { lang: language } = useLanguage();
  const { isIOS, hasDeferredPrompt, triggerInstall, neverShow } = usePWAInstall();
  const [activeStep, setActiveStep] = useState(0);
  const [installing, setInstalling] = useState(false);
  const overlayRef = useRef(null);

  const tx = TEXTS[language] || TEXTS.en;
  const steps = isIOS ? tx.ios_steps : tx.android_steps;
  const icons = isIOS ? STEP_ICONS.ios : STEP_ICONS.android;

  // Auto-advance steps every 2.5s for iOS
  useEffect(() => {
    if (!isIOS) return;
    const timer = setInterval(() => {
      setActiveStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(timer);
  }, [isIOS, steps.length]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleGotIt = () => {
    if (onClose) onClose();
  };

  const handleNeverShow = () => {
    neverShow();
    if (onNeverShow) onNeverShow();
    if (onClose) onClose();
  };

  const handleAndroidInstall = async () => {
    setInstalling(true);
    await triggerInstall();
    setInstalling(false);
    if (onClose) onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) handleGotIt();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
    >
      <div
        className="bg-card w-full max-w-md rounded-t-3xl shadow-2xl pb-safe"
        style={{ animation: 'slideUpModal 0.3s cubic-bezier(0.16,1,0.3,1)', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideUpModal {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .pb-safe { padding-bottom: max(2rem, env(safe-area-inset-bottom, 2rem)); }
          .step-active { background: hsl(var(--primary) / 0.12); border-color: hsl(var(--primary) / 0.4); }
          .step-done { background: hsl(142 71% 45% / 0.1); }
        `}</style>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
              🍽️
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">{tx.title}</h2>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{tx.subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleGotIt}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 space-y-2 mb-5">
          {steps.map((step, i) => {
            const isDone = i < activeStep;
            const isActive = i === activeStep;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`w-full flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 text-left touch-manipulation ${
                  isDone ? 'step-done border-green-200 dark:border-green-800' :
                  isActive ? 'step-active border-primary/30' :
                  'border-border bg-muted/30'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Step number bubble */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-colors ${
                  isDone ? 'bg-green-100 text-green-600 dark:bg-green-900/40' :
                  isActive ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                  {isActive && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{step.detail}</p>
                  )}
                </div>

                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isDone ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                }`}>
                  {isDone ? <Check className="w-4 h-4 text-green-500" /> : icons[i]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Hint bar */}
        <div className="mx-5 mb-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
          <span className="text-blue-500 text-base flex-shrink-0 mt-0.5">💡</span>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-snug">
            {isIOS ? tx.ios_hint : tx.android_hint}
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-5 space-y-2">
          {/* Android: real native install button */}
          {!isIOS && hasDeferredPrompt && (
            <Button
              className="w-full h-12 text-base font-bold"
              onClick={handleAndroidInstall}
              disabled={installing}
            >
              {installing ? '...' : tx.install_now}
            </Button>
          )}

          {/* iOS / fallback: Got it button */}
          <Button
            className="w-full h-12 text-base font-bold"
            variant={!isIOS && hasDeferredPrompt ? 'outline' : 'default'}
            onClick={handleGotIt}
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            {tx.got_it}
          </Button>

          {/* Don't show again */}
          <button
            onClick={handleNeverShow}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground text-center touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {tx.dont_show}
          </button>
        </div>
      </div>
    </div>
  );
}