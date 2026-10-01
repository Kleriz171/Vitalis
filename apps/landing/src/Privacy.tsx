import { Logo } from './components/Logo';

// DRAFT, written from what the code actually does. Before launch: a lawyer reviews it against
// Albanian Law 124/2024 on personal data protection, and the [bracketed] details are filled in.
// When the substance changes, bump PRIVACY_VERSION in apps/api/src/models/User.ts.
const UPDATED = { sq: '1 tetor 2026', en: '1 October 2026' };

type Section = { h: string; p?: string[]; li?: string[] };

const sq: { title: string; draft: string; updated: string; other: string; sections: Section[] } = {
  title: 'Politika e privatësisë',
  draft: 'Draft: në pritje të rishikimit ligjor. Të dhënat në [kllapa] do të plotësohen para publikimit.',
  updated: `Përditësuar më ${UPDATED.sq}`,
  other: 'English',
  sections: [
    { h: 'Kush jemi', p: ['Vitalis është një rrjet reagimi në emergjenca për Shqipërinë. Përgjegjës për të dhënat tuaja është [emri i shoqërisë], [adresa], NIPT [numri]. Kontakt për privatësinë: [email].'] },
    {
      h: 'Çfarë ruajmë',
      li: [
        'Llogaria: numri i telefonit, emri, data e lindjes, kontakti i urgjencës dhe gjuha e aplikacionit.',
        'Bio Pasaporta: grupi i gjakut, alergjitë, ilaçet, sëmundjet, aftësitë e kufizuara, vaksinat dhe takimet që shtoni vetë.',
        'Vendndodhja: kur dërgoni një SOS ose paraqitje sigurie; për ndihmësit, edhe në sfond ndërsa janë në shërbim.',
        'SOS-et dhe paraqitjet e sigurisë: koha, vendi, statusi dhe kush u përgjigj. PIN-et ruhen vetëm të koduara.',
        'Trajnimi: kurset, rezultatet dhe certifikatat.',
        'Ajo që publikoni vetë: postime në komunitet, kërkesa për gjak ose furnizime, aplikime si mjek (përfshirë dokumentin PDF).',
      ],
    },
    {
      h: 'Pse',
      li: [
        'Për t’ju dërguar ndihmë kur dërgoni një SOS, dhe për t’u treguar ndihmësve ato fakte mjekësore që ndikojnë në trajtimin tuaj.',
        'Për të njoftuar kontaktin tuaj të urgjencës kur dërgoni një SOS ose humbisni një paraqitje sigurie.',
        'Për të vërtetuar certifikatat e trajnimit (kodi QR).',
        'Të dhënat shëndetësore i përpunojmë vetëm me pëlqimin tuaj të qartë, të dhënë gjatë regjistrimit.',
      ],
    },
    {
      h: 'Kush i sheh',
      li: [
        'Ndihmësi që pranon SOS-in tuaj: emri, mosha, grupi i gjakut, alergjitë, ilaçet, sëmundjet dhe kontakti i urgjencës.',
        'Dispeçerët e Vitalis: incidentet dhe vendndodhja e tyre.',
        'Kontakti juaj i urgjencës: një SMS me link privat që tregon statusin e SOS-it, vendin dhe sa larg është ndihma. Linku skadon 2 orë pasi mbaron SOS-i. Kontakti nuk sheh kurrë emrin ose vendin e ndihmësit.',
        'Askush tjetër. Nuk i shesim të dhënat dhe nuk bëjmë reklama.',
      ],
    },
    {
      h: 'Shërbime të jashtme',
      li: [
        'Twilio: dërgimi i SMS-ve (kodet e hyrjes, njoftimet e urgjencës).',
        'Expo: njoftimet push në telefon.',
        'Google Gemini: pyetjet që i shkruani ose i thoni asistentit. Mos shkruani të dhëna personale.',
        'Njohja e zërit e telefonit tuaj (Google në Android, Apple në iPhone), vetëm kur flisni me Vitalis. Fjala “Hey Vitalis” njihet brenda telefonit; zëri nuk largohet prej tij.',
        '[Ofruesi i hostimit dhe i bazës së të dhënave], [vendi].',
      ],
    },
    {
      h: 'Sa kohë',
      p: ['Llogarinë dhe Bio Pasaportën i mbajmë derisa t’i fshini. Regjistrimet e SOS-eve i mbajmë [periudha e kërkuar me ligj] sepse janë edhe regjistri i ndihmësve dhe i dispeçerisë; pasi fshini llogarinë, ato nuk lidhen më me emrin tuaj.'],
    },
    {
      h: 'Të drejtat tuaja',
      li: [
        'Të shihni dhe të shkarkoni të gjitha të dhënat: Profili → Të dhënat tuaja → Shkarko të dhënat e mia.',
        'T’i korrigjoni: Profili, në çdo kohë.',
        'T’i fshini dhe të tërhiqni pëlqimin: Profili → Fshi llogarinë time.',
        'Të ankoheni te Komisioneri për të Drejtën e Informimit dhe Mbrojtjen e të Dhënave Personale (idp.al).',
      ],
    },
  ],
};

const en: typeof sq = {
  title: 'Privacy policy',
  draft: 'Draft: pending legal review. Details in [brackets] are filled in before launch.',
  updated: `Updated ${UPDATED.en}`,
  other: 'Shqip',
  sections: [
    { h: 'Who we are', p: ['Vitalis is an emergency-response network for Albania. The controller of your data is [company name], [address], NIPT [number]. Privacy contact: [email].'] },
    {
      h: 'What we store',
      li: [
        'Account: phone number, name, date of birth, emergency contact and app language.',
        'Bio Passport: blood type, allergies, medication, conditions, disabilities, vaccinations and appointments you add.',
        'Location: when you send an SOS or a safety check-in; for responders, also in the background while on duty.',
        'SOS calls and safety check-ins: time, place, status and who responded. PINs are stored only as hashes.',
        'Training: courses, scores and certificates.',
        'What you post yourself: community posts, blood or supply requests, doctor applications (including the PDF).',
      ],
    },
    {
      h: 'Why',
      li: [
        'To send you help when you send an SOS, and to show responders the medical facts that change how they treat you.',
        'To alert your emergency contact when you send an SOS or miss a safety check-in.',
        'To verify training certificates (QR code).',
        'We process health data only with your explicit consent, given at sign-up.',
      ],
    },
    {
      h: 'Who sees it',
      li: [
        'The responder who accepts your SOS: name, age, blood type, allergies, medication, conditions and emergency contact.',
        'Vitalis dispatchers: incidents and where they are.',
        'Your emergency contact: a text with a private link showing the SOS status, the place and how far help is. The link expires 2 hours after the SOS ends. They never see the responder’s name or position.',
        'Nobody else. We do not sell data or run ads.',
      ],
    },
    {
      h: 'Outside services',
      li: [
        'Twilio: sending texts (sign-in codes, emergency alerts).',
        'Expo: push notifications.',
        'Google Gemini: questions you type or say to the assistant. Do not include personal details.',
        'Your phone’s speech recognition (Google on Android, Apple on iPhone), only while you talk to Vitalis. “Hey Vitalis” is recognised on the phone; that audio never leaves it.',
        '[Hosting and database provider], [country].',
      ],
    },
    {
      h: 'How long',
      p: ['We keep your account and Bio Passport until you delete them. SOS records are kept for [period required by law] because they are also the responders’ and dispatch’s record; once you delete your account they no longer lead to your name.'],
    },
    {
      h: 'Your rights',
      li: [
        'See and download all your data: Profile → Your data → Download my data.',
        'Correct it: on Profile, any time.',
        'Delete it and withdraw consent: Profile → Delete my account.',
        'Complain to the Information and Data Protection Commissioner (idp.al).',
      ],
    },
  ],
};

export const Privacy = () => {
  const isEn = new URLSearchParams(window.location.search).get('l') === 'en';
  const c = isEn ? en : sq;
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <a href="/"><Logo /></a>
          <a className="text-sm font-semibold text-teal-deep underline underline-offset-2" href={isEn ? '/privacy' : '/privacy?l=en'} lang={isEn ? 'sq' : 'en'}>{c.other}</a>
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
      </div>
    </div>
  );
};
