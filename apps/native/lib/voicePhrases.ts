// Spoken emergency phrases. A match ALWAYS opens the SOS countdown; it never goes to the AI.
// Short cries ("help", "ndihmë", "SOS") count only as the whole utterance, so "can you help me
// with CPR?" stays a question. Longer phrases count anywhere in the sentence.
const WHOLE = ['help', 'help me', 'ndihme', 'me ndihmoni', 'sos', 'imdat'];
const ANYWHERE = [
  'not breathing', 'stopped breathing', 'call an ambulance', 'call the ambulance', 'heart attack',
  'nuk merr fryme', 'nuk po merr fryme', 'nuk marr fryme', 'thirr ambulancen', 'thirrni ambulancen', 'infarkt',
];

// Lowercase, drop accents (ë → e, ç → c) and punctuation, collapse spaces.
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function isEmergencyPhrase(text: string) {
  const n = normalize(text);
  const bare = n.replace(/\b(please|te lutem|ju lutem)\b/g, '').replace(/\s+/g, ' ').trim();
  const words = new Set(bare.split(' '));
  // "help help", "ndihme ndihme": repeats of one cry
  if (WHOLE.includes(bare) || (words.size === 1 && WHOLE.includes([...words][0]))) return true;
  return ANYWHERE.some(p => ` ${n} `.includes(` ${p} `));
}
