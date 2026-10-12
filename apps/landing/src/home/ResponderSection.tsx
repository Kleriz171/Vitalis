import { useLang } from '../i18n';
import { StoreBadges } from '../components/StoreBadges';

/** Four real steps from citizen to responder; the numbers are the order, not decoration. */
export const ResponderSection = () => {
  const { t } = useLang();
  return (
    <section className="bg-paper text-ink py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 className="section-title max-w-[17ch]">{t.responder.title}</h2>
          <p className="max-w-[46ch] text-lg text-muted leading-relaxed">{t.responder.lead}</p>
        </div>
        <ol className="steps mt-16 lg:mt-24 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {t.responder.steps.map((s, i) => (
            <li key={s.title} className="step relative">
              <span className="step-dot" aria-hidden>{i + 1}</span>
              <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 max-w-[30ch] text-muted leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-16"><StoreBadges /></div>
      </div>
    </section>
  );
};
