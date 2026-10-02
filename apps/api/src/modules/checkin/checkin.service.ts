import bcrypt from 'bcryptjs';
import { CheckIn } from '../../models/CheckIn';
import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { logger } from '../../config/logger';
import { sendSms } from '../../utils/sms';
import { getIO } from '../../realtime/socket';
import { blockchainService } from '../blockchain/blockchain.service';
import { sendPush } from '../push/push.service';

const ms = (v: string | undefined, fallback: number) => (v ? Number(v) : fallback);
export const CHECKIN = {
  tickMs: ms(process.env.CHECKIN_TICK_MS, 20_000),
  graceMs: ms(process.env.CHECKIN_GRACE_MS, 2 * 60_000), // reminder → contact; dispatcher at 2.5× this
  maxWrongPins: 5,
};

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const mapsUrl = (c?: number[]) => (c?.length === 2 ? `https://maps.google.com/?q=${c[1]},${c[0]}` : null);

type Lang = 'sq' | 'en';
const SMS = {
  missed: (name: string, note: string | undefined, url: string | null) => ({
    en: `Vitalis: ${name} has not checked in as planned${note ? ` (${note})` : ''}.${url ? ` Last known location: ${url}.` : ''} Please try to reach them. If you cannot and you are worried, call 112.`,
    sq: `Vitalis: ${name} nuk është paraqitur siç kishte planifikuar${note ? ` (${note})` : ''}.${url ? ` Vendndodhja e fundit: ${url}.` : ''} Provoni ta kontaktoni. Nëse nuk mundeni dhe jeni të shqetësuar, telefononi 112.`,
  }),
  silent: (name: string, url: string | null) => ({
    en: `Vitalis: ${name} may be in danger and cannot talk freely. Do not call them.${url ? ` Last known location: ${url}.` : ''} Our dispatchers have been alerted; call 112 if you know more.`,
    sq: `Vitalis: ${name} mund të jetë në rrezik dhe nuk flet dot lirshëm. Mos e telefononi.${url ? ` Vendndodhja e fundit: ${url}.` : ''} Dispeçerët tanë u njoftuan; telefononi 112 nëse dini më shumë.`,
  }),
  allClear: (name: string) => ({
    en: `Vitalis: ${name} has checked in and is OK.`,
    sq: `Vitalis: ${name} u paraqit dhe është mirë.`,
  }),
};

async function textContact(userId: string, build: (name: string) => Record<Lang, string>) {
  const u = await User.findById(userId).select('name emergencyContact language').lean();
  const to = u?.emergencyContact?.phone;
  if (!u || !to) return false;
  const lang: Lang = u.language === 'en' ? 'en' : 'sq';
  await sendSms(to, build(u.name)[lang]).catch(err => logger.error(`check-in SMS failed: ${err?.message}`));
  return true;
}

/** Dispatcher-only incident. Silent ones are also invisible to the person's own device. */
async function raiseIncident(c: any, kind: 'missed' | 'duress' | 'pin_attempts') {
  const u = await User.findById(c.user).select('location').lean();
  const coords = c.location?.coordinates?.length === 2 ? c.location.coordinates : (u?.location as any)?.coordinates ?? [0, 0];
  const description = {
    missed: `Missed safety check-in${c.note ? `: ${c.note}` : ''}`,
    duress: `Silent alarm: duress PIN entered at check-in${c.note ? ` (${c.note})` : ''}`,
    pin_attempts: `Silent alarm: ${CHECKIN.maxWrongPins} wrong check-in PINs${c.note ? ` (${c.note})` : ''}`,
  }[kind];
  const e = await Emergency.create({
    citizen: c.user,
    type: 'other',
    priority: kind === 'missed' ? 2 : 1,
    description,
    location: { type: 'Point', coordinates: coords },
    dispatchOnly: true,
    silent: kind !== 'missed',
    timeline: [{ status: 'pending', by: c.user }],
  });
  await blockchainService.append({ entity: 'emergency', entityId: String(e._id), action: `checkin_${kind}`, actor: String(c.user) });
  getIO().to('dispatchers').emit('dashboard:emergency', { ...e.toObject(), checkIn: { note: c.note, dueAt: c.dueAt } });
  logger.info(`check-in ${c._id}: ${kind} → incident ${e._id}`);
  return e;
}

async function silentAlarm(c: any, kind: 'duress' | 'pin_attempts') {
  // Claim it once; a second duress entry must not raise a second incident.
  const claimed = await CheckIn.findOneAndUpdate(
    { _id: c._id, silentAlarm: { $exists: false } },
    { $set: { silentAlarm: kind, stage: 3 } },
    { new: true },
  );
  if (!claimed) return;
  const e = await raiseIncident(claimed, kind);
  await CheckIn.updateOne({ _id: c._id }, { $set: { emergency: e._id } });
  await textContact(String(c.user), name => SMS.silent(name, mapsUrl((e.location as any)?.coordinates)));
}

export const checkInService = {
  async setPins(userId: string, pin: string, duressPin: string) {
    if (pin === duressPin) throw fail(400, 'The two PINs must be different.');
    await User.updateOne({ _id: userId }, {
      $set: { checkInPinHash: await bcrypt.hash(pin, 10), duressPinHash: await bcrypt.hash(duressPin, 10) },
    });
  },

  async status(userId: string) {
    const u = await User.findById(userId).select('+checkInPinHash').lean();
    const active = await CheckIn.findOne({ user: userId, status: 'active' }).lean();
    return {
      hasPins: !!(u as any)?.checkInPinHash,
      active: active ? { id: String(active._id), startedAt: (active as any).createdAt, dueAt: active.dueAt, note: active.note, stage: active.stage } : null,
    };
  },

  async start(userId: string, minutes: number, note?: string, coordinates?: [number, number]) {
    const u = await User.findById(userId).select('+checkInPinHash emergencyContact').lean();
    if (!(u as any)?.checkInPinHash) throw fail(409, 'Set your check-in PINs first.');
    if (!u?.emergencyContact?.phone) throw fail(409, 'Add an emergency contact first.');
    // One timer at a time: a new one replaces the old.
    await CheckIn.updateMany({ user: userId, status: 'active' }, { $set: { status: 'cancelled' } });
    const c = await CheckIn.create({
      user: userId,
      dueAt: new Date(Date.now() + minutes * 60_000),
      note: note?.trim() || undefined,
      location: coordinates ? { type: 'Point', coordinates } : undefined,
    });
    return { id: String(c._id), startedAt: (c as any).createdAt, dueAt: c.dueAt, note: c.note, stage: 0 };
  },

  /**
   * Check in ('ok') or stop the timer ('cancel') with a PIN. The duress PIN answers exactly
   * like the real one and raises a silent alarm. Wrong PINs look wrong; the fifth also alarms.
   */
  async confirm(userId: string, id: string, pin: string, action: 'ok' | 'cancel', coordinates?: [number, number]) {
    const c = await CheckIn.findOne({ _id: id, user: userId, status: 'active' });
    if (!c) throw fail(404, 'This check-in is no longer active.');
    const u = await User.findById(userId).select('+checkInPinHash +duressPinHash').lean() as any;
    if (coordinates) c.location = { type: 'Point', coordinates } as any;
    const real = await bcrypt.compare(pin, u.checkInPinHash);
    const duress = !real && await bcrypt.compare(pin, u.duressPinHash);
    if (!real && !duress) {
      c.wrongPins += 1;
      await c.save();
      if (c.wrongPins >= CHECKIN.maxWrongPins) await silentAlarm(c, 'pin_attempts');
      throw fail(400, 'That PIN is not right.');
    }
    const wasEscalated = c.stage >= 2;
    c.status = action === 'ok' ? 'ok' : 'cancelled';
    await c.save();
    if (duress) await silentAlarm(c, 'duress');
    else {
      if (wasEscalated) await textContact(userId, name => SMS.allClear(name));
      // A late check-in closes the dispatcher incident the missed one raised.
      if (c.emergency) {
        const e = await Emergency.findOneAndUpdate(
          { _id: c.emergency, status: 'pending', silent: { $ne: true } },
          { $set: { status: 'resolved' }, $push: { timeline: { status: 'resolved', by: userId, at: new Date() } } },
          { new: true },
        );
        if (e) getIO().to('dispatchers').emit('dashboard:emergency', e);
      }
    }
    return { status: c.status };
  },
};

/** Walks overdue check-ins up the escalation ladder. */
export async function sweepCheckIns(now = Date.now()) {
  const due = await CheckIn.find({ status: 'active', dueAt: { $lte: new Date(now) }, stage: { $lt: 3 } }).lean();
  for (const c of due) {
    const late = now - new Date(c.dueAt).getTime();
    const next = late >= CHECKIN.graceMs * 2.5 ? 3 : late >= CHECKIN.graceMs ? 2 : 1;
    if (next <= c.stage) continue;
    // Claim the step atomically so two sweeps never double-text or double-alert.
    const claimed = await CheckIn.findOneAndUpdate({ _id: c._id, stage: c.stage, status: 'active' }, { $set: { stage: next } }, { new: true });
    if (!claimed) continue;
    const uid = String(c.user);
    if (c.stage < 1) {
      void sendPush({
        userIds: [uid], kind: 'sos',
        title: { en: 'Time to check in', sq: 'Është koha të paraqiteni' },
        body: { en: 'Open Vitalis and confirm you are safe, or your contact will be told.', sq: 'Hapni Vitalis dhe konfirmoni që jeni mirë, përndryshe do të njoftohet kontakti juaj.' },
        data: { type: 'checkin' },
      }).catch(() => {});
    }
    if (next >= 2 && c.stage < 2) await textContact(uid, name => SMS.missed(name, c.note ?? undefined, mapsUrl((c.location as any)?.coordinates)));
    if (next >= 3) {
      const e = await raiseIncident(claimed, 'missed');
      await CheckIn.updateOne({ _id: c._id }, { $set: { emergency: e._id } });
    }
  }
}

export function startCheckInSweep() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await sweepCheckIns(); } catch (err: any) { logger.error(`check-in sweep: ${err?.message}`); }
    finally { running = false; }
  }, CHECKIN.tickMs);
  timer.unref();
}
