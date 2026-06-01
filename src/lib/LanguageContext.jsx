import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from './i18n';

const LanguageContext = createContext();

const safeGet = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => safeGet('rc_lang', 'en'));
  const [currency, setCurrency] = useState(() => safeGet('rc_currency', '$'));
  const [darkMode, setDarkMode] = useState(() => safeGet('rc_dark', 'false') === 'true');

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;
  const dir = translations[lang]?.dir || 'ltr';

  useEffect(() => {
    try { localStorage.setItem('rc_lang', lang); } catch {}
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang, dir]);

  useEffect(() => {
    try { localStorage.setItem('rc_currency', currency); } catch {}
  }, [currency]);

  useEffect(() => {
    try { localStorage.setItem('rc_dark', darkMode); } catch {}
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir, currency, setCurrency, darkMode, setDarkMode }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (k) => k, dir: 'ltr', currency: '$', setCurrency: () => {}, darkMode: false, setDarkMode: () => {} };
  return ctx;
}