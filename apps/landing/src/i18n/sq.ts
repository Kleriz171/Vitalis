import type { Copy } from './en';

// Albanian copy. DRAFT: pending native-speaker review, like the phone app's Albanian.
export const sq: Copy = {
  meta: {
    title: 'Vitalis · Ndihma që jeton në rrugën tënde',
    description: 'Kur dikush rrëzohet pa ndjenja, Vitalis thërret ndihmësin e trajnuar më të afërt dhe dërgon një të dytë me defibrilator. Falas, fillimisht në Tiranë.',
  },
  nav: { getApp: 'Shkarko aplikacionin', language: 'Gjuha' },
  hero: {
    title: 'Ndihma që jeton në rrugën tënde.',
    lead: 'Kur dikush rrëzohet pa ndjenja, Vitalis thërret ndihmësin e trajnuar më të afërt dhe dërgon një të dytë me defibrilator. Shpesh disa minuta para ambulancës.',
    note: 'Falas. Fillimisht në Tiranë.',
    cue: 'Lëviz poshtë për të parë si funksionon',
  },
  story: {
    beats: [
      {
        title: 'Dikush rrëzohet pranë Galerisë Kombëtare.',
        body: 'Shoqja e saj shtyp SOS. Tre sekonda për ta anuluar, pastaj Vitalis e di saktësisht ku ndodhet dhe që ajo nuk merr frymë.',
      },
      {
        title: 'Ndihmësi më i afërt është tashmë në lëvizje.',
        body: 'Vitalis njofton ndihmësit e certifikuar aty pranë, jo gjithë qytetin. Një infermiere më pak se një kilometër larg pranon e para dhe udhëzohet drejt e atje.',
      },
      {
        title: 'Një ndihmës i dytë sjell defibrilatorin.',
        body: 'Në një arrest kardiak, një ndihmës tjetër dërgohet te defibrilatori publik më i afërt, këtu në Sheshin Skënderbej, ndërsa ambulanca është ende në trafik.',
      },
      {
        title: 'Ndihma mbërrin e para. Ekipi merr gjithçka gati.',
        body: 'Deri atëherë, aplikacioni e udhëzon shoqen me masazhin e zemrës, 110 shtypje në minutë. Kur mbërrin ambulanca, ekipi i di tashmë alergjitë, ilaçet e saj dhe çfarë ndodhi.',
      },
    ],
    labels: { sos: 'SOS', aed: 'Defibrilator', r1: 'Ndihmës', r2: 'Ndihmës me defibrilator' },
    credit: 'Qendra e vërtetë e Tiranës, ndërtuar nga OpenStreetMap.',
  },
  app: {
    title: 'Një aplikacion për atë që ka nevojë, dhe për atë që ndihmon.',
    lead: 'Vitalis është falas për të gjithë. I njëjti aplikacion që thërret ndihmë është ai me të cilin përgjigjen ndihmësit.',
    features: [
      { title: 'SOS, edhe pa duar', body: 'Shtyp SOS, ose thuaj “Hey Vitalis” në Android. Një rrëzim i fortë mund ta japë alarmin vetë nëse nuk përgjigjesh.' },
      { title: 'Një udhëzues për masazhin e zemrës', body: 'Një ritëm i qëndrueshëm dhe udhëzime të thjeshta derisa të marrë përsipër një ndihmës ose ambulanca.' },
      { title: 'ID-ja jote mjekësore, gati për ekipin', body: 'Alergjitë, ilaçet dhe sëmundjet, që i dorëzohen ekipit bashkë me pacientin.' },
      { title: 'Në detyrë kur je i lirë', body: 'Ndihmësit hyjnë në detyrë dhe njoftohen vetëm për urgjencat aty pranë.' },
    ],
    callerAlt: 'Ekrani i atij që kërkon ndihmë gjatë një SOS: ndihmësit e njoftuar, butoni për të thirrur ambulancën dhe rrethi që mban ritmin e masazhit të zemrës.',
    responderAlt: 'Ekrani i ndihmësit: në detyrë, me një thirrje për arrest kardiak të pranuar, udhëzimet dhe të dhënat e pacientit.',
    callerCaption: 'Ai që kërkon ndihmë',
    responderCaption: 'Ndihmësi',
  },
  watch: {
    title: 'Në kyçin e dorës, kur telefoni nuk është pranë.',
    points: [
      'Mbaj SOS për tre sekonda. Një numërim mbrapsht të lejon ta anulosh.',
      'Nëse rrahjet e zemrës në qetësi mbeten rrezikshëm të larta ose të ulëta, ora të pyet nëse je mirë dhe thërret ndihmë kur nuk mund të përgjigjesh.',
      'ID-ja jote mjekësore dhe një linjë e drejtpërdrejtë me 127, edhe pa internet.',
    ],
    platforms: 'Apple Watch dhe Wear OS.',
    appleAlt: 'Vitalis në Apple Watch: butoni SOS mbi kartën e zemrës.',
    wearAlt: 'Vitalis në një orë të rrumbullakët Wear OS: butoni SOS.',
  },
  responder: {
    title: 'Njëzet minuta trajnim të bëjnë ndihmës.',
    lead: 'Kursi i masazhit të zemrës dhe i defibrilatorit është falas në aplikacion. Mjekët dhe infermierët aplikojnë me dokumentet e tyre dhe verifikohen nga ekipi ynë.',
    steps: [
      { title: 'Mëso', body: 'Mësime të shkurtra për masazhin e zemrës dhe përdorimin e defibrilatorit.' },
      { title: 'Kalo testin', body: 'Trego që e ke kuptuar. Mund ta përsëritësh sa herë të duash.' },
      { title: 'Merr certifikatën', body: 'Me një kod QR që kushdo mund ta verifikojë në këtë faqe.' },
      { title: 'Hyr në detyrë', body: 'Kur je i lirë, vetëm për urgjencat pranë teje.' },
    ],
  },
  orgs: {
    title: 'Bëje ndërtesën tënde gati për një arrest kardiak.',
    lead: 'Për biznese, shkolla, palestra, hotele dhe ndërtesa publike.',
    items: [
      { title: 'Defibrilatorë gati për përdorim', body: 'Të tutë në hartën e Vitalis, me kujtesa para se të skadojnë elektrodat dhe bateritë.' },
      { title: 'Stafi i trajnuar', body: 'Ekipi yt trajnohet dhe certifikohet përmes aplikacionit.' },
      { title: 'Ndihmë brenda sekondave', body: 'Stafi i certifikuar ndërhyn në vend, pa pasur nevojë të presë askush.' },
      { title: 'Raport mujor sigurie', body: 'Për arkivin tënd, inspektorët dhe sigurimet.' },
    ],
    cta: 'Na shkruani',
  },
  trust: {
    title: 'Ndërtuar për minutën më të vështirë të ditës së dikujt.',
    items: [
      { title: 'Ndihmës të verifikuar', body: 'Vetëm njerëz me certifikatë të vlefshme për masazhin e zemrës ose defibrilatorin, dhe mjekë e infermierë të verifikuar, mund të hyjnë në detyrë.' },
      { title: 'Asnjëherë në vend të 127', body: 'Vitalis sjell ndihmë nga afër. Nuk e zëvendëson ambulancën: telefono gjithmonë edhe 127 ose 112.' },
      { title: 'Të dhënat e tua mbeten të tuat', body: 'Vendndodhja jote ndahet vetëm gjatë një SOS ose kur je në detyrë. Mund t’i eksportosh ose fshish të gjitha nga aplikacioni.' },
    ],
    privacy: 'Lexo politikën e privatësisë',
  },
  final: {
    title: 'Ji gati për minutën që ka rëndësi.',
    lead: 'Shkarko Vitalis. Duhet një minutë për ta përgatitur, dhe njëzet për t’u bërë ndihmësi i dikujt.',
  },
  footer: {
    disclaimer: 'Vitalis nuk i zëvendëson shërbimet e urgjencës. Në urgjencë, telefono edhe',
    or: 'ose',
    privacy: 'Privatësia',
    map: 'Të dhënat e hartës © kontribuuesit e OpenStreetMap',
  },
  badges: { comingSoon: 'Së shpejti në', download: 'Shkarko nga', getIt: 'Merre në' },
};
