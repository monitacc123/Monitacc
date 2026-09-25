/*
  Konteks Bahasa

  Satu tempat menyimpan bahasa pilihan pengguna, dikongsi ke seluruh aplikasi
  (sistem pengguna DAN sistem admin) tanpa perlu hantar prop turun-temurun.

  CARA GUNA DALAM KOMPONEN
    const { t, lang, setLang } = useLang();
    <h1>{t('users.title')}</h1>
    <p>{t('users.found', { count: 5 })}</p>

  Pilihan bahasa disimpan dalam localStorage pelayar, jadi ia kekal walaupun
  pengguna tutup tab. Ia TIDAK disimpan dalam pangkalan data — setiap peranti
  ada pilihannya sendiri.
*/

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS, type Lang } from './translations';

const STORAGE_KEY = 'monitacc_lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ms',
  setLang: () => {},
  t: (key: string) => key,
});

export const useLang = () => useContext(LanguageContext);

function readStoredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in TRANSLATIONS) return saved as Lang;
  } catch {
    // Mod peribadi atau storan disekat — guna lalai sahaja.
  }
  return 'ms';
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'ms';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang: (l: Lang) => {
      setLangState(l);
      try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storan disekat */ }
    },
    // Jatuh balik ke Bahasa Melayu bila kunci belum diterjemah, dan ke kunci
    // itu sendiri bila ia langsung tiada — antara muka takkan pernah kosong.
    t: (key: string, vars?: Record<string, string | number>) => {
      let text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.ms[key] ?? key;
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(val));
        }
      }
      return text;
    },
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
