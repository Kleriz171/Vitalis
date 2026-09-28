// Albanian text for the first-aid courses, overlaid by slug and by lesson/question order.
// DRAFT: must be reviewed by a native speaker with first-aid training before release.
// Keep choices in the SAME order as trainingCourses.ts: answers are graded by index.

interface LessonText { title: string; summary: string; body: string }
interface QuestionText { prompt: string; choices: string[]; explanation?: string }
export interface CourseText {
  title: string;
  shortDescription: string;
  badgeLabel: string;
  lessons: LessonText[];
  quiz: QuestionText[];
}

export const coursesSq: Record<string, CourseText> = {
  'cpr-adult': {
    title: 'CPR për të rriturit',
    shortDescription: 'CPR vetëm me duar për të rriturit: njihni arrestin kardiak dhe veproni brenda 60 sekondave.',
    badgeLabel: 'I certifikuar për CPR',
    lessons: [
      {
        title: 'Si të njihni arrestin kardiak',
        summary: 'Si ta kuptoni shpejt që dikush ka nevojë për CPR.',
        body: 'Një i rritur në arrest kardiak nuk reagon dhe nuk merr frymë normalisht. Gulçimi (frymëmarrja agonale) nuk është frymëmarrje normale: trajtojeni si arrest kardiak. Prekini shpatullat, thirrini me zë të lartë dhe kontrolloni frymëmarrjen jo më shumë se 10 sekonda. Nëse mungon ose nuk është normale, telefononi urgjencën dhe filloni CPR menjëherë.',
      },
      {
        title: 'Thirrni ndihmë',
        summary: 'Kërkoni një defibrilator para se të nisni shtypjet.',
        body: 'Nëse jeni vetëm, telefononi urgjencën me altoparlant para se të nisni shtypjet. Kërkojini një kalimtari, duke iu drejtuar drejtpërdrejt, të sjellë defibrilatorin më të afërt. Konfirmoni thirrjen: minutat kanë rëndësi dhe nuk duhet t’i ndërprisni shtypjet për ta përsëritur.',
      },
      {
        title: 'Shtypje cilësore të kraharorit',
        summary: 'Ritmi, thellësia, ngritja e kraharorit dhe sa më pak ndërprerje.',
        body: 'Vendosni thembrën e njërës dorë në mes të kraharorit, dorën tjetër sipër, me gishtat e kryqëzuar, dhe mbajini bërrylat drejt. Shtypni 5–6 cm thellë, 100–120 herë në minutë (mendoni ritmin e këngës “Stayin’ Alive”). Lëreni kraharorin të ngrihet plotësisht mes shtypjeve dhe mbajini pauzat nën 10 sekonda.',
      },
      {
        title: 'Përdorimi i defibrilatorit',
        summary: 'Hapat e defibrilatorit për çdo kalimtar.',
        body: 'Ndizeni defibrilatorin sapo të mbërrijë: pajisja ju udhëzon me zë. Zbuloni kraharorin, thajeni nëse është i lagur, hiqni mbështjellësin e elektrodave dhe vendosini siç tregon figura, pastaj largohuni kur pajisja analizon. Nëse këshillohet goditje, sigurohuni që askush të mos e prekë pacientin dhe shtypni butonin e goditjes. Rifilloni shtypjet menjëherë pas saj.',
      },
      {
        title: 'Kur të ndaloni',
        summary: 'Kur mbërrin ndihma e specializuar ose pacienti rikthehet.',
        body: 'Vazhdoni CPR derisa të marrin përsipër shpëtuesit profesionistë, pacienti të fillojë të marrë frymë normalisht ose nuk mundeni më fizikisht. Nëse rikthehet, vendoseni në pozicionin anësor të sigurisë dhe ndiqni frymëmarrjen deri në dorëzim.',
      },
    ],
    quiz: [
      {
        prompt: 'Çfarë ritmi shtypjesh duhet të synoni?',
        choices: ['60–80 në minutë', '100–120 në minutë', '140–160 në minutë', 'Sa më shpejt të jetë e mundur'],
        explanation: 'Udhëzimet synojnë 100–120 shtypje në minutë për të rriturit.',
      },
      {
        prompt: 'Një pacient nuk reagon dhe gulçon në mënyrë të parregullt. Çfarë bëni?',
        choices: ['Prisni, sepse po merr frymë', 'E vendosni në pozicionin anësor', 'E trajtoni si arrest kardiak dhe nisni CPR', 'I jepni ujë'],
        explanation: 'Gulçimi agonal nuk është frymëmarrje normale. Nisni CPR.',
      },
      {
        prompt: 'Sa thellë duhet të jenë shtypjet e kraharorit te një i rritur?',
        choices: ['1–2 cm', '5–6 cm', '8–10 cm', 'Sa më thellë të jetë e mundur'],
      },
      {
        prompt: 'Kur defibrilatori thotë “këshillohet goditje”, duhet…',
        choices: ['Të prekni pacientin për t’i ndjerë pulsin', 'Të vazhdoni shtypjet gjatë goditjes', 'Të siguroheni që askush nuk e prek pacientin, pastaj të shtypni butonin', 'Të prisni paramedikët'],
      },
      {
        prompt: 'Jeni vetëm dhe pa telefon. Cila është përparësia juaj?',
        choices: ['Ta çoni pacientin me makinë në spital', 'Të nisni CPR dhe të thërrisni për ndihmë', 'Të kërkoni ilaçe', 'Të prisni që të kalojë dikush'],
      },
    ],
  },

  'aed-use': {
    title: 'Siguri me defibrilatorin',
    shortDescription: 'Mësoni si funksionon një defibrilator publik dhe kur ta përdorni në mënyrë të sigurt.',
    badgeLabel: 'I trajnuar për defibrilatorin',
    lessons: [
      {
        title: 'Çfarë bën në të vërtetë defibrilatori',
        summary: 'Defibrilatori korrigjon ritmet vdekjeprurëse; nuk është buton rindezjeje.',
        body: 'Defibrilatori zbulon fibrilacionin ventrikular ose takikardinë ventrikulare pa puls dhe jep një goditje që i lejon zemrës të rifillojë një ritëm të rregullt. Ai nuk jep goditje kur ritmi nuk e kërkon, prandaj është i sigurt për t’u përdorur te kushdo që nuk reagon dhe nuk merr frymë normalisht.',
      },
      {
        title: 'Vendosja e elektrodave',
        summary: 'Kraharori i sipërm djathtas dhe brinjët e poshtme majtas.',
        body: 'Vendosni një elektrodë në pjesën e sipërme të djathtë të kraharorit, pak poshtë klavikulës, dhe tjetrën mbi brinjët e poshtme në të majtë. Te një fëmijë i vogël përdorni elektroda pediatrike nëse ka; përndryshe elektroda standarde: njërën përpara në kraharor, tjetrën në shpinë.',
      },
      {
        title: 'Situata të veçanta',
        summary: 'Uji, qimet, stolitë, stimuluesit kardiakë.',
        body: 'Thajeni kraharorin nëse është i lagur dhe largojeni pacientin nga sipërfaqet metalike. Rruani qimet e dendura të kraharorit vetëm nëse elektrodat nuk ngjiten. Hiqni stolitë e dukshme nga zona e elektrodave. Vendosini elektrodat të paktën 2 cm larg një stimuluesi kardiak që duket nën lëkurë.',
      },
      {
        title: 'Ritmi CPR + defibrilator',
        summary: 'Kombinimi që dyfishon mbijetesën.',
        body: 'Rifilloni shtypjet sapo të jepet goditja (ose këshilla për të mos goditur). Defibrilatori e rianalizon ritmin çdo 2 minuta. Shtypjet cilësore mes goditjeve e mbajnë trurin të furnizuar me gjak.',
      },
    ],
    quiz: [
      {
        prompt: 'Defibrilatorin duhet ta vendosni te kushdo që…',
        choices: ['Është në ankth dhe i merret fryma', 'Nuk reagon dhe nuk merr frymë normalisht', 'Po rrjedh shumë gjak', 'Ka një krizë epileptike'],
      },
      {
        prompt: 'Pas goditjes së defibrilatorit, duhet…',
        choices: ['Të prisni dy minuta dhe të kontrolloni pulsin', 'Të rifilloni CPR menjëherë', 'Të hiqni elektrodat', 'T’i jepni ujë'],
      },
      {
        prompt: 'Elektrodat vendosen në…',
        choices: ['Bark dhe shpinë', 'Kraharorin e sipërm djathtas dhe brinjët e poshtme majtas', 'Mbi të dy thithat', 'Qafë dhe bark'],
      },
      {
        prompt: 'Nëse kraharori është i lagur, duhet…',
        choices: ['Ta përdorni defibrilatorin ashtu siç është', 'Ta thani shpejt para se të vendosni elektrodat', 'Të prisni të avullojë', 'Të mos e përdorni defibrilatorin'],
      },
    ],
  },

  'bleeding-control': {
    title: 'Ndalimi i gjakderdhjes së rëndë',
    shortDescription: 'Ndalni gjakderdhjen që rrezikon jetën me shtypje, mbushje të plagës dhe turniket.',
    badgeLabel: 'Ndal gjakderdhjen',
    lessons: [
      {
        title: 'Njihni gjakderdhjen që rrezikon jetën',
        summary: 'Kur të veproni menjëherë dhe kur mjafton pastrimi e fashimi.',
        body: 'Gjaku që del me hov, një pellg që formohet, rrobat e njomura me gjak, amputimi i pjesshëm ose i plotë dhe shenjat e shokut (i zbehtë, i ftohtë, i djersitur, i hutuar) do të thonë: veproni menjëherë. Plagët më të lehta mund të pastrohen dhe fashohen me më pak ngut.',
      },
      {
        title: 'Shtypja e drejtpërdrejtë',
        summary: 'Teknika e parë dhe më e mirë.',
        body: 'Shtypni fort drejtpërdrejt mbi plagë me çfarëdo cope të pastër që keni. Mos e ngrini për të parë: mbajeni shtypjen të paktën 10 minuta. Nëse gjaku e përshkon copën, shtoni tjetër sipër pa e hequr të parën.',
      },
      {
        title: 'Mbushja e plagës',
        summary: 'Për plagë të thella që nuk mbyllen dot me shtypje.',
        body: 'Për plagë të thella në ijë, qafë ose sqetull, futni copë të pastër ose garzë në plagë derisa të mbushet, pastaj shtypni fort sipër të paktën 3 minuta. Vazhdoni shtypjen deri në marrjen e kujdesit mjekësor.',
      },
      {
        title: 'Turniketi',
        summary: 'Gjakderdhje e gjymtyrës që nuk ndalet me shtypje.',
        body: 'Për gjakderdhje të pakontrollueshme të një gjymtyre, vendosni turniketin 5 cm mbi plagë (jo mbi një nyje) dhe shtrëngojeni derisa të ndalet gjakderdhja. Shënoni orën, shkruajeni mbi pacientin nëse mundeni, dhe mos e lironi kurrë pasi ta keni vendosur.',
      },
    ],
    quiz: [
      {
        prompt: 'Shtypja e drejtpërdrejtë duhet mbajtur të paktën…',
        choices: ['30 sekonda', '2 minuta', '10 minuta', 'Derisa pacienti të thotë që i djeg'],
      },
      {
        prompt: 'Turniketi vendoset…',
        choices: ['Drejtpërdrejt mbi plagë', '5 cm mbi plagë, jo mbi një nyje', 'Në kraharor', 'Rreth qafës'],
      },
      {
        prompt: 'Nëse fasha njomet me gjak, duhet…',
        choices: ['Ta hiqni dhe të vendosni një të re', 'Të shtoni fashë sipër pa hequr të parën', 'Të ndaloni shtypjen', 'Të lani plagën'],
      },
      {
        prompt: 'Mbushja e plagës është e përshtatshme për…',
        choices: ['Gërvishtje sipërfaqësore', 'Plagë të thella ku nuk mund të vendoset turniket', 'Djegie', 'Lëndime të syrit'],
      },
      {
        prompt: 'Një pacient është i zbehtë, i ftohtë dhe i hutuar pas humbjes së gjakut. Kjo tregon…',
        choices: ['Ankth', 'Vetëm hipotermi', 'Shok: trajtojeni urgjentisht', 'Vetëm dehidrim'],
      },
    ],
  },

  'choking-adult': {
    title: 'Mbytja te të rriturit',
    shortDescription: 'Goditjet në shpinë, shtytjet në bark dhe çfarë të bëni kur pacienti rrëzohet pa ndjenja.',
    badgeLabel: 'Rrugët e frymëmarrjes',
    lessons: [
      {
        title: 'Bllokim i lehtë apo i rëndë',
        summary: 'Kolla është mirë. Heshtja është keq.',
        body: 'Një person që mund të kollitet, të flasë ose të marrë frymë ka bllokim të lehtë: inkurajojeni të vazhdojë të kollitet. Bllokimi i rëndë shfaqet me heshtje, pamundësi për të folur ose një fërshëllimë të hollë. Veproni menjëherë.',
      },
      {
        title: 'Goditjet në shpinë',
        summary: 'Pesë goditje të forta mes kockave të shpatullave.',
        body: 'Qëndroni anash, përkulni pacientin përpara dhe jepni deri në pesë goditje të forta mes kockave të shpatullave me thembrën e dorës. Kontrolloni gojën pas çdo goditjeje.',
      },
      {
        title: 'Shtytjet në bark',
        summary: 'Pesë shtytje brenda dhe lart, mbi kërthizë.',
        body: 'Nëse goditjet në shpinë nuk ndihmojnë, qëndroni pas pacientit, vendosni grushtin mbi kërthizë, kapeni me dorën tjetër dhe tërhiqni brenda dhe lart deri në pesë herë. Alternoni 5 goditje në shpinë me 5 shtytje derisa objekti të dalë.',
      },
      {
        title: 'Kur rrëzohet pa ndjenja',
        summary: 'Thirrni ndihmë dhe nisni CPR.',
        body: 'Nëse pacienti nuk reagon më, ulni me kujdes në tokë, telefononi urgjencën dhe nisni CPR. Sa herë që hapni rrugët e frymëmarrjes për të dhënë frymë, shikoni në gojë dhe hiqni çdo objekt të dukshëm.',
      },
    ],
    quiz: [
      {
        prompt: 'Një pacient që kollitet duhet…',
        choices: ['Të marrë menjëherë goditje në shpinë', 'Të inkurajohet të vazhdojë të kollitet', 'Të shtrihet në shpinë', 'Të pijë ujë'],
      },
      {
        prompt: 'Sa goditje në shpinë jepni para se të ndërroni teknikë?',
        choices: ['1', '3', '5', '10'],
      },
      {
        prompt: 'Shtytjet në bark jepen…',
        choices: ['Poshtë kërthizës', 'Brenda dhe lart, mbi kërthizë', 'Në kraharor', 'Në shpinë'],
      },
      {
        prompt: 'Nëse pacienti që po mbytet nuk reagon më, duhet…',
        choices: ['Të vazhdoni goditjet në shpinë ndërsa është shtrirë', 'Të telefononi urgjencën dhe të nisni CPR', 'T’i hidhni ujë', 'Të prisni të zgjohet'],
      },
    ],
  },

  'recovery-position': {
    title: 'Pozicioni anësor i sigurisë',
    shortDescription: 'Mbani të hapura rrugët e frymëmarrjes te dikush që merr frymë, por nuk reagon.',
    badgeLabel: 'Pozicioni anësor',
    lessons: [
      {
        title: 'Kush ka nevojë për pozicionin anësor',
        summary: 'Nuk reagon, por merr frymë normalisht.',
        body: 'Përdorni pozicionin anësor të sigurisë për këdo që nuk reagon, por merr frymë normalisht: mbidozë, pas një krize epileptike, dehje, lëndim në kokë pa dyshim për shtyllën kurrizore. Pozicioni i mbron rrugët e frymëmarrjes nga gjuha dhe të vjellat.',
      },
      {
        title: 'Vendosja hap pas hapi',
        summary: 'Tri lëvizje të qeta.',
        body: 'Gjunjëzohuni pranë pacientit. Vendosni krahun më të afërt në kënd të drejtë, me pëllëmbën lart. Sillni dorën e largët te faqja, pastaj përkulni gjurin e largët dhe tërhiqeni për ta rrotulluar pacientin nga ju. Rregullojeni që koka të mbështetet mbi dorë, me gojën të kthyer poshtë.',
      },
      {
        title: 'Ndiqni dhe rivendosni',
        summary: 'Rikontrolloni çdo dy minuta.',
        body: 'Kontrolloni frymëmarrjen çdo dy minuta. Nëse frymëmarrja ndalon, ktheni pacientin në shpinë dhe nisni CPR. Ndërroni anën çdo 30 minuta për të lehtësuar shtypjen mbi krahun poshtë.',
      },
    ],
    quiz: [
      {
        prompt: 'Pozicioni anësor i sigurisë përdoret për…',
        choices: ['Arrestin kardiak', 'Pacientë të vetëdijshëm me dhimbje gjoksi', 'Pacientë që nuk reagojnë, por marrin frymë normalisht', 'Këdo që rrjedh gjak'],
      },
      {
        prompt: 'Sa shpesh duhet rikontrolluar frymëmarrja te pacienti në pozicion anësor?',
        choices: ['Çdo 30 minuta', 'Çdo 10 minuta', 'Çdo 2 minuta', 'Vetëm kur lëviz'],
      },
      {
        prompt: 'Nëse pacienti në pozicion anësor ndalon së marri frymë, duhet…',
        choices: ['Ta lini në pozicion dhe të prisni', 'Ta ktheni në shpinë dhe të nisni CPR', 'Ta ulni', 'T’i jepni ujë'],
      },
      {
        prompt: 'Anën duhet ta ndërroni pas rreth…',
        choices: ['5 minutash', '30 minutash', '2 orësh', 'Asnjëherë'],
      },
    ],
  },

  'burns-first-aid': {
    title: 'Ndihma e parë për djegiet',
    shortDescription: 'Ftohni, mbuloni dhe njihni djegiet që kërkojnë spital.',
    badgeLabel: 'Djegiet',
    lessons: [
      {
        title: 'Ndaloni djegien',
        summary: 'Largoni burimin para trajtimit.',
        body: 'Largojeni pacientin nga burimi i nxehtësisë. Shuani flakët me një batanije. Hiqni rrobat që digjen ngadalë ose janë të njomura me kimikate, si dhe stolitë pranë djegies, para se të fillojë ënjtja.',
      },
      {
        title: 'Ftoheni me ujë të rrjedhshëm',
        summary: 'Njëzet minuta, brenda tri orëve.',
        body: 'Mbajeni djegien nën ujë të freskët (jo të akullt) që rrjedh të paktën 20 minuta. Kjo ndihmon deri në tri orë pas djegies. Mos përdorni akull, gjalpë ose pastë dhëmbësh: e përkeqësojnë dëmtimin e indeve.',
      },
      {
        title: 'Mbuloni dhe mbroni',
        summary: 'E pastër, që nuk ngjitet, e lirshme.',
        body: 'Mbulojeni djegien me mbështjellës ushqimor plastik, një qese plastike të pastër ose një fashë sterile që nuk ngjitet. Mos i shponi flluskat. Mbajeni pacientin ngrohtë: lëkura e lagur humbet nxehtësi shpejt.',
      },
      {
        title: 'Kur duhet spitali',
        summary: 'Vendosin madhësia, thellësia dhe vendi.',
        body: 'Spitali nevojitet për djegie më të mëdha se pëllëmba e pacientit, djegie të thella (të dylta, si lëkurë e regjur, pa dhimbje) dhe për çdo djegie në fytyrë, duar, këmbë, organe gjenitale ose mbi një nyje. Djegiet kimike, elektrike dhe nga thithja e tymit kërkojnë gjithmonë kontroll në spital.',
      },
    ],
    quiz: [
      {
        prompt: 'Djegien duhet ta ftohni nën ujë të rrjedhshëm të paktën…',
        choices: ['2 minuta', '10 minuta', '20 minuta', '60 minuta'],
      },
      {
        prompt: 'Një pacient ka një djegie të vogël. A duhet t’i vini gjalpë ose pastë dhëmbësh?',
        choices: ['Po, gjalpi e ftoh djegien', 'Po, pasta e dhëmbëve është sterile', 'Jo, të dyja e përkeqësojnë dëmtimin e indeve', 'Vetëm nëse nuk ka ujë'],
      },
      {
        prompt: 'Cila djegie kërkon gjithmonë spital?',
        choices: ['Një djegie e vogël e kuqe në pëllëmbë', 'Një djegie në fytyrë ose mbi një nyje', 'Një gërvishtje në gju', 'Një djegie nga dielli pas një ore'],
      },
      {
        prompt: 'Mbi djegie formohet një flluskë. Duhet…',
        choices: ['Ta shponi për të nxjerrë lëngun', 'Ta lini të paprekur', 'Ta shtypni që të rrafshohet', 'Ta prisni'],
      },
    ],
  },
};
