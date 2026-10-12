// English copy for the home page. Albanian (sq.ts) mirrors every key.
export const en = {
  meta: {
    title: 'Vitalis · Help that lives on your street',
    description: 'When someone collapses, Vitalis calls the nearest trained responder and sends a second one for a defibrillator. Free, in Tirana first.',
  },
  nav: { getApp: 'Get the app', language: 'Language' },
  hero: {
    title: 'Help that lives on your street.',
    lead: 'When someone collapses, Vitalis calls the nearest trained responder and sends a second one for a defibrillator. Often minutes before an ambulance can.',
    note: 'Free to download. Tirana first.',
    cue: 'Scroll to see how it works',
  },
  story: {
    beats: [
      {
        title: 'Someone collapses by the National Gallery.',
        body: 'Her friend presses SOS. Three seconds to cancel, then Vitalis knows exactly where she is, and that she is not breathing.',
      },
      {
        title: 'The nearest responder is already moving.',
        body: 'Vitalis alerts certified responders close by, not the whole city. A nurse less than a kilometre away accepts first and is guided straight there.',
      },
      {
        title: 'A second runner brings the defibrillator.',
        body: 'On a cardiac arrest, another responder is sent past the closest public defibrillator, here on Skanderbeg Square, while the ambulance is still in traffic.',
      },
      {
        title: 'Help arrives first. The crew gets a handover.',
        body: 'Until then, the app coaches her friend through CPR at 110 beats a minute. When the ambulance arrives, the crew already knows her allergies, her medication and what happened.',
      },
    ],
    labels: { sos: 'SOS', aed: 'Defibrillator', r1: 'Responder', r2: 'Defibrillator runner' },
    credit: 'The real centre of Tirana, built from OpenStreetMap.',
  },
  app: {
    title: 'One app for the person in trouble, and the person who helps.',
    lead: 'Vitalis is free for everyone. The same app that calls for help is the one responders answer with.',
    features: [
      { title: 'SOS, hands-free if needed', body: 'Press SOS, or say “Hey Vitalis” on Android. A hard fall can raise the alarm on its own if you don’t answer.' },
      { title: 'A CPR coach in your pocket', body: 'A steady beat and plain instructions until a responder or the ambulance takes over.' },
      { title: 'Your Medical ID, ready for the crew', body: 'Allergies, medication and conditions, handed over with the patient.' },
      { title: 'On duty when you’re free', body: 'Responders switch on duty and only hear about emergencies close by.' },
    ],
    callerAlt: 'The caller’s screen during an SOS: responders alerted, a call-the-ambulance button and a CPR pacing circle.',
    responderAlt: 'The responder’s screen: on duty, with an accepted cardiac arrest call, directions and the patient’s details.',
    callerCaption: 'The caller',
    responderCaption: 'The responder',
  },
  watch: {
    title: 'On your wrist, when your phone is out of reach.',
    points: [
      'Hold SOS for three seconds. A countdown lets you cancel.',
      'If your resting heart rate stays dangerously high or low, the watch asks if you’re OK, and calls for help when you can’t answer.',
      'Your Medical ID and a direct line to 127, even offline.',
    ],
    platforms: 'Apple Watch and Wear OS.',
    appleAlt: 'Vitalis on Apple Watch: the SOS button above the heart card.',
    wearAlt: 'Vitalis on a round Wear OS watch: the SOS button.',
  },
  responder: {
    title: 'Twenty minutes of training makes you a responder.',
    lead: 'The CPR and defibrillator course is free in the app. Doctors and nurses apply with their credentials and are verified by our team.',
    steps: [
      { title: 'Learn', body: 'Short lessons on CPR and using a defibrillator.' },
      { title: 'Pass the quiz', body: 'Show you’ve got it. Retake it as often as you need.' },
      { title: 'Get your certificate', body: 'With a QR code anyone can check on this site.' },
      { title: 'Go on duty', body: 'Whenever you’re free, only for emergencies near you.' },
    ],
  },
  orgs: {
    title: 'Make your building ready for a cardiac arrest.',
    lead: 'For businesses, schools, gyms, hotels and public buildings.',
    items: [
      { title: 'Defibrillators that are ready', body: 'Yours on the Vitalis map, with reminders before pads and batteries expire.' },
      { title: 'Trained staff', body: 'Your team trained and certified through the app.' },
      { title: 'Help in seconds', body: 'Certified staff respond on site, before anyone has to wait.' },
      { title: 'A monthly safety report', body: 'For your records, inspectors and insurers.' },
    ],
    cta: 'Talk to us',
  },
  trust: {
    title: 'Built for the worst minute of someone’s day.',
    items: [
      { title: 'Verified responders', body: 'Only people with a valid CPR or defibrillator certificate, and verified doctors and nurses, can go on duty.' },
      { title: 'Never instead of 127', body: 'Vitalis brings help from nearby. It does not replace the ambulance: always call 127 or 112 too.' },
      { title: 'Your data stays yours', body: 'Your location is shared only during an SOS or while you’re on duty. Export or delete everything from the app.' },
    ],
    privacy: 'Read the privacy policy',
  },
  final: {
    title: 'Be ready for the minute that matters.',
    lead: 'Download Vitalis. It takes a minute to set up, and twenty to become someone’s responder.',
  },
  footer: {
    disclaimer: 'Vitalis does not replace emergency services. In an emergency, also call',
    or: 'or',
    privacy: 'Privacy',
    map: 'Map data © OpenStreetMap contributors',
  },
  badges: { comingSoon: 'Coming soon to', download: 'Download on the', getIt: 'Get it on' },
};

export type Copy = typeof en;
