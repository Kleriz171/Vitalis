import { ArrowRight } from 'lucide-react';
import { useLang } from '../i18n';

// ponytail: placeholder until the partnerships inbox exists; the .example domain can never receive mail.
export const PARTNERS_EMAIL = 'partners@vitalis.example';

/** The business offer: defibrillators kept ready, staff trained, help on site. */
export const OrganisationsSection = () => {
  const { t } = useLang();
  return (
    <section className="bg-green text-white py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="section-title max-w-[15ch]">{t.orgs.title}</h2>
          <p className="mt-6 max-w-[40ch] text-lg text-mist leading-relaxed">{t.orgs.lead}</p>
          <a
            href={`mailto:${PARTNERS_EMAIL}`}
            className="group mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-white pl-7 pr-6 text-lg font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            {t.orgs.cta}
            <ArrowRight size={20} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </a>
        </div>
        <ul className="divide-y divide-white/15 border-y border-white/15">
          {t.orgs.items.map((it) => (
            <li key={it.title} className="grid gap-2 py-8 sm:grid-cols-[14rem_1fr] sm:gap-8">
              <h3 className="text-xl font-bold">{it.title}</h3>
              <p className="text-lg text-mist leading-relaxed">{it.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
