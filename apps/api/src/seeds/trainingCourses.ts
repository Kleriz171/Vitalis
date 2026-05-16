// First Aid course content based on publicly available Red Cross / ERC guidelines.
// Educational only — not a substitute for an in-person certified course.

interface SeedLesson {
  title: string;
  summary: string;
  body: string;
  durationMin: number;
  videoUrl?: string;
}
interface SeedQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
}
export interface SeedCourse {
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  heroEmoji: string;
  estimatedMinutes: number;
  level: 'intro' | 'standard' | 'advanced';
  passingScore: number;
  badgeLabel: string;
  lessons: SeedLesson[];
  quiz: SeedQuestion[];
}

export const trainingCourses: SeedCourse[] = [
  {
    slug: 'cpr-adult',
    title: 'Adult CPR Essentials',
    category: 'cpr',
    heroEmoji: '🫀',
    shortDescription: 'Hands-only CPR for adults — recognize cardiac arrest and act in under 60 seconds.',
    estimatedMinutes: 18,
    level: 'standard',
    passingScore: 70,
    badgeLabel: 'CPR Certified',
    lessons: [
      {
        title: 'Recognising cardiac arrest',
        summary: 'How to tell quickly that someone needs CPR.',
        durationMin: 4,
        videoUrl: 'https://www.youtube.com/embed/BQNNOh8c8ks',
        body:
          'An adult in cardiac arrest is unresponsive and not breathing normally. Gasping (agonal breathing) is not normal breathing — treat it as cardiac arrest. Tap their shoulders, shout, and check breathing for no more than 10 seconds. If absent or abnormal, call emergency services and start CPR immediately.',
      },
      {
        title: 'Calling for help',
        summary: 'Get an AED on the way before you start compressions.',
        durationMin: 3,
        body:
          'If you are alone, call emergency services on speaker before starting compressions. Ask a bystander by name to fetch the nearest AED. Confirm the dispatch — minutes matter, and you should not interrupt high-quality compressions to repeat the call.',
      },
      {
        title: 'Quality chest compressions',
        summary: 'Rate, depth, recoil, and minimal interruptions.',
        durationMin: 5,
        videoUrl: 'https://www.youtube.com/embed/cosVBV96E2g',
        body:
          'Place the heel of one hand on the center of the chest, lace the other on top, lock your elbows. Press 5–6 cm deep, 100–120 times per minute (think of the beat of "Stayin\' Alive"). Allow full chest recoil between compressions and minimise pauses to under 10 seconds.',
      },
      {
        title: 'Using an AED',
        summary: 'A bystander-friendly defibrillator workflow.',
        durationMin: 3,
        body:
          'Turn the AED on as soon as it arrives — the device talks you through it. Expose the chest, dry if needed, peel and place pads as illustrated, and stand clear when it analyses. If a shock is advised, ensure nobody is touching the patient and press the shock button. Resume compressions immediately after.',
      },
      {
        title: 'When to stop',
        summary: 'Trained help arrives, or the patient revives.',
        durationMin: 3,
        body:
          'Continue CPR until professional rescuers take over, the patient starts breathing normally, or you are physically unable to continue. If they revive, place them in the recovery position and monitor breathing until handover.',
      },
    ],
    quiz: [
      {
        prompt: 'What compression rate should you aim for?',
        choices: ['60–80 per minute', '100–120 per minute', '140–160 per minute', 'As fast as possible'],
        answerIndex: 1,
        explanation: 'Guidelines target 100–120 compressions per minute for adults.',
      },
      {
        prompt: 'A patient is unresponsive and gasping irregularly. What do you do?',
        choices: ['Wait — they are breathing', 'Place in recovery position', 'Treat as cardiac arrest and start CPR', 'Give water'],
        answerIndex: 2,
        explanation: 'Agonal gasping is not normal breathing. Start CPR.',
      },
      {
        prompt: 'How deep should adult chest compressions be?',
        choices: ['1–2 cm', '5–6 cm', '8–10 cm', 'As deep as possible'],
        answerIndex: 1,
      },
      {
        prompt: 'When an AED says "shock advised", you should…',
        choices: ['Touch the patient to feel the pulse', 'Continue compressions through the shock', 'Make sure no one is touching the patient, then press shock', 'Wait for paramedics'],
        answerIndex: 2,
      },
      {
        prompt: 'You are alone with no phone. What is your priority?',
        choices: ['Drive to the hospital with the patient', 'Start CPR and shout for help', 'Look for medication', 'Wait for someone to pass by'],
        answerIndex: 1,
      },
    ],
  },
  {
    slug: 'aed-use',
    title: 'AED Confidence',
    category: 'aed',
    heroEmoji: '⚡',
    shortDescription: 'Learn how a public defibrillator works and when to deploy one safely.',
    estimatedMinutes: 12,
    level: 'intro',
    passingScore: 70,
    badgeLabel: 'AED Trained',
    lessons: [
      {
        title: 'What an AED actually does',
        summary: 'Defibrillators correct lethal rhythms — not a restart button.',
        durationMin: 3,
        body:
          'An AED detects ventricular fibrillation or pulseless ventricular tachycardia and delivers a shock that lets the heart resume an organised rhythm. It will not shock a non-shockable rhythm, so the device is safe to use on anyone unresponsive and not breathing normally.',
      },
      {
        title: 'Pad placement',
        summary: 'Right upper chest and left lower ribs.',
        durationMin: 3,
        body:
          'Place one pad on the upper right chest just under the collarbone and one on the lower left ribcage. On a small child, use paediatric pads if available, otherwise standard pads — one on the front of the chest, one on the back.',
      },
      {
        title: 'Special situations',
        summary: 'Water, hair, jewellery, pacemakers.',
        durationMin: 3,
        body:
          'Dry the chest if wet; move the patient off a metal surface. Shave dense chest hair only if the pads will not stick. Remove visible jewellery from the pad area. Place pads at least 2 cm clear of a visible pacemaker bump.',
      },
      {
        title: 'CPR + AED rhythm',
        summary: 'The pairing that doubles survival rates.',
        durationMin: 3,
        body:
          'Resume compressions the moment a shock (or no-shock advice) is delivered. The AED will reanalyse every 2 minutes. Quality compressions between shocks keep the brain perfused.',
      },
    ],
    quiz: [
      {
        prompt: 'You should attach an AED to anyone who is…',
        choices: ['Anxious and short of breath', 'Unresponsive and not breathing normally', 'Bleeding heavily', 'Having a seizure'],
        answerIndex: 1,
      },
      {
        prompt: 'After an AED shock, you should…',
        choices: ['Wait two minutes and check the pulse', 'Resume CPR immediately', 'Remove the pads', 'Give water'],
        answerIndex: 1,
      },
      {
        prompt: 'The pads belong on the…',
        choices: ['Stomach and back', 'Upper right chest and lower left ribs', 'Both nipples', 'Neck and abdomen'],
        answerIndex: 1,
      },
      {
        prompt: 'If the chest is wet, you should…',
        choices: ['Use the AED as-is', 'Dry it quickly before placing pads', 'Wait for it to evaporate', 'Skip the AED'],
        answerIndex: 1,
      },
    ],
  },
  {
    slug: 'bleeding-control',
    title: 'Severe Bleeding Control',
    category: 'bleeding',
    heroEmoji: '🩸',
    shortDescription: 'Stop life-threatening bleeding with pressure, packing, and tourniquets.',
    estimatedMinutes: 14,
    level: 'standard',
    passingScore: 70,
    badgeLabel: 'Stop the Bleed',
    lessons: [
      {
        title: 'Spot life-threatening bleeding',
        summary: 'When to act now versus when to clean and bandage.',
        durationMin: 3,
        body:
          'Spurting blood, a pool forming, blood-soaked clothing, partial or full amputation, and signs of shock (pale, cold, sweaty, confused) all mean act immediately. Less dramatic wounds can be cleaned and dressed at a slower pace.',
      },
      {
        title: 'Direct pressure',
        summary: 'The first and best technique.',
        durationMin: 3,
        body:
          'Press firmly directly on the wound with whatever clean cloth you have. Do not lift to peek — keep pressure for at least 10 minutes. If blood soaks through, add more cloth on top without removing the original.',
      },
      {
        title: 'Wound packing',
        summary: 'For deep wounds you cannot compress shut.',
        durationMin: 4,
        body:
          'For deep wounds in the groin, neck, or armpit, push clean cloth or gauze into the wound until full, then apply firm pressure on top for at least 3 minutes. Continue pressure on the way to definitive care.',
      },
      {
        title: 'Tourniquets',
        summary: 'Limb bleeding that pressure cannot stop.',
        durationMin: 4,
        body:
          'For uncontrollable limb bleeding, place a tourniquet 5 cm above the wound (not on a joint) and tighten until the bleeding stops. Note the time, write it on the patient if possible, and never loosen it once applied.',
      },
    ],
    quiz: [
      {
        prompt: 'Direct pressure should be held for at least…',
        choices: ['30 seconds', '2 minutes', '10 minutes', 'Until the patient says it stings'],
        answerIndex: 2,
      },
      {
        prompt: 'A tourniquet should be placed…',
        choices: ['Directly on the wound', '5 cm above the wound, not on a joint', 'On the chest', 'Around the neck'],
        answerIndex: 1,
      },
      {
        prompt: 'If your dressing soaks through, you should…',
        choices: ['Remove it and apply a new one', 'Add more dressing on top without removing the first', 'Stop applying pressure', 'Wash the wound'],
        answerIndex: 1,
      },
      {
        prompt: 'Wound packing is appropriate for…',
        choices: ['Surface scratches', 'Deep wounds where a tourniquet cannot be applied', 'Burns', 'Eye injuries'],
        answerIndex: 1,
      },
      {
        prompt: 'A patient is pale, cold, and confused after losing blood. This suggests…',
        choices: ['Anxiety', 'Hypothermia only', 'Shock — treat urgently', 'Dehydration only'],
        answerIndex: 2,
      },
    ],
  },
  {
    slug: 'choking-adult',
    title: 'Choking in Adults',
    category: 'choking',
    heroEmoji: '🍽️',
    shortDescription: 'Back blows, abdominal thrusts, and what to do when the patient collapses.',
    estimatedMinutes: 10,
    level: 'intro',
    passingScore: 70,
    badgeLabel: 'Airway Aware',
    lessons: [
      {
        title: 'Mild vs severe obstruction',
        summary: 'Coughing is good. Silence is bad.',
        durationMin: 3,
        body:
          'A person who can cough, speak, or breathe has a mild obstruction — encourage them to keep coughing. Severe obstruction shows as silence, inability to speak, or a high-pitched wheeze. Act immediately.',
      },
      {
        title: 'Back blows',
        summary: 'Five sharp strikes between the shoulder blades.',
        durationMin: 2,
        body:
          'Stand to the side, lean the patient forward, and deliver up to five firm blows between the shoulder blades with the heel of your hand. Check the mouth between each blow.',
      },
      {
        title: 'Abdominal thrusts',
        summary: 'Five inward-and-upward thrusts above the navel.',
        durationMin: 3,
        body:
          'If back blows fail, stand behind the patient, fist above the navel, other hand grasping it, and pull inward and upward up to five times. Alternate 5 back blows and 5 thrusts until the object clears.',
      },
      {
        title: 'When they collapse',
        summary: 'Call for help and start CPR.',
        durationMin: 2,
        body:
          'If the patient becomes unresponsive, lower them carefully, call emergency services, and start CPR. Each time you open the airway to ventilate, look in the mouth and remove any visible object.',
      },
    ],
    quiz: [
      {
        prompt: 'A coughing patient should be…',
        choices: ['Given back blows immediately', 'Encouraged to keep coughing', 'Laid flat', 'Given water'],
        answerIndex: 1,
      },
      {
        prompt: 'How many back blows do you deliver before switching technique?',
        choices: ['1', '3', '5', '10'],
        answerIndex: 2,
      },
      {
        prompt: 'Abdominal thrusts are delivered…',
        choices: ['Below the navel', 'Inward and upward above the navel', 'On the chest', 'On the back'],
        answerIndex: 1,
      },
      {
        prompt: 'If a choking patient becomes unresponsive, you should…',
        choices: ['Continue back blows lying down', 'Call emergency services and start CPR', 'Pour water', 'Wait for them to wake up'],
        answerIndex: 1,
      },
    ],
  },
  {
    slug: 'recovery-position',
    title: 'Recovery Position & Unresponsive Breathing',
    category: 'recovery',
    heroEmoji: '😮‍💨',
    shortDescription: 'Keep the airway open in someone who is breathing but unresponsive.',
    estimatedMinutes: 8,
    level: 'intro',
    passingScore: 70,
    badgeLabel: 'Recovery Trained',
    lessons: [
      {
        title: 'Who needs the recovery position',
        summary: 'Unresponsive but breathing normally.',
        durationMin: 2,
        body:
          'Use the recovery position for anyone unresponsive who is breathing normally — overdose, post-seizure, intoxication, head injury without spinal concerns. The position protects the airway from the tongue and from vomit.',
      },
      {
        title: 'Step-by-step placement',
        summary: 'Three smooth movements.',
        durationMin: 3,
        body:
          'Kneel beside the patient. Place the near arm at right angles, palm up. Bring the far hand to the cheek, then bend the far knee and pull it to roll the patient toward you. Adjust so the head rests on the hand, mouth pointing down.',
      },
      {
        title: 'Monitor and reposition',
        summary: 'Recheck every two minutes.',
        durationMin: 2,
        body:
          'Check breathing every two minutes. If breathing stops, roll the patient onto their back and start CPR. Swap to the opposite side every 30 minutes to relieve pressure on the dependent arm.',
      },
    ],
    quiz: [
      {
        prompt: 'The recovery position is used for…',
        choices: ['Cardiac arrest', 'Conscious patients with chest pain', 'Unresponsive patients who are breathing normally', 'Anyone bleeding'],
        answerIndex: 2,
      },
      {
        prompt: 'How often should you reassess breathing in a recovered patient?',
        choices: ['Every 30 minutes', 'Every 10 minutes', 'Every 2 minutes', 'Only when they move'],
        answerIndex: 2,
      },
      {
        prompt: 'If a recovered patient stops breathing, you should…',
        choices: ['Stay in position and wait', 'Roll them onto their back and start CPR', 'Sit them up', 'Give water'],
        answerIndex: 1,
      },
      {
        prompt: 'You should swap to the opposite side after about…',
        choices: ['5 minutes', '30 minutes', '2 hours', 'Never'],
        answerIndex: 1,
      },
    ],
  },
  {
    slug: 'burns-first-aid',
    title: 'Burns First Aid',
    category: 'burns',
    heroEmoji: '🔥',
    shortDescription: 'Cool, cover, and recognise burns that need a hospital.',
    estimatedMinutes: 10,
    level: 'intro',
    passingScore: 70,
    badgeLabel: 'Burns Aware',
    lessons: [
      {
        title: 'Stop the burning',
        summary: 'Remove the source before treating.',
        durationMin: 2,
        body:
          'Move the patient away from the heat source. Smother flames with a blanket. Remove smouldering or chemical-soaked clothing and any jewellery near the burn before swelling starts.',
      },
      {
        title: 'Cool with running water',
        summary: 'Twenty minutes within three hours.',
        durationMin: 3,
        body:
          'Hold the burn under cool (not cold) running water for at least 20 minutes. This is effective up to three hours after the burn. Do not use ice, butter, or toothpaste — they make tissue damage worse.',
      },
      {
        title: 'Cover and protect',
        summary: 'Clean, non-stick, loose.',
        durationMin: 2,
        body:
          'Cover the burn with cling film, a clean plastic bag, or a sterile non-adhesive dressing. Leave blisters intact. Keep the patient warm — wet skin loses heat fast.',
      },
      {
        title: 'When to seek hospital care',
        summary: 'Size, depth, and location decide.',
        durationMin: 3,
        body:
          'Hospital is needed for burns larger than the patient\'s palm, full-thickness burns (waxy, leathery, painless), and any burn on the face, hands, feet, genitals, or across a joint. Chemical, electrical, and inhalation burns always need hospital review.',
      },
    ],
    quiz: [
      {
        prompt: 'You should cool a burn under running water for at least…',
        choices: ['2 minutes', '10 minutes', '20 minutes', '60 minutes'],
        answerIndex: 2,
      },
      {
        prompt: 'A patient has a small burn — should you apply butter or toothpaste?',
        choices: ['Yes, butter cools the burn', 'Yes, toothpaste is sterile', 'No, both worsen tissue damage', 'Only if no water is available'],
        answerIndex: 2,
      },
      {
        prompt: 'Which burn always needs hospital care?',
        choices: ['A small red palm burn', 'A burn across the face or a joint', 'A grazed knee', 'A sunburn after one hour'],
        answerIndex: 1,
      },
      {
        prompt: 'A blister forms over a burn. You should…',
        choices: ['Pop it to release fluid', 'Leave it intact', 'Apply pressure to flatten it', 'Cut it away'],
        answerIndex: 1,
      },
    ],
  },
];
