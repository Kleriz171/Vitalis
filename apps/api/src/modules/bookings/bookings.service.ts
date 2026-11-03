import { jobRan } from '../../utils/jobs';
import { Types } from 'mongoose';
import { Booking, SLOT_MIN } from '../../models/Booking';
import { Doctor } from '../../models/Doctor';
import { addDays, inTirana, tiranaTime } from '../../utils/tirana';
import { sendPush } from '../push/push.service';
import { logger } from '../../config/logger';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const SLOT_MS = SLOT_MIN * 60_000;
// Earliest a patient can book: a clinician needs a little notice.
const NOTICE_MS = 30 * 60_000;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const hhmmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const isHhmm = (s: string) => HH_MM.test(s);
export const slotsFor = (startsAt: Date, minutes: number) =>
  Array.from({ length: Math.ceil(minutes / SLOT_MIN) }, (_, i) => new Date(startsAt.getTime() + i * SLOT_MS));

/** A clinician on Vitalis (a directory entry with an account), or a 404. */
export async function bookableDoctor(doctorId: string) {
  if (!Types.ObjectId.isValid(doctorId)) throw fail(400, 'Invalid request');
  const d = await Doctor.findById(doctorId).lean();
  if (!d) throw fail(404, 'Doctor not found');
  if (!d.user) throw fail(409, 'This doctor does not take bookings on Vitalis yet');
  return d;
}

/** Every start time on one Tirana date the clinician works, for a consultation this long. */
function startsOn(d: any, date: string, minutes: number): Date[] {
  if ((d.daysOff ?? []).includes(date)) return [];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const out: Date[] = [];
  for (const w of (d.workingHours ?? []).filter((x: any) => x.day === weekday)) {
    for (let m = minutesOf(w.start); m + minutes <= minutesOf(w.end); m += SLOT_MIN) out.push(tiranaTime(date, hhmmOf(m)));
  }
  return out;
}

/** Free start times per day, from `from` (Tirana date) for `days` days. */
export async function freeSlots(d: any, typeId: string, from: string, days: number) {
  const type = (d.consultationTypes ?? []).find((t: any) => String(t._id) === typeId && t.active);
  if (!type) throw fail(404, 'This consultation type is not offered');
  const until = tiranaTime(addDays(from, days), '00:00');
  const taken = new Set((await Booking.find({ doctor: d._id, active: true, startsAt: { $lt: until }, endsAt: { $gt: tiranaTime(from, '00:00') } })
    .select('slots').lean()).flatMap(b => (b.slots as unknown as Date[]).map(s => +new Date(s))));
  const earliest = Date.now() + NOTICE_MS;
  return Array.from({ length: days }, (_, i) => addDays(from, i)).map(date => ({
    date,
    times: startsOn(d, date, type.minutes)
      .filter(s => s.getTime() >= earliest && slotsFor(s, type.minutes).every(x => !taken.has(+x)))
      .map(s => s.toISOString()),
  }));
}

/** The clinician works then (hours, not a day off, in the future). Overlaps are the index's job. */
function assertWorkingTime(d: any, startsAt: Date, minutes: number) {
  if (startsAt.getTime() < Date.now() + NOTICE_MS) throw fail(400, 'Pick a time at least 30 minutes from now');
  if (!startsOn(d, inTirana(startsAt).date, minutes).some(s => +s === +startsAt)) throw fail(400, 'The clinician does not work at that time');
}

const isDuplicate = (e: any) => e?.code === 11000;
const TAKEN = 'That time was just booked by someone else. Pick another.';

/** A patient's request, or (with `followUpOf`) a follow-up the clinician schedules, confirmed at once. */
export async function book(d: any, patientId: string, body: { typeId: string; startsAt: string; reason?: string; shareRecord: boolean }, followUpOf?: unknown) {
  if (String(d.user) === patientId) throw fail(400, 'You cannot book yourself');
  const type = (d.consultationTypes ?? []).find((t: any) => String(t._id) === body.typeId && t.active);
  if (!type) throw fail(404, 'This consultation type is not offered');
  const startsAt = new Date(body.startsAt);
  assertWorkingTime(d, startsAt, type.minutes);
  const endsAt = new Date(startsAt.getTime() + type.minutes * 60_000);
  // The patient's own diary: no two consultations at once, with anyone.
  if (await Booking.exists({ patient: patientId, active: true, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } })) {
    throw fail(409, 'You already have a consultation at that time');
  }
  try {
    return await Booking.create({
      doctor: d._id, clinician: d.user, patient: patientId,
      type: { id: type._id, name: type.name, minutes: type.minutes, online: type.online },
      price: type.price, startsAt, endsAt, slots: slotsFor(startsAt, type.minutes),
      reason: body.reason, shareRecord: body.shareRecord,
      ...(followUpOf ? { status: 'confirmed', followUpOf } : {}),
      history: [{ by: followUpOf ? d.user : patientId, action: followUpOf ? 'follow_up_scheduled' : 'requested' }],
    });
  } catch (e) {
    if (isDuplicate(e)) throw fail(409, TAKEN);
    throw e;
  }
}

/** Move a booking. Patients' moves need the clinician's confirmation again; the clinician's do not. */
export async function reschedule(bookingId: string, actor: { id: string; asClinician: boolean }, startsAtIso: string) {
  const b = await Booking.findOne({ _id: bookingId, active: true, [actor.asClinician ? 'clinician' : 'patient']: actor.id }).lean();
  if (!b) throw fail(404, 'No open booking with this id');
  const d = await Doctor.findById(b.doctor).lean();
  const startsAt = new Date(startsAtIso);
  assertWorkingTime(d, startsAt, b.type!.minutes!);
  const endsAt = new Date(startsAt.getTime() + b.type!.minutes! * 60_000);
  try {
    const moved = await Booking.findOneAndUpdate(
      { _id: b._id, active: true, startsAt: b.startsAt },
      {
        $set: { startsAt, endsAt, slots: slotsFor(startsAt, b.type!.minutes!), status: actor.asClinician ? 'confirmed' : 'requested', remindedAt: null },
        $push: { history: { by: actor.id, action: 'rescheduled', note: `${b.startsAt.toISOString()} → ${startsAt.toISOString()}` } },
      },
      { new: true },
    );
    if (!moved) throw fail(409, 'The booking changed meanwhile. Reload it.');
    return moved;
  } catch (e) {
    if (isDuplicate(e)) throw fail(409, TAKEN);
    throw e;
  }
}

/** Status moves allowed for each side. Cancelling or declining frees the slots at once. */
export async function setStatus(bookingId: string, actor: { id: string; asClinician: boolean }, action: 'confirm' | 'decline' | 'cancel', note?: string) {
  const from = action === 'confirm' || action === 'decline' ? ['requested'] : ['requested', 'confirmed'];
  if (!actor.asClinician && action !== 'cancel') throw fail(403, 'Only the clinician can do that');
  const status = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[action];
  const b = await Booking.findOneAndUpdate(
    { _id: bookingId, [actor.asClinician ? 'clinician' : 'patient']: actor.id, status: { $in: from } },
    {
      $set: { status, ...(action === 'confirm' ? {} : { active: false }) },
      $push: { history: { by: actor.id, action: status, ...(note ? { note } : {}) } },
    },
    { new: true },
  );
  if (b) return b;
  if (await Booking.exists({ _id: bookingId, [actor.asClinician ? 'clinician' : 'patient']: actor.id })) throw fail(409, 'This booking has already moved on');
  throw fail(404, 'Not found');
}

/** Push reminders, two hours ahead, for confirmed consultations. Sent once (atomic flag). */
export async function sweepReminders(now = Date.now()) {
  const due = await Booking.find({ status: 'confirmed', remindedAt: null, startsAt: { $gt: new Date(now), $lte: new Date(now + 2 * 3600_000) } })
    .select('_id').lean();
  for (const { _id } of due) {
    const b = await Booking.findOneAndUpdate({ _id, remindedAt: null }, { $set: { remindedAt: new Date(now) } }, { new: true }).populate('doctor', 'name').lean();
    if (!b) continue;
    const at = inTirana(b.startsAt).time;
    await sendPush({
      userIds: [String(b.patient)],
      kind: 'update',
      title: { en: 'Consultation today', sq: 'Konsultë sot' },
      body: { en: `${(b.doctor as any)?.name ?? 'Your clinician'} at ${at}.`, sq: `${(b.doctor as any)?.name ?? 'Mjeku juaj'} në orën ${at}.` },
      data: { type: 'booking', bookingId: String(b._id) },
    }).catch(err => logger.warn(`booking reminder: ${err?.message}`));
  }
}

export function startBookingReminders() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await sweepReminders(); jobRan('booking_reminders'); } catch (err: any) { jobRan('booking_reminders', err); logger.error(`booking reminders: ${err?.message}`); }
    finally { running = false; }
  }, 60_000);
  timer.unref();
}
