import { BadgeCheck, Phone, ShieldCheck } from 'lucide-react';
import { useLang } from '../i18n';

const ICONS = [BadgeCheck, Phone, ShieldCheck];

/** Three plain promises, set as columns with rules rather than cards. */
export const TrustSection = () => {
  const { t } = useLang();
  return (
    <section className="bg-paper text-ink py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <h2 className="section-title max-w-[18ch]">{t.trust.title}</h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-ink/15">
          {t.trust.items.map((it, i) => {
            const Icon = ICONS[i];
            return (
              <div key={it.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <h3 className="flex items-center gap-3 text-xl font-bold">
                  <Icon size={22} className="text-green shrink-0" aria-hidden />
                  {it.title}
                </h3>
                <p className="mt-3 text-muted leading-relaxed">{it.body}</p>
              </div>
            );
          })}
        </div>
        <a href="/privacy" className="mt-12 inline-block font-semibold underline underline-offset-4 decoration-ink/30 hover:decoration-ink">{t.trust.privacy}</a>
      </div>
    </section>
  );
};
