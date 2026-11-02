import { useEffect, useState } from 'react';
import { Logo } from './components/Logo';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

type Profile = {
  name: string; age?: number; language?: string; bloodType?: string | null;
  allergies?: { allergen: string; severity: string }[]; medications?: string[]; conditions?: string[];
  emergencyContact?: { name?: string; phone: string };
};

const T = {
  en: {
    title: 'Medical ID', loading: 'Opening…', invalid: 'This medical ID is not valid or was switched off.',
    blood: 'Blood type', allergies: 'Allergies', meds: 'Medication', conditions: 'Conditions', contact: 'Emergency contact',
    none: 'None recorded', unknown: 'Not known', years: (n: number) => `${n} years`, severe: 'Severe allergy',
    note: 'Shown because you opened this person’s Vitalis medical ID. They chose what appears here, and they can see that it was opened. In an emergency, call 127 (ambulance) or 112.',
    sev: { mild: 'mild', moderate: 'moderate', severe: 'severe' } as Record<string, string>, other: 'Shqip',
  },
  sq: {
    title: 'ID mjekësore', loading: 'Po hapet…', invalid: 'Kjo ID mjekësore nuk është e vlefshme ose është çaktivizuar.',
    blood: 'Grupi i gjakut', allergies: 'Alergji', meds: 'Ilaçe', conditions: 'Sëmundje', contact: 'Kontakti i urgjencës',
    none: 'Asnjë e regjistruar', unknown: 'I panjohur', years: (n: number) => `${n} vjeç`, severe: 'Alergji e rëndë',
    note: 'Shfaqet sepse hapët ID-në mjekësore Vitalis të këtij personi. Ai zgjodhi çfarë shfaqet këtu dhe mund ta shohë që u hap. Në urgjencë, telefononi 127 (ambulanca) ose 112.',
    sev: { mild: 'e lehtë', moderate: 'mesatare', severe: 'e rëndë' } as Record<string, string>, other: 'English',
  },
};

/** The online emergency profile behind a medical ID QR: only what the owner chose to show. */
export const MedicalId = ({ token }: { token: string }) => {
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  const param = new URLSearchParams(window.location.search).get('l');
  const lang = param === 'en' || param === 'sq' ? param : p?.language === 'en' ? 'en' : 'sq';
  const t = T[lang];

  useEffect(() => {
    fetch(`${API}/medical-id/${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setP)
      .catch(() => setError(true));
  }, [token]);

  const list = (items?: string[]) => (items?.length ? items.join(', ') : t.none);
  const severe = p?.allergies?.filter(a => a.severity === 'severe') ?? [];

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        <a href="/"><Logo /></a>
        <a className="text-sm font-semibold text-teal-deep underline underline-offset-2" href={`?l=${lang === 'en' ? 'sq' : 'en'}`}>{t.other}</a>
      </div>
      <main className="w-full max-w-md" lang={lang}>
        {error ? (
          <section className="rounded-2xl bg-white border border-border p-8 text-center"><h1 className="text-2xl font-bold">{t.invalid}</h1></section>
        ) : !p ? (
          <p className="text-center text-muted">{t.loading}</p>
        ) : (
          <section className="rounded-2xl bg-white border border-border overflow-hidden">
            <div className="bg-teal-deep text-white p-6">
              <p className="text-sm font-semibold opacity-80">{t.title}</p>
              <h1 className="mt-1 text-3xl font-extrabold">{p.name}</h1>
              {p.age != null && <p className="mt-1 text-lg">{t.years(p.age)}</p>}
            </div>
            {severe.length > 0 && <p className="bg-sos text-white px-6 py-3 font-semibold">{t.severe}: {severe.map(a => a.allergen).join(', ')}</p>}
            <dl className="p-6 grid grid-cols-[130px_1fr] gap-y-3 text-[15px]">
              {'bloodType' in p && (<><dt className="text-muted">{t.blood}</dt><dd className="font-bold text-lg">{p.bloodType ?? t.unknown}</dd></>)}
              {p.allergies && (<><dt className="text-muted">{t.allergies}</dt><dd>{p.allergies.length ? p.allergies.map(a => `${a.allergen} (${t.sev[a.severity] ?? a.severity})`).join(', ') : t.none}</dd></>)}
              {p.medications && (<><dt className="text-muted">{t.meds}</dt><dd>{list(p.medications)}</dd></>)}
              {p.conditions && (<><dt className="text-muted">{t.conditions}</dt><dd>{list(p.conditions)}</dd></>)}
              {p.emergencyContact && (<><dt className="text-muted">{t.contact}</dt><dd>{p.emergencyContact.name} · <a className="font-semibold text-teal-deep underline" href={`tel:${p.emergencyContact.phone}`}>{p.emergencyContact.phone}</a></dd></>)}
            </dl>
            <p className="px-6 pb-6 text-sm text-muted leading-relaxed">{t.note}</p>
          </section>
        )}
      </main>
    </div>
  );
};
