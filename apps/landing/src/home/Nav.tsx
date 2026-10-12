import { useEffect, useState } from 'react';
import { useLang, type Lang } from '../i18n';
import logo from '../assets/logo.png';

export const LangSwitch = ({ light = true }: { light?: boolean }) => {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-full p-1 text-sm font-semibold ${light ? 'bg-white/10' : 'bg-ink/[0.06]'}`}>
      {(['sq', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`min-w-11 h-9 rounded-full px-3 uppercase transition-colors duration-200 ${
            lang === l ? (light ? 'bg-white text-ink' : 'bg-ink text-white') : light ? 'text-white/80 hover:text-white' : 'text-ink/70 hover:text-ink'}`}
        >
          {l === 'sq' ? 'SQ' : 'EN'}
        </button>
      ))}
    </div>
  );
};

/** Transparent over the city; turns to the paper sheet once the story is scrolled past. */
export const Nav = () => {
  const { t } = useLang();
  const [solid, setSolid] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const story = document.getElementById('story');
    const on = () => {
      setSolid(!!story && window.scrollY > story.offsetTop + story.offsetHeight - 72);
      setScrolled(window.scrollY > 40);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${solid ? 'bg-paper text-ink shadow-[0_1px_0_rgba(19,32,31,0.08)]' : scrolled ? 'bg-page text-white' : 'text-white'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="/" className="inline-flex items-center gap-2.5" aria-label="Vitalis">
          <img src={logo} width={34} height={34} alt="" className="rounded-[22%]" />
          <span className="text-lg font-bold tracking-[-0.01em]">Vitalis</span>
        </a>
        <div className="flex items-center gap-3">
          <LangSwitch light={!solid} />
          <a
            href="#get"
            className={`hidden sm:inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${
              solid ? 'bg-ink text-white hover:bg-green' : 'bg-white text-ink hover:bg-mint'}`}
          >
            {t.nav.getApp}
          </a>
        </div>
      </div>
    </header>
  );
};
