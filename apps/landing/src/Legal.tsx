import { Logo } from './components/Logo';

export type LegalSection = { h: string; p?: string[]; li?: string[] };
export type LegalDoc = { title: string; draft: string; updated: string; other: string; sections: LegalSection[] };

const LINKS = {
  sq: [['/privacy', 'Politika e privatësisë'], ['/terms', 'Kushtet e përdorimit']],
  en: [['/privacy?l=en', 'Privacy policy'], ['/terms?l=en', 'Terms of use']],
} as const;

/** One legal document in Albanian (default) or English (?l=en), with links to the others. */
export const LegalPage = ({ path, docs }: { path: string; docs: { sq: LegalDoc; en: LegalDoc } }) => {
  const isEn = new URLSearchParams(window.location.search).get('l') === 'en';
  const c = isEn ? docs.en : docs.sq;
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <a href="/"><Logo /></a>
          <a className="text-sm font-semibold text-teal-deep underline underline-offset-2" href={isEn ? path : `${path}?l=en`} lang={isEn ? 'sq' : 'en'}>{c.other}</a>
        </div>
        <main lang={isEn ? 'en' : 'sq'} className="mt-10">
          <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-deep">{c.draft}</p>
          <h1 className="mt-6 text-4xl font-extrabold">{c.title}</h1>
          <p className="mt-2 text-sm text-muted">{c.updated}</p>
          {c.sections.map(s => (
            <section key={s.h} className="mt-8">
              <h2 className="text-xl font-bold">{s.h}</h2>
              {s.p?.map(p => <p key={p} className="mt-3 leading-relaxed">{p}</p>)}
              {s.li ? <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">{s.li.map(l => <li key={l}>{l}</li>)}</ul> : null}
            </section>
          ))}
        </main>
        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-black/10 pt-6 text-sm" lang={isEn ? 'en' : 'sq'}>
          {LINKS[isEn ? 'en' : 'sq'].map(([href, label]) => (
            <a key={href} href={href} className="font-semibold text-teal-deep underline underline-offset-2">{label}</a>
          ))}
        </nav>
      </div>
    </div>
  );
};
