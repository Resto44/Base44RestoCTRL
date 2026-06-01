import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useLanguage } from '@/lib/LanguageContext';
import PWAInstallModal from './PWAInstallModal';

const TEXTS = {
  en: { title: 'Install the App', sub: 'Add to home screen for best experience', install: 'Install', later: 'Later' },
  ar: { title: 'تثبيت التطبيق', sub: 'أضفه للشاشة الرئيسية', install: 'تثبيت', later: 'لاحقاً' },
  fa: { title: 'نصب برنامه', sub: 'به صفحه اصلی اضافه کنید', install: 'نصب', later: 'بعداً' },
};

export default function PWAInstallBanner() {
  const { canInstall, isIOS, hasDeferredPrompt, triggerInstall, dismiss } = usePWAInstall();
  const { lang: language } = useLanguage();
  const [showModal, setShowModal] = useState(false);

  const tx = TEXTS[language] || TEXTS.en;

  if (!canInstall) return null;

  const handleInstallClick = () => {
    if (isIOS || !hasDeferredPrompt) {
      setShowModal(true);
    } else {
      triggerInstall();
    }
  };

  if (showModal) {
    return <PWAInstallModal onClose={() => { setShowModal(false); dismiss(); }} onNeverShow={() => setShowModal(false)} />;
  }

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50"
      style={{ animation: 'slideUp 0.35s ease-out' }}
    >
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div className="bg-primary text-primary-foreground rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
          🍽️
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{tx.title}</p>
          <p className="text-xs text-primary-foreground/75 mt-0.5 leading-tight">{tx.sub}</p>
        </div>
        <Button
          size="sm"
          className="bg-white text-primary hover:bg-white/90 font-bold h-8 px-3 text-xs flex-shrink-0"
          onClick={handleInstallClick}
        >
          {tx.install}
        </Button>
        <button
          onClick={dismiss}
          className="text-primary-foreground/60 hover:text-primary-foreground p-1 flex-shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}