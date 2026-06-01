import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed_v2';
const NEVER_SHOW_KEY = 'pwa_install_never_show';
const MAX_DISMISSALS = 3;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Already running as installed PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (standalone) {
      setIsInstalled(true);
      return; // never show banner in standalone
    }

    // User said "never show again"
    if (localStorage.getItem(NEVER_SHOW_KEY) === '1') return;

    // Too many dismissals
    const dismissCount = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    if (dismissCount >= MAX_DISMISSALS) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    const android = /android/i.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    if (ios) {
      // iOS Safari: always show guided instructions (no native prompt)
      // Small delay so it doesn't feel intrusive on first load
      const t = setTimeout(() => setCanInstall(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Desktop: wait for browser's beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    const count = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    localStorage.setItem(DISMISS_KEY, String(count + 1));
    setCanInstall(false);
  }, []);

  const neverShow = useCallback(() => {
    localStorage.setItem(NEVER_SHOW_KEY, '1');
    setCanInstall(false);
  }, []);

  return {
    canInstall,
    isInstalled,
    isIOS,
    isAndroid,
    hasDeferredPrompt: !!deferredPrompt,
    triggerInstall,
    dismiss,
    neverShow,
  };
}