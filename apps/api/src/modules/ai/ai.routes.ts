import { Router } from 'express';
import { authRequired } from '../../middleware/auth';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const r = Router();
r.use(authRequired);

const SYSTEM_PROMPT = `You are the Vitalis in-app assistant. Vitalis is an emergency bio-logistics mobile app with these features:
- SOS button on the home tab to broadcast emergencies to nearby responders
- Bio Passport (Profile tab): blood type, allergies, medications, conditions, disabilities, vaccinations, appointments — surfaced as a QR for triage
- Doctors tab: directory of doctors filterable by specialty and online availability; contact via WhatsApp
- Blood/Supply tab: blood inventory and supply requests (organs, tissue, rare medicine)
- Community tab: anonymous support groups by condition
- Training tab: first-aid courses with video lessons and a final quiz that issues a verifiable certification
- Application form: doctors and nurses can apply with a PDF certification; an operator reviews it
- Defibrillators: nearest public AEDs, with directions; users can report a missing or broken one

You answer ONLY questions about:
1. How to use Vitalis features
2. General health, first-aid, emergency response, wellness, and medical topics

If a user asks anything outside those two areas (sports trivia, programming, celebrities, recipes, politics, etc.), reply with exactly:
"I can only help with health, first aid, emergency response, or how to use the Vitalis app. Try asking about CPR, the Bio Passport, training courses, or how SOS works."

Always be concise (under 6 sentences). Never claim to replace a clinician. Reply in the language of the question (Albanian or English).
For anything urgent — someone unresponsive or not breathing normally, chest pain, severe bleeding, difficulty breathing, stroke signs, anaphylaxis — start with: call the ambulance on 127 (or 112), and press SOS in Vitalis so nearby responders come too; then give the first steps (someone not breathing normally: start chest compressions now, hard and fast in the centre of the chest, 100–120 a minute, until help takes over). Never suggest SOS without the phone number.`;

const MODEL = 'gemini-2.5-flash';

const callGemini = async (userMessage: string): Promise<string> => {
  if (!env.geminiApiKey) {
    return 'The AI assistant is not configured. Please set GEMINI_API_KEY on the server.';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    // No hidden reasoning: on 2.5 Flash it spends the output budget and answers were cut mid-sentence.
    generationConfig: { temperature: 0.4, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.warn(`gemini error ${res.status} ${text}`);
    throw new Error(`Gemini API returned ${res.status}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!reply) throw new Error('Empty response from Gemini');
  return reply;
};

r.post('/chat', async (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) return res.status(400).json({ error: 'message is required' });
  if (message.length > 2000) return res.status(400).json({ error: 'message too long' });

  try {
    const reply = await callGemini(message);
    res.json({ reply });
  } catch (e: any) {
    logger.error(`AI chat failed: ${e?.message ?? e}`);
    res.status(503).json({ error: 'The assistant is temporarily unavailable. Please try again shortly.' });
  }
});

export default r;
