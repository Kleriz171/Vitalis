import { t } from './i18n';

// Step-by-step first aid while waiting for help. Follows Red Cross / ERC guidance.
// DRAFT: must be reviewed by a first-aid instructor (and the Albanian by a native speaker) before release.

export type Guide = { id: 'choking' | 'bleeding' | 'stroke' | 'anaphylaxis' | 'burns'; title: string; summary: string; steps: string[] };

export const guides: Guide[] = [
  {
    id: 'choking',
    title: t('Choking'),
    summary: t('Cannot breathe, speak or cough'),
    steps: [
      t('Ask “Are you choking?” If they can cough, tell them to keep coughing.'),
      t('If they cannot breathe or speak, lean them forward and give up to 5 firm blows between the shoulder blades.'),
      t('Then give up to 5 abdominal thrusts: stand behind, fist just above the navel, pull sharply inwards and upwards.'),
      t('Keep alternating 5 back blows and 5 thrusts until the object comes out.'),
      t('If they become unresponsive, call 127 and start CPR.'),
    ],
  },
  {
    id: 'bleeding',
    title: t('Severe bleeding'),
    summary: t('Blood pouring or spurting'),
    steps: [
      t('Call 127. Use gloves or a plastic bag on your hands if you have them.'),
      t('Press hard on the wound with a clean cloth, or your hand.'),
      t('Keep pressing without lifting to look. If blood soaks through, add more cloth on top.'),
      t('If a limb keeps bleeding despite pressure and you are trained, apply a tourniquet 5–7 cm above the wound.'),
      t('Keep them lying down and warm until help arrives.'),
    ],
  },
  {
    id: 'stroke',
    title: t('Stroke (FAST)'),
    summary: t('Face, arms, speech, time'),
    steps: [
      t('Face: ask them to smile. Does one side droop?'),
      t('Arms: can they lift both arms and keep them up?'),
      t('Speech: is it slurred, confused or strange?'),
      t('Time: if you see any sign, call 127 now and note when it started.'),
      t('Give no food, drink or medicine. Stay with them and keep them comfortable.'),
    ],
  },
  {
    id: 'anaphylaxis',
    title: t('Allergic shock'),
    summary: t('Swelling, trouble breathing, rash'),
    steps: [
      t('Call 127. Signs: swollen face or throat, trouble breathing, hives, dizziness.'),
      t('If they have an adrenaline auto-injector, help them use it in the outer thigh.'),
      t('Lay them flat with legs raised. If breathing is hard, let them sit up.'),
      t('If there is no improvement after 5 minutes and a second injector is available, use it.'),
      t('If they stop breathing normally, start CPR.'),
    ],
  },
  {
    id: 'burns',
    title: t('Burns'),
    summary: t('Cool, cover, call'),
    steps: [
      t('Cool the burn under cool running water for 20 minutes.'),
      t('Remove rings, watches or clothing near the burn, unless stuck to it.'),
      t('Cover loosely with cling film or a clean, non-fluffy cloth.'),
      t('Call 127 for large burns, burns to the face, hands or genitals, or any burn on a child.'),
    ],
  },
];
