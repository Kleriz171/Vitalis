import { useLang } from '../i18n';

/** Both watches, rendered in Blender with their real screens, on the page's deep green. */
export const WatchSection = () => {
  const { t } = useLang();
  return (
    <section className="bg-page text-white py-24 sm:py-32 lg:py-40 overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-20 items-center">
        <img
          src="/renders/watches.webp" width={1800} height={1300} loading="lazy" decoding="async"
          alt={`${t.watch.appleAlt} ${t.watch.wearAlt}`}
          className="lift order-2 lg:order-1 -mx-6 w-[calc(100%+3rem)] max-w-none sm:mx-0 sm:w-full"
        />
        <div className="order-1 lg:order-2">
          <h2 className="section-title max-w-[15ch]">{t.watch.title}</h2>
          <ul className="mt-10 space-y-6 max-w-[48ch]">
            {t.watch.points.map((p) => (
              <li key={p} className="flex gap-4 text-lg text-mist leading-relaxed">
                <span className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-mint" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-10 font-semibold">{t.watch.platforms}</p>
        </div>
      </div>
    </section>
  );
};
