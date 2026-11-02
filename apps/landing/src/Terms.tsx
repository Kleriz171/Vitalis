import { LegalPage, type LegalDoc } from './Legal';

// DRAFT, written from what the product actually does. Before launch: a lawyer reviews it against
// Albanian law and the [bracketed] details are filled in.
const UPDATED = { sq: '2 nëntor 2026', en: '2 November 2026' };

const sq: LegalDoc = {
  title: 'Kushtet e përdorimit',
  draft: 'Draft: në pritje të rishikimit ligjor. Të dhënat në [kllapa] do të plotësohen para publikimit.',
  updated: `Përditësuar më ${UPDATED.sq}`,
  other: 'English',
  sections: [
    { h: 'Çfarë është Vitalis', p: ['Vitalis lidh një person në emergjencë me ndihmës të trajnuar afër tij, me defibrilatorët publikë dhe me operatorët e emergjencës. Shërbimi ofrohet nga [emri i shoqërisë], [adresa], NIPT [numri].'] },
    {
      h: 'Vitalis nuk zëvendëson 127 ose 112',
      li: [
        'Në një emergjencë, telefononi gjithmonë edhe 127 (ambulanca) ose 112.',
        'Nuk garantojmë që një ndihmës do të jetë afër, do ta pranojë thirrjen ose do të mbërrijë brenda një kohe të caktuar.',
        'Aplikacioni ka nevojë për internet dhe vendndodhje; pa to, SOS-i mund të mos dërgohet.',
      ],
    },
    {
      h: 'Llogaria juaj',
      li: [
        'Jepni të dhëna të vërteta, sidomos ato mjekësore në Bio Pasaportë: ndihmësit mbështeten tek to.',
        'Ruani telefonin dhe fjalëkalimin tuaj. Na njoftoni në [email] nëse dikush tjetër e ka përdorur llogarinë tuaj.',
        'Llogaritë e stafit (operatorë, administratorë, spitale) krijohen vetëm nga një administrator i Vitalis.',
      ],
    },
    {
      h: 'Përdorimi i ndershëm',
      li: [
        'Mos dërgoni SOS të rremë dhe mos e përdorni shërbimin për të ngacmuar dikë.',
        'Mos u përpiqni të hyni në të dhënat e të tjerëve ose të pengoni funksionimin e shërbimit.',
        'Mund të pezullojmë ose mbyllim llogari që i shkelin këto rregulla, ose kur ligji e kërkon.',
      ],
    },
    {
      h: 'Ndihmësit',
      li: [
        'Ndihmësit janë vullnetarë. Shkojnë në shërbim kur duan dhe mund ta refuzojnë çdo thirrje.',
        'Certifikata e Vitalis tregon që keni kaluar kursin e masazhit të zemrës ose të defibrilatorit në aplikacion. Nuk është licencë profesionale.',
        'Mjekët dhe infermierët verifikohen nga ekipi ynë sipas dokumenteve që dërgojnë.',
        'Ndihmoni vetëm kur është e sigurt për ju.',
      ],
    },
    {
      h: 'Asistenti dhe informacioni mjekësor',
      p: ['Asistenti dhe udhëzimet e ndihmës së parë japin informacion të përgjithshëm, jo diagnozë apo trajtim. Për çdo problem shëndetësor, flisni me një mjek.'],
    },
    {
      h: 'Përgjegjësia',
      p: ['Vitalis ofrohet falas dhe ashtu siç është. Brenda kufijve që lejon ligji shqiptar, nuk mbajmë përgjegjësi për dëme që vijnë nga mosfunksionimi i rrjetit, i telefonit ose i shërbimeve të jashtme. Asgjë në këto kushte nuk kufizon të drejtat që ju jep ligji.'],
    },
    {
      h: 'Ndryshimet dhe ligji',
      li: [
        'Kur këto kushte ndryshojnë në thelb, ndryshon data më lart dhe ju njoftojmë [si].',
        'Për këto kushte zbatohet ligji i Republikës së Shqipërisë.',
        'Pyetje: [email].',
      ],
    },
  ],
};

const en: LegalDoc = {
  title: 'Terms of use',
  draft: 'Draft: pending legal review. Details in [brackets] are filled in before launch.',
  updated: `Updated ${UPDATED.en}`,
  other: 'Shqip',
  sections: [
    { h: 'What Vitalis is', p: ['Vitalis connects a person in an emergency with trained responders nearby, public defibrillators and emergency operators. The service is provided by [company name], [address], NIPT [number].'] },
    {
      h: 'Vitalis does not replace 127 or 112',
      li: [
        'In an emergency, always call 127 (ambulance) or 112 as well.',
        'We cannot promise that a responder is nearby, accepts the call or arrives within any particular time.',
        'The app needs a data connection and your location; without them an SOS may not go through.',
      ],
    },
    {
      h: 'Your account',
      li: [
        'Give true details, especially the medical facts in your Bio Passport: responders rely on them.',
        'Keep your phone and password safe. Tell us at [email] if someone else has used your account.',
        'Staff accounts (operators, administrators, hospitals) are created only by a Vitalis administrator.',
      ],
    },
    {
      h: 'Fair use',
      li: [
        'Do not send false SOS alerts or use the service to harass anyone.',
        'Do not try to reach other people’s data or disrupt the service.',
        'We may suspend or close accounts that break these rules, or when the law requires it.',
      ],
    },
    {
      h: 'Responders',
      li: [
        'Responders are volunteers. They go on duty when they choose and may decline any call.',
        'A Vitalis certificate shows you passed the in-app CPR or defibrillator course. It is not a professional licence.',
        'Doctors and nurses are verified by our team from the documents they send.',
        'Help only when it is safe for you to do so.',
      ],
    },
    {
      h: 'The assistant and medical information',
      p: ['The assistant and the first-aid guides give general information, not a diagnosis or treatment. For any health problem, talk to a doctor.'],
    },
    {
      h: 'Liability',
      p: ['Vitalis is free and provided as is. To the extent Albanian law allows, we are not liable for harm caused by failures of the network, your phone or outside services. Nothing in these terms limits rights the law gives you.'],
    },
    {
      h: 'Changes and law',
      li: [
        'When these terms change in substance, the date above changes and we tell you [how].',
        'These terms are governed by the law of the Republic of Albania.',
        'Questions: [email].',
      ],
    },
  ],
};

export const Terms = () => <LegalPage path="/terms" docs={{ sq, en }} />;
