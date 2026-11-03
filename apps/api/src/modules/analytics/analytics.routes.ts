import { Router } from 'express';
import { Emergency, ACTIVE_STATUSES } from '../../models/Emergency';
import { User, RESPONDER_ROLES, STAFF_ROLES } from '../../models/User';
import { Doctor } from '../../models/Doctor';
import { Aed } from '../../models/Aed';
import { Hospital } from '../../models/Hospital';
import { Booking } from '../../models/Booking';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const r = Router();
r.use(authRequired);

// Headline numbers are on the operator's live calls page too; the rest is for administrators.
r.get('/kpis', allow('eso', 'admin'), async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 86400000);
    const [total, active, pending, resolvedToday, onDuty, recent] = await Promise.all([
      Emergency.countDocuments(),
      Emergency.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
      Emergency.countDocuments({ status: 'pending' }),
      Emergency.countDocuments({ status: 'resolved', updatedAt: { $gte: since } }),
      // On duty and not paused: who could be alerted right now.
      User.countDocuments({ available: true, role: { $in: RESPONDER_ROLES }, $or: [{ pausedUntil: null }, { pausedUntil: { $lte: new Date() } }] }),
      Emergency.find({ createdAt: { $gte: since }, 'timeline.status': 'assigned' }).select('createdAt timeline').lean(),
    ]);
    const byType = await Emergency.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    // Time from SOS to a responder accepting: the number that decides survival in an arrest.
    const waits = recent
      .map((e: any) => {
        const t = e.timeline.find((x: any) => x.status === 'assigned');
        return t ? (+new Date(t.at) - +new Date(e.createdAt)) / 1000 : null;
      })
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    const medianAcceptSeconds = waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null;
    // Share of accepted calls (24 h) that a responder took within a minute: the dispatch target.
    const acceptedUnderMinutePct = waits.length ? Math.round((100 * waits.filter(w => w <= 60).length) / waits.length) : null;
    res.json({ total, active, pending, resolvedToday, onDuty, medianAcceptSeconds, acceptedUnderMinutePct, acceptedCount: waits.length, byType });
  } catch (e) { next(e); }
});

// Daily emergencies for the last 14 days
r.get('/timeseries', allow('admin'), async (_req, res, next) => {
  try {
    const days = 14;
    const since = new Date(Date.now() - days * 86400000);
    const buckets = await Emergency.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const map = new Map<string, { count: number; resolved: number }>();
    for (const b of buckets) map.set(b._id, { count: b.count, resolved: b.resolved });
    const series: Array<{ date: string; count: number; resolved: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const v = map.get(d) ?? { count: 0, resolved: 0 };
      series.push({ date: d, count: v.count, resolved: v.resolved });
    }
    res.json(series);
  } catch (e) { next(e); }
});

// Average response time (assigned timestamp - created), resolution rate
r.get('/performance', allow('admin'), async (_req, res, next) => {
  try {
    const totals = await Emergency.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          avgEta: { $avg: '$etaSeconds' },
        },
      },
    ]);
    const t = totals[0] ?? { total: 0, resolved: 0, avgEta: 0 };
    const resolutionRate = t.total ? Math.round((t.resolved / t.total) * 100) : 0;
    const avgEtaSeconds = Math.round(t.avgEta ?? 0);
    res.json({
      total: t.total,
      resolved: t.resolved,
      resolutionRate,
      avgEtaSeconds,
    });
  } catch (e) { next(e); }
});

// Top citizens by number of emergencies triggered (last 90 days)
r.get('/top-callers', allow('admin'), async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 90 * 86400000);
    const rows = await Emergency.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$citizen', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const ids = rows.map((r: any) => r._id);
    const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json(rows.map((r: any) => ({
      userId: String(r._id),
      name: byId.get(String(r._id))?.name ?? 'Unknown',
      email: byId.get(String(r._id))?.email ?? '',
      count: r.count,
    })));
  } catch (e) { next(e); }
});

// Platform numbers for administrators, all counted from the database at request time.
r.get('/platform', allow('admin'), async (_req, res, next) => {
  try {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since14 = new Date(Date.now() - 14 * 86_400_000);
    const [users, responders, clinicians, staff, active, completed30, cancelled30, escalated30, unanswered30, aeds, aedsOk, hospitals, staffedHospitals, bookings30, accepted, signups, sos] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $in: RESPONDER_ROLES } }),
      Doctor.countDocuments({ user: { $ne: null } }),
      User.countDocuments({ role: { $in: STAFF_ROLES } }),
      Emergency.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
      Emergency.countDocuments({ status: 'resolved', createdAt: { $gte: since30 } }),
      Emergency.countDocuments({ status: 'cancelled', createdAt: { $gte: since30 } }),
      Emergency.countDocuments({ escalatedAt: { $gte: since30 } }),
      // Ended without anyone ever accepting.
      Emergency.countDocuments({ createdAt: { $gte: since30 }, status: { $in: ['resolved', 'cancelled'] }, 'timeline.status': { $ne: 'assigned' } }),
      Aed.countDocuments(),
      Aed.countDocuments({ status: 'ok' }),
      Hospital.countDocuments(),
      User.distinct('hospital', { role: 'hospital', hospital: { $ne: null } }).then(x => x.length),
      Booking.countDocuments({ createdAt: { $gte: since30 } }),
      Emergency.find({ createdAt: { $gte: since30 }, 'timeline.status': 'assigned' }).select('createdAt timeline').lean(),
      User.aggregate([{ $match: { createdAt: { $gte: since14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Tirane' } }, n: { $sum: 1 } } }]),
      Emergency.aggregate([{ $match: { createdAt: { $gte: since14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Tirane' } }, n: { $sum: 1 } } }]),
    ]);
    const waits = accepted.map((e: any) => (+new Date(e.timeline.find((t: any) => t.status === 'assigned').at) - +new Date(e.createdAt)) / 1000).sort((a, b) => a - b);
    const median = waits.length ? Math.round(waits.length % 2 ? waits[(waits.length - 1) / 2] : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2) : null;
    const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Tirane' }));
    const byDay = (rows: any[]) => days.map(d => ({ date: d, n: rows.find(r => r._id === d)?.n ?? 0 }));
    res.json({
      users, responders, clinicians, staff,
      incidents: { active, completed30, cancelled30, escalated30, unanswered30, medianAcceptSeconds30: median },
      aeds: { registered: aeds, ready: aedsOk },
      hospitals: { total: hospitals, participating: staffedHospitals },
      bookings30,
      activity: { signups: byDay(signups), sos: byDay(sos) },
    });
  } catch (e) { next(e); }
});

export default r;
