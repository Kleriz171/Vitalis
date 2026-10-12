import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Copy } from './en';
import { sq } from './sq';

export type Lang = 'sq' | 'en';
const COPY: Record<Lang, Copy> = { en, sq };

/** ?lang= in the URL, then the visitor's last choice, then the browser's language. Albanian by default in Albania. */
const initial = (): Lang => {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'sq' || fromUrl === 'en') return fromUrl;
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'sq' || saved === 'en') return saved;
  } catch { /* storage blocked: fall through */ }
  return navigator.languages.some((l) => l.toLowerCase().startsWith('sq')) ? 'sq' : 'en';
};

const LangContext = createContext<{ lang: Lang; t: Copy; setLang: (l: Lang) => void }>({ lang: 'en', t: en, setLang: () => {} });

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(initial);
  const t = COPY[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description);
  }, [lang, t]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch { /* not saved, still switched */ }
  };

  return <LangContext.Provider value={{ lang, t, setLang }}>{children}</LangContext.Provider>;
};

export const useLang = () => useContext(LangContext);
