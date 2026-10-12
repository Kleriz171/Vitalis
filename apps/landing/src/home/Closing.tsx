import { useLang } from '../i18n';
import { StoreBadges } from '../components/StoreBadges';
import { LangSwitch } from './Nav';
import logo from '../assets/logo.png';

/** Last call to action on the logo's own teal, then the footer. */
export const Closing = () => {
  const { t } = useLang();
  return (
    <>
      <section className="bg-logo text-white py-24 sm:py-32 lg:py-40 overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="final-title max-w-[14ch]">{t.final.title}</h2>
            <p className="mt-6 max-w-[38ch] text-2xl font-medium leading-snug">{t.final.lead}</p>
            <div className="mt-10"><StoreBadges dark /></div>
          </div>
          <img src={logo} width={192} height={192} alt="" aria-hidden className="hidden lg:block w-48 h-48 rounded-[22%] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]" />
        </div>
      </section>

      <footer className="bg-page text-mist">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12 grid gap-8 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="inline-flex items-center gap-2.5 text-white">
            <img src={logo} width={32} height={32} alt="" aria-hidden className="rounded-[22%]" />
            <span className="text-lg font-bold">Vitalis</span>
          </span>
          <p className="text-sm leading-relaxed max-w-[60ch]">
            {t.footer.disclaimer}{' '}
            <a className="font-semibold text-white underline underline-offset-2" href="tel:127">127</a> {t.footer.or}{' '}
            <a className="font-semibold text-white underline underline-offset-2" href="tel:112">112</a>.{' '}
            <a className="underline underline-offset-2 hover:text-white" href="/privacy">{t.footer.privacy}</a>
            <span className="block mt-2 text-xs text-mist/80">{t.footer.map}</span>
          </p>
          <LangSwitch />
        </div>
      </footer>
    </>
  );
};
