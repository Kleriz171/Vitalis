import { useLang } from '../i18n';

/** Caller and responder side by side: the same app on both ends of an emergency. */
export const AppSection = () => {
  const { t } = useLang();
  return (
    <section className="bg-paper text-ink py-24 sm:py-32 lg:py-40 overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-16 lg:grid-cols-[1fr_1.05fr] lg:gap-20 items-center">
        <div>
          <h2 className="section-title max-w-[16ch]">{t.app.title}</h2>
          <p className="mt-6 max-w-[46ch] text-lg text-muted leading-relaxed">{t.app.lead}</p>
          <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {t.app.features.map((f) => (
              <div key={f.title} className="border-t border-ink/15 pt-5">
                <dt className="text-lg font-bold leading-snug">{f.title}</dt>
                <dd className="mt-2 text-muted leading-relaxed">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto grid w-full max-w-[560px] grid-cols-2 items-start gap-5 sm:gap-8">
          <figure className="phone-rise">
            <div className="phone"><img src="/screen-sos.png" width={780} height={1688} loading="lazy" alt={t.app.callerAlt} /></div>
            <figcaption className="mt-4 text-sm font-semibold text-muted">{t.app.callerCaption}</figcaption>
          </figure>
          <figure className="phone-rise phone-rise-late mt-16 sm:mt-24">
            <div className="phone"><img src="/screen-responder.png" width={780} height={1688} loading="lazy" alt={t.app.responderAlt} /></div>
            <figcaption className="mt-4 text-sm font-semibold text-muted">{t.app.responderCaption}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};
