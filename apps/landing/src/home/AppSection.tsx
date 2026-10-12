import { useLang } from '../i18n';

/** Caller and responder, rendered in Blender with the real screens in the visitor's language. */
export const AppSection = () => {
  const { t, lang } = useLang();
  return (
    <section className="bg-paper text-ink pt-24 sm:pt-32 lg:pt-40 pb-20 sm:pb-28 overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12 items-center">
          <div>
            <h2 className="section-title max-w-[15ch]">{t.app.title}</h2>
            <p className="mt-6 max-w-[44ch] text-lg text-muted leading-relaxed">{t.app.lead}</p>
            <p className="mt-8 flex gap-6 text-sm font-semibold text-muted">
              <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-sos align-middle" />{t.app.callerCaption}</span>
              <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-green align-middle" />{t.app.responderCaption}</span>
            </p>
          </div>
          <img
            src={`/renders/phones-${lang}.webp`}
            width={1800} height={1800} loading="lazy" decoding="async"
            alt={`${t.app.callerAlt} ${t.app.responderAlt}`}
            className="phone-rise -mx-6 w-[calc(100%+3rem)] max-w-none sm:mx-0 sm:w-full sm:max-w-[720px] lg:justify-self-end"
          />
        </div>
        <dl className="mt-14 lg:mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {t.app.features.map((f) => (
            <div key={f.title} className="border-t border-ink/15 pt-5">
              <dt className="text-lg font-bold leading-snug">{f.title}</dt>
              <dd className="mt-2 text-muted leading-relaxed">{f.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
