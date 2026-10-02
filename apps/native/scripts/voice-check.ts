/** Emergency phrase matcher.  npx tsx apps/native/scripts/voice-check.ts */
import assert from 'node:assert/strict';
import { isEmergencyPhrase as sos } from '../lib/voicePhrases';

for (const s of ['Help!', 'help help', 'Ndihmë!', 'ndihme ndihme', 'SOS', 'Më ndihmoni, ju lutem',
  'He is not breathing', 'Nuk merr frymë', 'babi nuk po merr frymë', 'Thirr ambulancën!', 'please call an ambulance'])
  assert.ok(sos(s), `emergency: ${s}`);
for (const s of ['Can you help me with CPR?', 'How does SOS work?', 'helpful tips for sleep', 'Si të ndihmoj dikë që digjet?',
  'breathing exercises', 'Çfarë është ambulanca?', ''])
  assert.ok(!sos(s), `question: ${s}`);
console.log('  ✓ voice: emergency cries and phrases caught; ordinary questions go to the assistant');
