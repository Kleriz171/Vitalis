import { Router, urlencoded } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { User } from '../../models/User';
import { logger } from '../../config/logger';
import { getIO } from '../../realtime/socket';
import { emergencyService, fetchActiveCertifications } from '../emergency/emergency.service';
import { alertResponders } from '../emergency/emergency.controller';

// SOS by text message, for when the phone has signal but no data. The app pre-fills
// "VITALIS SOS <lat>,<lng>" (+ " C" for someone not breathing) to the Vitalis number;
// Twilio posts it here. The sender's number identifies the account, as in phone sign-in.
const r = Router();
const token = () => process.env.TWILIO_AUTH_TOKEN ?? '';
// The exact public URL Twilio calls (the signature covers it), e.g. https://api.vitalis.al/api/sms/inbound
const webhookUrl = () => process.env.TWILIO_WEBHOOK_URL ?? '';

/** Twilio request signature: HMAC-SHA1 over the URL plus the sorted POST params, base64. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

/** "VITALIS SOS 41.3275,19.8187 C" → coordinates [lng, lat] and whether it is cardiac. */
export function parseSosText(body: string): { coordinates: [number, number]; cardiac: boolean } | null {
  const m = /^\s*VITALIS\s+SOS\s+(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)(\s+C)?\s*$/i.exec(body);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { coordinates: [lng, lat], cardiac: !!m[3] };
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
const reply = (res: any, text: string) => res.type('text/xml').send(`<Response><Message>${escapeXml(text)}</Message></Response>`);

r.post('/inbound', urlencoded({ extended: false, limit: '20kb' }), async (req, res, next) => {
  try {
    // Fail closed: without a configured token and URL nobody can create SOS calls here.
    const sig = String(req.headers['x-twilio-signature'] ?? '');
    if (!token() || !webhookUrl() || !sig) return res.status(403).end();
    const expected = Buffer.from(twilioSignature(token(), webhookUrl(), req.body ?? {}));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return res.status(403).end();

    const from = String(req.body.From ?? '');
    const sos = parseSosText(String(req.body.Body ?? ''));
    const user = await User.findOne({ phone: from }).select('_id language').lean();
    const sq = user?.language !== 'en';
    if (!user) return reply(res, 'Vitalis: this number has no Vitalis account. Call 112 or 127 for an ambulance. / Ky numër nuk ka llogari Vitalis. Telefononi 112 ose 127.');
    if (!sos) return reply(res, sq ? 'Vitalis: mesazhi nuk u kuptua. Telefononi 127 për ambulancë.' : 'Vitalis: message not understood. Call 127 for an ambulance.');

    const { emergency: e, duplicate } = await emergencyService.create(String(user._id), {
      type: sos.cardiac ? 'cardiac' : 'medical',
      priority: sos.cardiac ? 1 : 2,
      description: sos.cardiac ? 'SOS by SMS: person collapsed, not breathing normally' : 'SOS by SMS',
      coordinates: sos.coordinates,
    });
    let nearbyCount = 0;
    if (!duplicate) {
      nearbyCount = (await alertResponders(e, [String(user._id)])).length;
      const certs = await fetchActiveCertifications([String(user._id)]);
      getIO().to('dispatchers').emit('dashboard:emergency', {
        ...e.toObject(), callerCertifications: certs.get(String(user._id)) ?? [], nearbyCount, viaSms: true,
      });
    }
    logger.info(`sms sos from ${from}: emergency ${e._id}${duplicate ? ' (already open)' : ''}`);
    return reply(res, sq
      ? `Vitalis: SOS u mor. ${nearbyCount ? `U njoftuan ${nearbyCount} ndihmës afër.` : 'Nuk ka ndihmës afër në shërbim.'} Telefononi edhe 127.`
      : `Vitalis: SOS received. ${nearbyCount ? `${nearbyCount} responder(s) nearby alerted.` : 'No responders on duty nearby.'} Call 127 too.`);
  } catch (err) { next(err); }
});

export default r;
