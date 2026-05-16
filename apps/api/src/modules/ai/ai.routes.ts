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
- Doctor application form: medical professionals can apply to join Vitalis with a PDF certification; admin reviews

You answer ONLY questions about:
1. How to use Vitalis features
2. General health, first-aid, emergency response, wellness, and medical topics

If a user asks anything outside those two areas (sports trivia, programming, celebrities, recipes, politics, etc.), reply with exactly:
"I can only help with health, first aid, emergency response, or how to use the Vitalis app. Try asking about CPR, the Bio Passport, training courses, or how SOS works."

Always be concise (under 6 sentences). Never claim to replace a clinician. For anything urgent — chest pain, severe bleeding, difficulty breathing, stroke signs, anaphylaxis — direct the user to the SOS button.`;

const MODEL = 'gemini-2.5-flash';

const callGemini = async (userMessage: string): Promise<string> => {
  if (!env.geminiApiKey) {
    return 'The AI assistant is not configured. Please set GEMINI_API_KEY on the server.';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.geminiApiKey}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
