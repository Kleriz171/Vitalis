import { LegalPage, type LegalDoc } from './Legal';

// DRAFT, written from what the code actually does. Before launch: a lawyer reviews it against
// Albanian Law 124/2024 on personal data protection, and the [bracketed] details are filled in.
// When the substance changes, bump PRIVACY_VERSION in apps/api/src/models/User.ts.
const UPDATED = { sq: '2 nëntor 2026', en: '2 November 2026' };

const sq: LegalDoc = {
  title: 'Politika e privatësisë',
  draft: 'Draft: në pritje të rishikimit ligjor. Të dhënat në [kllapa] do të plotësohen para publikimit.',
  updated: `Përditësuar më ${UPDATED.sq}`,
  other: 'English',
  sections: [
    { h: 'Kush jemi', p: ['Vitalis është një rrjet reagimi në emergjenca për Shqipërinë. Përgjegjës për të dhënat tuaja është [emri i shoqërisë], [adresa], NIPT [numri]. Kontakt për privatësinë: [email].'] },
    {
      h: 'Çfarë ruajmë',
      li: [
        'Llogaria: numri i telefonit, emri, data e lindjes, kontakti i urgjencës, rrethi i urgjencës dhe gjuha e aplikacionit.',
        'Bio Pasaporta: grupi i gjakut, alergjitë, ilaçet, sëmundjet, aftësitë e kufizuara, vaksinat dhe takimet që shtoni vetë.',
        'Vendndodhja: kur dërgoni një SOS ose paraqitje sigurie; për ndihmësit, edhe në sfond ndërsa janë në shërbim.',
        'SOS-et dhe paraqitjet e sigurisë: koha, vendi, statusi dhe kush u përgjigj. PIN-et ruhen vetëm të koduara.',
        'Trajnimi: kurset, rezultatet dhe certifikatat.',
        'Ajo që publikoni vetë: postime në komunitet, kërkesa për gjak ose furnizime, aplikime si mjek (përfshirë dokumentin PDF).',
        'Foto dhe video nga droni i dërguar te një emergjencë, të ruajtura 30 ditë.',
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
        'Operatorët e emergjencës së Vitalis: incidentet, vendndodhjen dhe të njëjtat fakte mjekësore që sheh ndihmësi.',
        'Administratorët e Vitalis: llogarinë dhe të dhënat tuaja, vetëm për verifikim dhe mbështetje.',
        'Kontakti juaj i urgjencës dhe njerëzit në rrethin tuaj të urgjencës (deri në pesë, që i zgjidhni vetë): një SMS kur dërgoni një SOS. Me lejen tuaj për secilin, SMS-i ka një link privat që tregon statusin, vendin dhe sa larg është ndihma; linku skadon 2 orë pasi mbaron SOS-i. Ata nuk shohin kurrë emrin ose vendin e ndihmësit.',
        'Kushdo që skanon kodin QR të ID-së suaj mjekësore: vetëm të dhënat që keni zgjedhur ta tregojë. Çdo hapje e linkut të tij shfaqet te “Kush hapi të dhënat e mia”, dhe mund ta anuloni linkun në çdo kohë.',
        'Një mjek me të cilin rezervoni një konsultë, vetëm nëse e lejoni për atë konsultë, deri 30 ditë pas saj. Çdo shikim regjistrohet dhe ju e shihni.',
        'Askush tjetër. Nuk i shesim të dhënat dhe nuk bëjmë reklama.',
      ],
    },
    {
      h: 'Shërbime të jashtme',
      li: [
        'Twilio: dërgimi i SMS-ve (kodet e hyrjes, njoftimet e urgjencës).',
        'Expo dhe Google Firebase Cloud Messaging: njoftimet push në telefon.',
        'Google Gemini: pyetjet që i shkruani ose i thoni asistentit. Mos shkruani të dhëna personale.',
        'Njohja e zërit e telefonit tuaj (Google në Android, Apple në iPhone), vetëm kur flisni me Vitalis. Fjala “Hey Vitalis” njihet brenda telefonit; zëri nuk largohet prej tij.',
        'Render (Frankfurt, Gjermani) drejton serverin; MongoDB Atlas (Frankfurt, Gjermani) ruan të dhënat.',
      ],
    },
    {
      h: 'Si i mbrojmë',
      li: [
        'Çdo lidhje me serverin është e koduar (HTTPS).',
        'Fjalëkalimet dhe PIN-et ruhen vetëm të koduara (bcrypt); kodet e kutive të defibrilatorëve ruhen të enkriptuara.',
        'Hyrja skadon pas 15 minutash pa rifreskim; dalja nga llogaria e anulon hyrjen e ruajtur në server.',
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

const en: LegalDoc = {
  title: 'Privacy policy',
  draft: 'Draft: pending legal review. Details in [brackets] are filled in before launch.',
  updated: `Updated ${UPDATED.en}`,
  other: 'Shqip',
  sections: [
    { h: 'Who we are', p: ['Vitalis is an emergency-response network for Albania. The controller of your data is [company name], [address], NIPT [number]. Privacy contact: [email].'] },
    {
      h: 'What we store',
      li: [
        'Account: phone number, name, date of birth, emergency contact, emergency circle and app language.',
        'Bio Passport: blood type, allergies, medication, conditions, disabilities, vaccinations and appointments you add.',
        'Location: when you send an SOS or a safety check-in; for responders, also in the background while on duty.',
        'SOS calls and safety check-ins: time, place, status and who responded. PINs are stored only as hashes.',
        'Training: courses, scores and certificates.',
        'What you post yourself: community posts, blood or supply requests, doctor applications (including the PDF).',
        'Photos and video from a drone sent to an emergency, kept for 30 days.',
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
        'Vitalis emergency operators: incidents, where they are, and the same medical facts the responder sees.',
        'Vitalis administrators: your account and records, only for verification and support.',
        'Your emergency contact and the people in your emergency circle (up to five, chosen by you): a text when you send an SOS. Where you allow it for that person, the text has a private link showing the SOS status, the place and how far help is; it expires 2 hours after the SOS ends. They never see the responder’s name or position.',
        'Anyone who scans your medical ID QR: only the facts you chose to show. Every opening of its link appears under “Who opened my records”, and you can revoke the link at any time.',
        'A clinician you book, only if you allow it for that consultation, until 30 days after it. Every view is logged and you can see it.',
        'Nobody else. We do not sell data or run ads.',
      ],
    },
    {
      h: 'Outside services',
      li: [
        'Twilio: sending texts (sign-in codes, emergency alerts).',
        'Expo and Google Firebase Cloud Messaging: push notifications.',
        'Google Gemini: questions you type or say to the assistant. Do not include personal details.',
        'Your phone’s speech recognition (Google on Android, Apple on iPhone), only while you talk to Vitalis. “Hey Vitalis” is recognised on the phone; that audio never leaves it.',
        'Render (Frankfurt, Germany) runs the server; MongoDB Atlas (Frankfurt, Germany) stores the data.',
      ],
    },
    {
      h: 'How we protect it',
      li: [
        'Every connection to the server is encrypted (HTTPS).',
        'Passwords and PINs are stored only as hashes (bcrypt); defibrillator cabinet codes are stored encrypted.',
        'A sign-in lasts 15 minutes unless it is refreshed; signing out cancels the saved sign-in on the server.',
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

export const Privacy = () => <LegalPage path="/privacy" docs={{ sq, en }} />;
